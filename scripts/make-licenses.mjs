#!/usr/bin/env node
// 오픈소스 고지를 **생성**한다 — `npm run licenses:build` · 검사는 `npm run check:licenses`
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 **왜 생성인가**: MIT·ISC·BSD 는 *"저작권 고지와 허가 고지를 사본에 포함하라"* 를 요구한다.
//    수백 개를 손으로 적으면 그 목록은 **다음 `npm i` 에 늙는다. 그리고 고지의 거짓은 위반이다.**
//    형제 다섯이 전부 출시 직전에 이 항목을 발견했다(`common/PRE_LAUNCH_CHECK.md` §2.1).
//    My Word 는 고친 뒤 **닷새 만에 또 낡은 고지로 올릴 뻔했다** — 생성기만 있고 가드가 없어서다.
//
// 🔴 **런타임 의존만 담는다** — `devDependencies` 는 앱에 안 실린다. 고지 의무는 **배포하는 것**에 걸린다.
//    `dependencies` 에서 **전이로** 따라간다(농구명가가 루트만 보다가 중첩 의존 161개를 놓쳤다).
//
// 🔴 **본문은 라이선스 종류마다 한 벌만** 담는다. MIT 사본 수백 개는 저작권 줄만 다르고 허가 고지는
//    **같은 글**이다 → `packages[].c`(패키지별 저작권 줄) + `licenses[종류]`(본문 1벌)로 나눈다.
//
// 🟢 **폰트 절이 없다** — 결정 #13(시스템 폰트)이 예고한 그대로 폰트 항목이 **해당 없음**이다.
//    번들 폰트를 넣는 날 이 파일에 자산 절을 더한다(농구명가 `make-credits.mjs` 의 `assets` 가 그 모양이다).
//
// 승계: `basketball_story/scripts/make-credits.mjs`(2026-08-30). 설계는 `docs/OPEN_SOURCE_NOTICE.md`.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'features/legal/credits.json');

/** 🔴 카피레프트 한 종류의 이름. 식(SPDX expression) 판정은 `needsCopyleft` 가 한다 */
const COPYLEFT = /\b(A?GPL|GPL-[123]|LGPL|CC-BY-SA|SSPL|EUPL|MPL-1)/i;

/**
 * 🟡 **약한 카피레프트** — 멈추지는 않지만 의무가 하나 더 붙는다.
 * MPL-2.0 · EPL 은 *그 파일을 고쳤을 때* 그 파일의 소스를 공개하라고 한다.
 * 🟢 우리는 의존을 **고치지 않고 그대로 싣는다.** 그래서 지켜야 할 것은 ① 라이선스 본문 고지(이 생성기가 담는다)
 *   ② 소스 입수 경로다 — npm 레지스트리의 그 패키지 페이지가 그 경로다(`docs/OPEN_SOURCE_NOTICE.md` §4).
 * 🔴 **의존을 포크해서 고치는 날 이 줄의 뜻이 바뀐다.** 그래서 조용히 지나가지 않고 매번 출력한다.
 */
const WEAK_COPYLEFT = /\b(MPL-2|EPL-|CDDL|CPL-)/i;

/** 괄호 깊이를 지키며 연산자로 가른다. `(A OR B) AND C` 를 잘못 쪼개지 않기 위한 것 */
function splitTop(expr, op) {
  const parts = [];
  let depth = 0;
  let cur = '';
  const tokens = expr.split(/(\s+|\(|\))/).filter((t) => t !== '');
  for (const t of tokens) {
    if (t === '(') depth += 1;
    if (t === ')') depth -= 1;
    if (depth === 0 && t.toUpperCase() === op) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += t;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p !== '');
}

/**
 * 🔴 **이 식이 우리에게 소스 공개 의무를 지우는가.** 매 릴리스 다시 잰다(`PRE_LAUNCH_CHECK` §2.1 ⑤).
 *
 * ⚠ **이름만 보면 틀린다.** `node-forge` 는 `(BSD-3-Clause OR GPL-2.0)` 이고 **우리가 BSD 를 고르면 된다.**
 *   처음 판정은 문자열에 `GPL` 이 있다는 이유로 멈췄다 — 그건 거짓 경보이고,
 *   **틀린 가드는 없는 것보다 나쁘다**(My Word 가 604 vs 215 오경보로 배운 것).
 * - `OR` 는 고를 수 있으므로 **전부 카피레프트일 때만** 의무가 생긴다.
 * - `AND` 는 전부 적용되므로 **하나라도 카피레프트면** 의무가 생긴다.
 * - `WITH`(예외 조항)는 보수적으로 카피레프트로 본다.
 */
export function needsCopyleft(expr) {
  const inner = String(expr)
    .trim()
    .replace(/^\(([\s\S]*)\)$/, '$1')
    .trim();
  const ors = splitTop(inner, 'OR');
  if (ors.length > 1) return ors.every(needsCopyleft);
  const ands = splitTop(inner, 'AND');
  if (ands.length > 1) return ands.some(needsCopyleft);
  return COPYLEFT.test(inner);
}

/** `node_modules` 를 위로 올라가며 찾는다(npm 의 호이스팅 그대로) */
function resolvePkg(name, from) {
  let d = from;
  for (;;) {
    const p = join(d, 'node_modules', ...name.split('/'));
    if (existsSync(join(p, 'package.json'))) return p;
    const up = dirname(d);
    if (up === d) return null;
    d = up;
  }
}

const LICENSE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'License', 'LICENCE'];
function licenseText(dir) {
  for (const f of LICENSE_FILES) {
    const p = join(dir, f);
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  // 파일명이 LICENSE-MIT 처럼 접미가 붙는 패키지가 있다
  try {
    const hit = readdirSync(dir).find((f) => f.toUpperCase().startsWith('LICEN'));
    if (hit) return readFileSync(join(dir, hit), 'utf8');
  } catch {
    /* 디렉터리를 못 읽으면 없는 것으로 친다 */
  }
  return null;
}

/** 저작권 줄만 뽑는다. 🚫 없으면 비운다 — **지어내지 않는다** */
export function copyrightOf(text) {
  if (!text) return null;
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(the )?copyright/i.test(l) || /^\(c\)/i.test(l));
  return lines.length ? [...new Set(lines)].join(' · ').slice(0, 200) : null;
}

/** 허가 고지 본문 — 저작권 줄을 걷어낸 나머지(저작권은 패키지마다 따로 담는다) */
export function bodyOf(text) {
  return text
    .split('\n')
    .filter((l) => !/^\s*(the )?copyright/i.test(l) && !/^\s*\(c\)/i.test(l))
    .join('\n')
    .trim();
}

/**
 * 라이선스 표기가 **네 가지 모양**으로 온다 — 옛 npm 형식이 아직 살아 있다.
 * ⚠ `license: "None"` 인데 `licenses: "MIT"` 인 패키지가 실제로 있다. 그걸 못 읽으면 화면에 `UNKNOWN` 이 뜬다.
 */
export function normalizeLicense(j) {
  const bad = (v) => !v || /^(none|unlicensed|see licen[sc]e)/i.test(v);
  const pick = (v) => {
    if (typeof v === 'string') return bad(v) ? null : v;
    if (Array.isArray(v)) {
      for (const x of v) {
        const r = pick(x);
        if (r) return r;
      }
      return null;
    }
    if (v && typeof v === 'object') return pick(v.type);
    return null;
  };
  return pick(j.license) ?? pick(j.licenses) ?? null;
}

function build() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const seen = new Map();
  // ⚠ **부모 디렉터리에서부터** 찾아 올라간다 — 호이스팅이 안 된 중첩 의존은 루트에서 안 보인다
  const queue = Object.keys(pkg.dependencies ?? {}).map((name) => ({ name, from: root }));
  const missing = [];
  while (queue.length > 0) {
    const { name, from } = queue.shift();
    if (seen.has(name)) continue;
    const dir = resolvePkg(name, from) ?? resolvePkg(name, root);
    if (!dir) {
      seen.set(name, null);
      missing.push(name);
      continue;
    }
    const j = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const text = licenseText(dir);
    seen.set(name, {
      version: j.version,
      license: normalizeLicense(j),
      copyright: copyrightOf(text),
      text,
    });
    for (const d of Object.keys(j.dependencies ?? {})) if (!seen.has(d)) queue.push({ name: d, from: dir });
  }

  const packages = [];
  const licenses = {};
  for (const [name, v] of [...seen.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!v) continue;
    const key = v.license ?? 'UNKNOWN';
    packages.push({ n: name, v: v.version, l: key, ...(v.copyright ? { c: v.copyright } : {}) });
    if (!licenses[key] && v.text) licenses[key] = bodyOf(v.text);
  }
  // 🔴 종류 키를 정렬한다 — 객체 순서가 흔들리면 바이트 비교가 거짓 실패를 낸다
  const sortedLicenses = {};
  for (const k of Object.keys(licenses).sort()) sortedLicenses[k] = licenses[k];

  return { packages, licenses: sortedLicenses, missing };
}

// ── SELF-TEST — 순수 헬퍼를 잰다. 🔴 입력에서 이미 참인 것을 재면 아무것도 안 지킨다 ──────────
function selfTest() {
  const bad = [];
  const eq = (got, want, what) => {
    if (got !== want) bad.push(`${what}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
  };

  // 옛 형식 네 가지
  eq(normalizeLicense({ license: 'MIT' }), 'MIT', '문자열');
  eq(normalizeLicense({ license: { type: 'ISC' } }), 'ISC', '객체');
  eq(normalizeLicense({ licenses: [{ type: 'BSD-3-Clause' }] }), 'BSD-3-Clause', '배열(옛 형식)');
  eq(normalizeLicense({ license: 'None', licenses: 'MIT' }), 'MIT', '🔴 None 인데 licenses 에 있다');
  eq(normalizeLicense({ license: 'SEE LICENSE IN x' }), null, 'SEE LICENSE IN');
  eq(normalizeLicense({}), null, '표기 없음');

  // 저작권 줄 — 🚫 없으면 비운다
  eq(
    copyrightOf('MIT License\n\nCopyright (c) 2021 Someone\n\nPermission...'),
    'Copyright (c) 2021 Someone',
    '저작권 한 줄',
  );
  eq(copyrightOf('Permission is hereby granted'), null, '🔴 저작권 줄이 없으면 null(지어내지 않는다)');
  eq(copyrightOf(null), null, 'LICENSE 파일 없음');
  eq(
    copyrightOf('Copyright (c) A\nCopyright (c) A\nCopyright (c) B'),
    'Copyright (c) A · Copyright (c) B',
    '중복을 접고 둘을 잇는다',
  );

  // 본문에서 저작권 줄이 빠진다
  eq(
    bodyOf('Copyright (c) 2021 X\n\nPermission is hereby granted'),
    'Permission is hereby granted',
    '본문만 남는다',
  );
  if (bodyOf('Copyright (c) 2021 X\nPermission').includes('2021 X')) bad.push('본문에 저작권 줄이 남았다');

  // 🔴 카피레프트 판정 — 양성 대조와 음성 대조를 **둘 다** 둔다
  for (const y of ['GPL-3.0', 'AGPL-3.0-only', 'LGPL-2.1', 'CC-BY-SA-4.0', 'SSPL-1.0'])
    if (!needsCopyleft(y)) bad.push(`카피레프트를 못 잡는다: ${y}`);
  for (const n of ['MIT', 'ISC', 'BSD-3-Clause', 'Apache-2.0', 'CC0-1.0', 'CC-BY-4.0', '0BSD', 'Unlicense'])
    if (needsCopyleft(n)) bad.push(`허용 라이선스를 카피레프트로 잡는다: ${n}`);

  // 🔴 식(SPDX expression) — 이름만 보면 틀리는 자리다
  eq(needsCopyleft('(BSD-3-Clause OR GPL-2.0)'), false, '🔴 OR 이면 BSD 를 고를 수 있다(node-forge)');
  eq(needsCopyleft('(MIT OR Apache-2.0)'), false, 'OR · 둘 다 허용');
  eq(needsCopyleft('(GPL-2.0 OR LGPL-2.1)'), true, '🔴 OR 인데 전부 카피레프트면 피할 길이 없다');
  eq(needsCopyleft('(MIT AND GPL-2.0)'), true, '🔴 AND 는 전부 적용된다');
  eq(needsCopyleft('(MIT AND Apache-2.0)'), false, 'AND · 둘 다 허용');
  eq(needsCopyleft('GPL-2.0 WITH Classpath-exception-2.0'), true, 'WITH 는 보수적으로 카피레프트');
  eq(needsCopyleft('((MIT OR GPL-2.0) AND ISC)'), false, '🔴 괄호 안의 OR 를 먼저 푼다');
  eq(needsCopyleft('((GPL-2.0 OR AGPL-3.0) AND ISC)'), true, '괄호 안이 전부 카피레프트면 의무가 남는다');

  // 🟡 약한 카피레프트는 **멈추지 않는다.** 두 판정이 서로를 가려서는 안 된다
  eq(needsCopyleft('MPL-2.0'), false, '🔴 MPL-2.0 으로 빌드를 멈추지 않는다(고치지 않고 싣는다)');
  if (!WEAK_COPYLEFT.test('MPL-2.0')) bad.push('약한 카피레프트를 못 잡는다: MPL-2.0');
  if (!WEAK_COPYLEFT.test('EPL-2.0')) bad.push('약한 카피레프트를 못 잡는다: EPL-2.0');
  for (const n of ['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause'])
    if (WEAK_COPYLEFT.test(n)) bad.push(`허용 라이선스를 약한 카피레프트로 잡는다: ${n}`);

  if (bad.length > 0) {
    console.error('SELF-TEST FAIL');
    for (const b of bad) console.error(`  ✗ ${b}`);
    process.exit(2);
  }
}

selfTest();

const { packages, licenses, missing } = build();
const text = `${JSON.stringify({ packages, licenses }, null, 0)}\n`;

// 🔴 카피레프트 0 — **매 릴리스 다시 잰다.** 한 번 확인하고 끝낼 값이 아니다
const copyleft = packages.filter((p) => needsCopyleft(p.l));
const weak = packages.filter((p) => !needsCopyleft(p.l) && WEAK_COPYLEFT.test(p.l));
const unknown = packages.filter((p) => p.l === 'UNKNOWN');
const noText = Object.keys(licenses).filter((k) => !licenses[k]);

function report() {
  console.log(
    `패키지 ${packages.length} · 라이선스 종류 ${Object.keys(licenses).length} · ${(text.length / 1024).toFixed(1)}KB`,
  );
  if (missing.length > 0)
    console.log(`⚠ 못 찾은 패키지 ${missing.length}: ${missing.slice(0, 10).join(', ')}`);
  if (unknown.length > 0)
    console.log(`⚠ 라이선스 미표기 ${unknown.length}: ${unknown.map((p) => p.n).join(', ')}`);
  if (noText.length > 0) console.log(`⚠ 본문 없는 종류: ${noText.join(', ')}`);
  if (weak.length > 0)
    console.log(
      `🟡 약한 카피레프트 ${weak.length}개(고치지 않고 싣는 한 고지로 족하다): ${weak.map((p) => `${p.n}(${p.l})`).join(', ')}`,
    );
}

if (copyleft.length > 0) {
  console.error(`🔴 카피레프트 ${copyleft.length}개: ${copyleft.map((p) => `${p.n}(${p.l})`).join(', ')}`);
  console.error('   소스 공개 의무가 붙는다. 그 의존을 빼거나 사용자에게 알린 뒤 진행한다.');
  process.exit(1);
}

// 🔴 `--check` — **생성물이 지금 의존 트리와 같은가.** 커밋된 파일이 정본이고 이 검사는 "다시 뽑으면 같은가"만 묻는다
if (process.argv.includes('--check')) {
  // ⚠ `core.autocrlf=true` 인 윈도는 **체크아웃이 줄끝을 CRLF 로 바꾼다.** 생성물은 늘 LF 라
  //   그대로 비교하면 **새로 클론한 사람에게서만** FAIL 한다(형제가 커밋 직후 재현했다)
  const norm = (t) =>
    t.split(String.fromCharCode(13) + String.fromCharCode(10)).join(String.fromCharCode(10));
  const cur = existsSync(OUT) ? norm(readFileSync(OUT, 'utf8')) : '';
  if (cur !== norm(text)) {
    console.error(
      'FAIL — features/legal/credits.json 이 의존 트리와 다르다. `npm run licenses:build` 를 돌린다.',
    );
    process.exit(1);
  }
  console.log(
    `ok — 패키지 ${packages.length} · 라이선스 종류 ${Object.keys(licenses).length} · 카피레프트 0 · 약한 카피레프트 ${weak.length}`,
  );
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, text);
report();
