#!/usr/bin/env node
/**
 * AAB 권한 가드 — `docs/STORE_LISTING.md` §4.
 *
 * 🔴 **왜 `app.json` 을 안 보고 AAB 를 여나**: `app.json` 의 `android.permissions` 는 `undefined` 였는데
 *    vc2 매니페스트에는 권한 28개가 들어 있었다(2026-09-11 실측). 그중 `RECORD_AUDIO` 와
 *    `SYSTEM_ALERT_WINDOW` 는 독서 앱에 필요 없는 것이고, 스토어 페이지의 앱 권한 목록으로
 *    **사용자가 설치 전에 본다.** 심사에서 안 걸리고 콘솔에 오류로도 안 뜬다.
 *
 *    ★ 이 저장소가 네 번 배운 문장이 여기에도 걸린다.
 *      **검사가 재려는 것이 입력에서 이미 참이면 그 검사는 아무것도 안 지킨다.**
 *      `app.json` 에 `blockedPermissions` 가 적혀 있는지 보는 검사는 "적어 뒀다"만 잰다.
 *      그 값이 **빌드에서 먹었는지**는 AAB 를 열어야만 알 수 있다.
 *
 * 🔴 **`verify` 체인에 넣지 않는다.** AAB 가 없는 상태가 정상이고, 없는 것을 통과로 세면 거짓 초록이다.
 *    빌드 직후에 손으로 돌린다: `npm run check:aab -- D:/builds/Bookmind/reread-vc3.aab`
 *
 * 의존성 0. ZIP 판독과 protobuf 판독을 직접 한다(PNG 라이터를 직접 쓴 것과 같은 이유).
 *
 * 종료 코드: **2 = 자체 검사 실패 또는 사용법 오류** · **1 = 권한 검사 실패** · 0 = 통과
 */
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

// ── 허용 목록 ─────────────────────────────────────────────────────────
/** 🔴 없으면 기능이 죽는 것 */
const REQUIRED = new Set([
  'android.permission.INTERNET', // OTA
  'android.permission.ACCESS_NETWORK_STATE', // OTA
  'android.permission.CAMERA', // OCR (결정 #20)
  'android.permission.POST_NOTIFICATIONS', // 복습 알림 (기둥 7)
  'android.permission.RECEIVE_BOOT_COMPLETED', // 재부팅 후 알림 재예약
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK',
]);

/** 🟡 있어도 되는 것. 라이브러리가 선언하고 우리가 실제로 쓴다 */
const ALLOWED = new Set([
  'android.permission.READ_EXTERNAL_STORAGE', // 사진 고르기 · 백업 파일
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_APP_BADGE',
  'android.permission.BIND_JOB_SERVICE',
  'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE',
  // `expo-notifications` 가 FCM 수신자를 선언하면서 따라온다. 우리는 로컬 알림만 쓰므로 실제로는
  // 안 쓰이지만, 모듈이 자기 매니페스트에서 선언하는 것이라 우리가 끌 자리가 아니다.
  // ⚠ 일반(normal) 권한이라 사용자에게 권한 목록으로 보이지 않는다.
  'com.google.android.c2dm.permission.RECEIVE',
  // AndroidX core 가 자동으로 만드는 **서명 권한**. 동적 리시버를 같은 앱만 부르게 막는 안전 장치다.
  // 값이 패키지명으로 시작하므로 패키지를 바꾸면 이 문자열도 바뀐다.
  'com.vivacegames.reread.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
]);

/**
 * 🟡 런처 배지 계열. `expo-notifications` 가 제조사별로 선언한다.
 * ⚠ `me.everything.badger` 는 ShortcutBadger 것이라 `com.` 으로 시작하지 않는다.
 *    처음 패턴을 `com.` 으로만 잡았다가 이 둘을 "모르는 권한"으로 잘못 세웠다(2026-09-11).
 */
const ALLOWED_PATTERNS = [
  /^com\.(anddoes|htc|huawei|majeur|oppo|sec|sonyericsson|sonymobile|vivo|zuk|zte|oneplus|mi)\b.*$/,
  /^me\.everything\.badger\.permission\.BADGE_COUNT_(READ|WRITE)$/,
];

/**
 * 🔴 **있으면 즉시 실패.** 허용 목록 밖이면 어차피 실패하지만, 이 셋은 왜 나쁜지를 따로 말해 준다.
 *    모르는 권한이 조용히 들어오는 것과, 우리가 이미 걷어낸 것이 되돌아오는 것은 다른 사고다.
 */
const FORBIDDEN = new Map([
  ['android.permission.RECORD_AUDIO', '독서 앱이 마이크를 요구한다. 걷어낸 적이 있으니 되돌아온 것이다'],
  ['android.permission.SYSTEM_ALERT_WINDOW', 'Expo bare 템플릿 기본값이고 우리는 쓰지 않는다'],
  [
    'com.google.android.gms.permission.AD_ID',
    '광고 ID. 결정 #10 과 데이터 보안 선언을 동시에 거짓으로 만든다',
  ],
  ['android.permission.ACCESS_FINE_LOCATION', '위치를 쓰지 않는다'],
  ['android.permission.ACCESS_COARSE_LOCATION', '위치를 쓰지 않는다'],
  ['android.permission.READ_CONTACTS', '연락처를 쓰지 않는다'],
]);

// ── protobuf 최소 판독 ────────────────────────────────────────────────
/** varint 하나를 읽고 `[값, 다음 위치]` 를 준다 */
function readVarint(buf, pos) {
  let result = 0;
  let shift = 0;
  while (pos < buf.length) {
    const b = buf[pos++];
    result += (b & 0x7f) * Math.pow(2, shift);
    if ((b & 0x80) === 0) return [result, pos];
    shift += 7;
  }
  throw new Error('varint 가 잘렸다');
}

/**
 * 메시지 하나를 필드 목록으로 편다. 스키마를 모르는 채로 번호만 본다.
 * 반환: `[{ field, wire, bytes?, value? }]`
 */
function parseMessage(buf) {
  const out = [];
  let pos = 0;
  while (pos < buf.length) {
    let key;
    [key, pos] = readVarint(buf, pos);
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) {
      let v;
      [v, pos] = readVarint(buf, pos);
      out.push({ field, wire, value: v });
    } else if (wire === 2) {
      let len;
      [len, pos] = readVarint(buf, pos);
      out.push({ field, wire, bytes: buf.subarray(pos, pos + len) });
      pos += len;
    } else if (wire === 5) {
      out.push({ field, wire, value: buf.readUInt32LE(pos) });
      pos += 4;
    } else if (wire === 1) {
      out.push({ field, wire });
      pos += 8;
    } else {
      throw new Error(`모르는 wire type ${wire}`);
    }
  }
  return out;
}

const first = (fields, n) => fields.find((f) => f.field === n);
const str = (fields, n) => {
  const f = first(fields, n);
  return f && f.bytes ? f.bytes.toString('utf8') : null;
};

/**
 * aapt2 `XmlNode` 를 훑어 `uses-permission` 요소의 `android:name` 값을 모은다.
 *
 * 스키마(aapt 의 `Resources.proto`):
 *   XmlNode    { XmlElement element = 1; string text = 2; }
 *   XmlElement { ns_decl = 1; string namespace_uri = 2; string name = 3;
 *                XmlAttribute attribute = 4; XmlNode child = 5; }
 *   XmlAttribute { string namespace_uri = 1; string name = 2; string value = 3; }
 *
 * 🔴 **`name` 속성만 센다.** `<receiver android:permission="…DUMP">` 는 권한 **요청**이 아니라
 *    리시버의 보호 속성이다. 그걸 세면 vc2 에서 `DUMP` 를 요청 권한으로 잘못 읽게 된다.
 */
function collectPermissions(nodeBuf, found = []) {
  const node = parseMessage(nodeBuf);
  const el = first(node, 1);
  if (!el || !el.bytes) return found;
  const element = parseMessage(el.bytes);
  if (str(element, 3) === 'uses-permission') {
    for (const attr of element.filter((f) => f.field === 4 && f.bytes)) {
      const a = parseMessage(attr.bytes);
      if (str(a, 2) === 'name') {
        const v = str(a, 3);
        if (v) found.push(v);
      }
    }
  }
  for (const child of element.filter((f) => f.field === 5 && f.bytes)) {
    collectPermissions(child.bytes, found);
  }
  return found;
}

// ── ZIP 최소 판독 ─────────────────────────────────────────────────────
/** AAB 안의 한 파일을 꺼낸다. 중앙 디렉터리를 읽어 오프셋을 찾는다 */
function readZipEntry(zip, wanted) {
  // EOCD (0x06054b50) 를 뒤에서 찾는다
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0 && i > zip.length - 66000; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('EOCD 를 못 찾았다. ZIP 이 아니다');
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error('중앙 디렉터리 헤더가 깨졌다');
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const name = zip.subarray(p + 46, p + 46 + nameLen).toString('latin1');
    if (name === wanted) {
      const method = zip.readUInt16LE(p + 10);
      const compSize = zip.readUInt32LE(p + 20);
      const local = zip.readUInt32LE(p + 42);
      const lNameLen = zip.readUInt16LE(local + 26);
      const lExtraLen = zip.readUInt16LE(local + 28);
      const start = local + 30 + lNameLen + lExtraLen;
      const data = zip.subarray(start, start + compSize);
      return method === 0 ? data : inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`ZIP 안에 ${wanted} 가 없다`);
}

// ── 판정 ──────────────────────────────────────────────────────────────
function classify(perms) {
  const problems = [];
  for (const p of perms) {
    if (FORBIDDEN.has(p)) {
      problems.push({ perm: p, why: `🔴 금지 — ${FORBIDDEN.get(p)}` });
    } else if (!REQUIRED.has(p) && !ALLOWED.has(p) && !ALLOWED_PATTERNS.some((re) => re.test(p))) {
      problems.push({ perm: p, why: '🔴 모르는 권한이다. 필요하면 허용 목록에 근거와 함께 넣는다' });
    }
  }
  for (const r of REQUIRED) {
    if (!perms.includes(r)) problems.push({ perm: r, why: '🔴 있어야 하는데 없다. 기능이 죽는다' });
  }
  return problems;
}

// ── SELF-TEST ─────────────────────────────────────────────────────────
/** protobuf 인코더(자체 검사 전용). 실제 AAB 를 흉내 낸 매니페스트를 메모리에서 만든다 */
function vint(n) {
  const out = [];
  while (n > 127) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n);
  return Buffer.from(out);
}
const lenField = (field, buf) => Buffer.concat([vint(field * 8 + 2), vint(buf.length), buf]);
const strField = (field, s) => lenField(field, Buffer.from(s, 'utf8'));
const attr = (name, value) => lenField(4, Buffer.concat([strField(2, name), strField(3, value)]));
const element = (name, parts) => lenField(1, Buffer.concat([strField(3, name), ...parts]));
const childNode = (buf) => lenField(5, buf);

function selfTest() {
  const fail = (m) => {
    console.error(`  ✗ SELF-TEST: ${m}`);
    process.exit(2);
  };

  // 🔴 **양성 대조를 두 층으로 나눠 둔다.** 처음엔 `receiver(permission=DUMP)` 하나만 뒀는데,
  //    그건 **요소 이름 검사가 이미 걸러내는 자리**라 속성 이름 검사를 한 번도 재지 않았다.
  //    `str(a, 2) === 'name'` 을 통째로 없애는 변이를 넣어도 자체 검사가 초록이었다(2026-09-11).
  //    ★ 검사가 재려는 것이 입력에서 이미 참이면 그 검사는 아무것도 안 지킨다.
  //    그래서 `uses-permission` **안에** `name` 이 아닌 속성을 같이 둔다. 실제 매니페스트도
  //    `maxSdkVersion` 같은 속성을 함께 단다.
  const tree = element('manifest', [
    childNode(
      element('uses-permission', [
        attr('maxSdkVersion', '32'), // ← 속성 이름 검사만이 이것을 걸러낸다
        attr('name', 'android.permission.CAMERA'),
      ]),
    ),
    childNode(element('uses-permission', [attr('name', 'android.permission.VIBRATE')])),
    childNode(element('receiver', [attr('permission', 'android.permission.DUMP')])),
  ]);

  const got = collectPermissions(tree);
  if (got.length !== 2) fail(`권한 2개를 기대했는데 ${got.length}개다: ${got.join(', ')}`);
  if (!got.includes('android.permission.CAMERA')) fail('CAMERA 를 못 읽었다');
  if (!got.includes('android.permission.VIBRATE')) fail('VIBRATE 를 못 읽었다');
  // 양성 대조 ① — `uses-permission` 안의 다른 속성을 값으로 세면 안 된다
  if (got.includes('32')) fail('uses-permission 의 maxSdkVersion 을 권한 이름으로 셌다');
  // 양성 대조 ② — 리시버의 보호 속성은 권한 **요청**이 아니다
  if (got.includes('android.permission.DUMP')) {
    fail('receiver 의 android:permission 을 요청 권한으로 셌다. DUMP 를 잘못 잡는다');
  }

  // 판정 함수가 실제로 발화하는지
  const all = [...REQUIRED];
  if (classify(all).length !== 0) fail('요구 권한만 있는 입력을 통과시키지 못했다');
  if (classify([...all, 'android.permission.RECORD_AUDIO']).length !== 1) {
    fail('RECORD_AUDIO 를 안 잡았다');
  }
  if (classify([...all, 'android.permission.FOO_BAR']).length !== 1) fail('모르는 권한을 안 잡았다');
  if (classify(all.filter((p) => p !== 'android.permission.CAMERA')).length !== 1) {
    fail('필수 권한이 빠진 것을 안 잡았다');
  }
  if (classify([...all, 'com.sec.android.provider.badge.permission.READ']).length !== 0) {
    fail('런처 배지 권한을 오탐했다');
  }
}

// ── 실행 ──────────────────────────────────────────────────────────────
selfTest();

const aabPath = process.argv[2];
if (!aabPath) {
  console.error('사용법: npm run check:aab -- <aab 경로>');
  console.error('🔴 경로 없이 통과시키지 않는다. 안 잰 것을 초록으로 세면 그게 거짓 초록이다.');
  process.exit(2);
}

let perms;
try {
  const manifest = readZipEntry(readFileSync(aabPath), 'base/manifest/AndroidManifest.xml');
  perms = collectPermissions(manifest).sort();
} catch (e) {
  console.error(`✗ AAB 를 읽지 못했다: ${e.message}`);
  process.exit(2);
}

const problems = classify(perms);
console.log(`AAB 권한 ${perms.length}개 — ${aabPath}`);
for (const p of perms) {
  const bad = problems.find((x) => x.perm === p);
  console.log(`  ${bad ? '🔴' : '🟢'} ${p}`);
}
if (problems.length > 0) {
  console.error(`\n✗ 문제 ${problems.length}건`);
  for (const { perm, why } of problems) console.error(`  ${perm}\n    ${why}`);
  process.exit(1);
}
console.log('\n✓ 권한 집합이 허용 목록과 일치한다');
