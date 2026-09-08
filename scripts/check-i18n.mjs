#!/usr/bin/env node
/**
 * check:i18n — 다국어 가드 (`docs/I18N_SYSTEM.md` §5).
 *
 * 보는 것 넷:
 *   ① 키 누락    en 에 있고 다른 언어에 없는 키
 *   ② 키 잉여    다른 언어에만 있는 키
 *   ③ 보간 일치  같은 키의 {{변수}} 집합이 언어 간 동일한가
 *   ④ 잔존 한글  비한국어 파일에 한글이 남아 있는가
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

if (fail.length) {
  console.error(`check:i18n FAIL (${fail.length})`);
  for (const m of fail) console.error('  ' + m);
  process.exit(1);
}
console.log(`check:i18n OK — ${files.length}개 언어 · ${baseKeys.length}키 · SELF-TEST 통과`);
