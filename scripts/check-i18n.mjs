#!/usr/bin/env node
/**
 * check:i18n — 다국어 가드 (`docs/I18N_SYSTEM.md` §5).
 *
 * 보는 것 넷:
 *   ① 키 누락    en 에 있고 다른 언어에 없는 키
 *   ② 키 잉여    다른 언어에만 있는 키
 *   ③ 보간 일치  같은 키의 {{변수}} 집합이 언어 간 동일한가
 *   ④ 잔존 한글  비한국어 파일에 한글이 남아 있는가
 *   ⑤ 없는 키    화면이 부르는 `t('...')` 가 리소스에 실제로 있는가 (2026-09-09 신설)
 *   ⑥ 죽은 키    리소스에 있는데 화면이 아무도 안 부르는 키 (2026-09-09 신설)
 *
 * 🔴 그리고 **양성 대조(SELF-TEST)** 를 먼저 돌린다.
 *    형제 idea_repository/scripts/check-i18n.mjs 가 2026-08-20 부터 19일간 초록이었는데
 *    정규식에 제어문자 0x08 이 박혀 **아무것도 수집하지 않고 통과**하고 있었다.
 *    "변이가 잡히는가"만 보면 그 사고는 안 걸린다 — "정규식이 실제로 무언가를 수집하는가"를 봐야 한다.
 *    개수는 실행량이지 검증량이 아니다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = join(ROOT, 'locales');
const BASE = 'en';

const fail = [];
const note = (m) => fail.push(m);

/** 중첩 객체를 'a.b.c' 로 편다 */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

const INTERP = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/**
 * 🔴 ⑤ 축이 왜 생겼나 (2026-09-09): locale 두 파일에서 키가 **동시에** 사라지면
 *    ①②는 서로만 대조하므로 **둘 다 통과한다.** 실제로 그날 `knowledge.thoughts.*` 넷이
 *    양쪽에서 함께 지워졌고 화면에는 키 문자열이 그대로 나갈 뻔했다.
 *    형제 프로젝트가 19일간 죽여 놨던 검사가 정확히 이 축이다(`docs/I18N_SYSTEM.md` §5.1).
 *
 * ⚠ 템플릿 리터럴(`t(\`books.status.${s}\`)`)은 정적으로 못 푼다 — 세지 않고 건너뛴다.
 *    그래서 이 검사는 **완전 탐지가 아니라 하한**이다.
 */
const T_CALL = /\bt\(\s*'([A-Za-z0-9_.]+)'/g;

/**
 * 🔴 ⑥ 축이 왜 생겼나 (2026-09-09): 디자인 패스에서 화면 두 곳을 걷어냈는데
 *    `home.today.reviewCount` · `knowledge.tags.empty` 가 리소스에 그대로 남았다.
 *    ①~⑤ 는 **전부 통과했다** — 두 언어에 대칭으로 있고, 아무도 안 부르니 ⑤ 에도 안 걸린다.
 *    죽은 키는 화면을 안 깨뜨리는 대신 **다음 번역가에게 일을 시킨다**(15개 언어로 가면 15배다).
 *
 * ⚠ 템플릿 리터럴은 정적으로 못 푸니 **앞머리만** 딴다 —
 *    `` t(`books.status.${s}`) `` → 접두사 `books.status.` 아래 키는 전부 쓰인 것으로 친다.
 */
const T_TPL = /\bt\(\s*`([A-Za-z0-9_.]*)\$\{/g;

/**
 * ⏸ 아직 화면이 없는 키 — **이유를 적어야 통과한다.**
 * 🔴 이 목록은 스스로 썩지 않는다: 여기 적힌 키가 실제로 쓰이기 시작하거나 리소스에서 사라지면
 *    가드가 *"목록에서 빼라"* 로 FAIL 한다. 예외를 적어 두고 잊는 흔한 사고를 그렇게 막는다.
 */
// 🔄 2026-09-21 `ai.notice.proxy` 를 뺐다(결정 #28 · AI 를 붙이지 않는다). 지금 예정 키는 없다
const PLANNED = new Map();

const SRC_DIRS = ['app', 'components', 'features', 'lib', 'hooks'];

function sourceFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) sourceFiles(rel, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
  }
  return out;
}

function usedKeys() {
  const found = new Map();
  const prefixes = new Set();
  for (const dir of SRC_DIRS) {
    for (const f of sourceFiles(dir)) {
      const text = readFileSync(join(ROOT, f), 'utf8');
      for (const m of text.matchAll(T_CALL)) {
        if (!found.has(m[1])) found.set(m[1], f);
      }
      for (const m of text.matchAll(T_TPL)) {
        if (m[1] !== '') prefixes.add(m[1]);
      }
    }
  }
  return { found, prefixes };
}
const HANGUL = /[가-힣ㄱ-ㆎ]/;

function interpolations(s) {
  return new Set(Array.from(s.matchAll(INTERP), (m) => m[1]));
}

// ── 🔴 양성 대조 — 판정 함수가 살아 있는지 먼저 증명한다 ──────────────────
function selfTest() {
  const probe = 'hello {{count}} and {{name}}';
  const got = interpolations(probe);
  if (got.size !== 2 || !got.has('count') || !got.has('name')) {
    console.error('SELF-TEST FAIL: 보간 정규식이 아무것도(또는 틀리게) 수집한다 →', [...got]);
    console.error('  정규식에 제어문자가 박혔을 수 있다. `npm run check:chars` 를 먼저 돌려라.');
    process.exit(2);
  }
  if (!HANGUL.test('가')) {
    console.error('SELF-TEST FAIL: 한글 정규식이 한글을 못 잡는다');
    process.exit(2);
  }
  if (HANGUL.test('abc')) {
    console.error('SELF-TEST FAIL: 한글 정규식이 영문을 잡는다');
    process.exit(2);
  }
  const probeKeys = [
    ...`const x = t('a.b.c'); const y = t("skip"); const z = t('d.e');`.matchAll(T_CALL),
  ].map((m) => m[1]);
  if (probeKeys.length !== 2 || probeKeys[0] !== 'a.b.c') {
    console.error('SELF-TEST FAIL: t() 스캐너가 키를 못 모은다 →', probeKeys);
    process.exit(2);
  }
  const probeTpl = [...'const s = t(`x.y.${v}`); t(`${v}`);'.matchAll(T_TPL)].map((m) => m[1]);
  if (probeTpl.length !== 2 || probeTpl[0] !== 'x.y.') {
    console.error('SELF-TEST FAIL: 템플릿 접두사 스캐너가 죽었다 →', probeTpl);
    process.exit(2);
  }
  const f = flatten({ a: { b: 'x' } });
  if (f['a.b'] !== 'x') {
    console.error('SELF-TEST FAIL: flatten 이 깨졌다');
    process.exit(2);
  }
}
selfTest();
// ──────────────────────────────────────────────────────────────────────

const files = readdirSync(LOCALES).filter((f) => f.endsWith('.json'));
if (!files.includes(`${BASE}.json`)) {
  console.error(`FAIL: 기준 언어 ${BASE}.json 이 없다`);
  process.exit(1);
}

const maps = {};
for (const f of files) {
  const lang = f.replace(/\.json$/, '');
  maps[lang] = flatten(JSON.parse(readFileSync(join(LOCALES, f), 'utf8')));
}

const baseKeys = Object.keys(maps[BASE]).sort();
if (baseKeys.length === 0) {
  console.error('FAIL: 기준 언어에 키가 0개다 — 파서가 죽었을 수 있다');
  process.exit(1);
}

for (const [lang, map] of Object.entries(maps)) {
  if (lang === BASE) continue;
  const keys = new Set(Object.keys(map));

  for (const k of baseKeys) {
    if (!keys.has(k)) note(`① 누락  ${lang}: ${k}`);
  }
  for (const k of keys) {
    if (!(k in maps[BASE])) note(`② 잉여  ${lang}: ${k}`);
  }
  for (const k of baseKeys) {
    if (!keys.has(k)) continue;
    const a = interpolations(maps[BASE][k]);
    const b = interpolations(map[k]);
    if (a.size !== b.size || [...a].some((x) => !b.has(x))) {
      note(`③ 보간  ${k}: ${BASE}={${[...a]}} ${lang}={${[...b]}}`);
    }
  }
}

for (const [lang, map] of Object.entries(maps)) {
  if (lang === 'ko') continue;
  for (const [k, v] of Object.entries(map)) {
    if (HANGUL.test(v)) note(`④ 한글  ${lang}: ${k}`);
  }
}

// ⑤ 화면이 부르는 키가 리소스에 있는가
const { found: used, prefixes } = usedKeys();
if (used.size === 0) {
  console.error('FAIL: 소스에서 t() 를 하나도 못 찾았다 — 스캐너가 죽었다');
  process.exit(1);
}
for (const [key, file] of used) {
  if (!(key in maps[BASE])) note(`⑤ 없는 키  ${key} (${file})`);
}

// ⑥ 리소스에 있는데 아무도 안 부르는 키
for (const key of baseKeys) {
  if (used.has(key)) continue;
  if ([...prefixes].some((p) => key.startsWith(p))) continue;
  if (PLANNED.has(key)) continue;
  note(`⑥ 죽은 키  ${key} — 화면에서 안 쓴다. 지우거나, 쓰는 화면을 붙여라`);
}
// ⑥-b 예외 목록이 늙지 않게 — 쓰이기 시작했거나 사라진 키는 목록에서 빼라
for (const [key, why] of PLANNED) {
  if (!(key in maps[BASE])) note(`⑥ 예외 낡음  ${key} 가 리소스에 없다 — PLANNED 에서 빼라 (${why})`);
  else if (used.has(key)) note(`⑥ 예외 낡음  ${key} 를 이제 화면이 쓴다 — PLANNED 에서 빼라`);
}

if (fail.length) {
  console.error(`check:i18n FAIL (${fail.length})`);
  for (const m of fail) console.error('  ' + m);
  process.exit(1);
}
console.log(
  `check:i18n OK — ${files.length}개 언어 · ${baseKeys.length}키 · 화면이 쓰는 키 ${used.size}개 실재 · 죽은 키 0(⏸ 예정 ${PLANNED.size}) · SELF-TEST 통과`,
);
