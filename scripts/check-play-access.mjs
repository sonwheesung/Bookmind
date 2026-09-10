/**
 * check:play-access — 서비스 계정이 Play 의 우리 앱에 닿는가 (브라우저 없이)
 *
 * 🔴 **이 스크립트의 값은 "된다/안 된다"가 아니라 세 상태를 갈라 준다는 것이다**(2026-09-10 실증).
 *
 *   404 Package not found   → 콘솔에 **앱이 없다**
 *   403 caller has no perm  → 앱은 있는데 **서비스 계정에 안 딸려 왔다**(새 앱의 기본 상태)
 *   200                     → 닿는다. ⚠ 다만 아래 경고를 읽을 것
 *
 * 세 상태의 증상이 콘솔에서는 비슷해 보인다. 2026-09-10 에 이 구분이 실제로 값을 했다.
 * 앱을 만들기 전 404 → 만든 뒤 403 → 권한을 준 뒤 200 으로 **한 단계씩 확인**했다.
 *
 * 🔴 **대조군이 판정의 핵심이다.** 하나만 보면 키 문제인지 인가 문제인지 못 가른다.
 *    전부 실패하면 키·API 문제 · 일부만 실패하면 인가(또는 앱 부재) 문제.
 *    승계: `diary/scripts/check-play-access.mjs`.
 *
 * ⚠ **200 을 "업로드 된다"로 읽지 마라.** 우리 서비스 계정은 RevenueCat 용이라
 *    읽기 권한이 **상시로 켜져 있다.** `앱을 테스트 트랙으로 출시` 는 **별개 권한**이고
 *    여기서 안 보인다. 2026-09-10 에 권한을 회수한 뒤에도 이 검사는 **200 을 유지했다.**
 *    🔴 업로드 가능 여부의 판정은 `eas submit` 이 실제로 통과하는 것뿐이다(`docs/BUILD.md` §7).
 *
 * ⚠ 키·토큰을 절대 출력하지 않는다. 찍는 것은 HTTP 상태와 구글이 준 메시지뿐이다.
 */
import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const KEY_PATH = process.env.PLAY_SA_KEY ?? 'C:/project/secrets/play-service-account.json';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

/** 🔴 대조군을 반드시 함께 둔다. 우리 것 하나만 보면 아무것도 못 가른다. */
const PACKAGES = [
  ['🎯 Re:Read', 'com.vivacegames.reread'],
  ['대조: 조각', 'com.son0925.jogak'],
  ['대조: LinkMemo', 'com.vivacegames.linkmemo'],
  ['대조: 없는앱', 'com.vivacegames.doesnotexist999'],
];

if (!existsSync(KEY_PATH)) {
  console.error(`서비스 계정 키가 없다: ${KEY_PATH}`);
  console.error('PLAY_SA_KEY 환경변수로 경로를 넘길 수 있다.');
  process.exit(1);
}

const sa = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
const now = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const claim =
  `${b64({ alg: 'RS256', typ: 'JWT' })}.` +
  b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
const sig = createSign('RSA-SHA256').update(claim).end().sign(sa.private_key, 'base64url');

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${claim}.${sig}`,
  }),
});
const token = await tokenRes.json();
if (!token.access_token) {
  console.error(`🔴 토큰 발급 실패: ${token.error} — ${token.error_description}`);
  console.error('   키가 죽었거나 Cloud 프로젝트에서 서비스 계정이 지워진 경우다.');
  process.exit(1);
}

const H = { authorization: `Bearer ${token.access_token}` };
console.log(`\n서비스 계정  ${sa.client_email}\n`);

/* 🔴 카탈로그 조회가 아니라 `edits.insert` 로 잰다. 업로드가 실제로 쓰는 첫 호출이라
   "읽기는 되는데 편집은 안 되는" 상태를 그대로 드러낸다. */
for (const [name, pkg] of PACKAGES) {
  const res = await fetch(`${API}/${pkg}/edits`, { method: 'POST', headers: H });
  const raw = await res.text();
  let msg = '';
  try {
    msg = (JSON.parse(raw).error?.message ?? '').slice(0, 90);
  } catch {
    /* 본문 없음 */
  }
  console.log(`${name.padEnd(16)} edits.insert  ${String(res.status).padEnd(5)} ${msg}`);
  // 🔴 만든 편집본을 남기지 않는다. 쌓이면 콘솔에 "검토 중인 변경사항"으로 보인다
  if (res.ok) {
    const id = JSON.parse(raw).id;
    if (id) await fetch(`${API}/${pkg}/edits/${id}`, { method: 'DELETE', headers: H });
  }
}

console.log('\n🔴 200 이어도 AAB 업로드는 막힐 수 있다.');
console.log('   `앱을 테스트 트랙으로 출시` 는 여기서 안 보이는 **별개 권한**이고,');
console.log('   이 계정은 RevenueCat 용이라 읽기 권한이 상시라 그 신호가 안 나온다.');
console.log('   판정은 `eas submit` 이 통과하는 것으로만 한다 (docs/BUILD.md §7).\n');
