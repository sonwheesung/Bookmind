#!/usr/bin/env node
/**
 * check:ocr — OCR 다섯 축(`docs/KNOWLEDGE_SYSTEM.md` §2.3).
 *
 * ⚠ **인식 정확도는 잴 수 없다.** 모델은 네이티브에 있고 node 에 없다.
 *    여기서 재는 것은 **우리 코드가 정하는 것**뿐이다: 스크립트 · 줄 합치기 · 저장 가능 · 정리 · 네트워크.
 *
 * 🔴 그래서 이 가드는 "OCR 이 잘 된다"를 증명하지 않는다. 그건 빌드에서만 본다(`BUILD.md`).
 *    증명하는 것은 **모델이 잘 읽어 줘도 우리가 망가뜨리지 않는다**이다.
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 검사 실패는 exit 1.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SCRIPTS,
  canSaveText,
  cleanupTarget,
  joinBlocks,
  lineJoiner,
  scriptForLanguage,
} from '../features/ocr/compute.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const block = (...lines) => ({ lines: lines.map((text) => ({ text })) });

// ── 🔴 SELF-TEST ─────────────────────────────────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };

  // ① 🔴 양성 대조 — 스크립트 고르기가 **실제로 갈라지는가**.
  //    늘 'latin' 을 돌려주는 함수도 아래 ①-검사 절반을 통과한다. 먼저 그걸 배제한다
  if (scriptForLanguage('ko') === scriptForLanguage('en')) fail('ko 와 en 이 같은 스크립트로 간다');
  if (new Set(SCRIPTS).size !== SCRIPTS.length) fail('스크립트 목록에 중복이 있다');
  if (SCRIPTS.length < 2) fail('스크립트가 하나뿐이다');

  // ② 🔴 양성 대조 — 줄 이음표가 스크립트마다 다른가. 늘 같으면 축 ③ 이 뜻이 없다
  if (lineJoiner('korean') === lineJoiner('latin')) fail('CJK 와 라틴의 줄 이음이 같다');
  if (lineJoiner('latin') !== ' ') fail('라틴이 공백으로 안 잇는다');
  if (lineJoiner('korean') !== '') fail('한국어가 공백으로 이어진다');

  // ③ 🔴 양성 대조 — 저장 판정이 **양쪽을 다 낼 수 있는가**
  if (canSaveText('책 문장') !== true) fail('멀쩡한 글을 저장 못 한다고 한다');
  if (canSaveText('') !== false) fail('빈 글을 저장할 수 있다고 한다');

  // ④ 합치기가 **무언가를 만들어 내는가**(빈 문자열만 돌려주는 함수가 아닌가)
  if (joinBlocks([block('가')], 'korean') !== '가') fail('한 줄도 못 잇는다');
}

// ── 본검사 ───────────────────────────────────────────────────────────
selfTest();

const bad = [];
const check = (cond, msg) => {
  if (!cond) bad.push(msg);
};

// ── ① 스크립트 기본값 ──
check(scriptForLanguage('ko') === 'korean', '① ko 가 한국어 모델이 아니다');
check(scriptForLanguage('ko-KR') === 'korean', '① 지역 코드가 붙으면 못 읽는다');
check(scriptForLanguage('en') === 'latin', '① en 이 라틴이 아니다');
check(scriptForLanguage('en-US') === 'latin', '① en-US 가 라틴이 아니다');
check(scriptForLanguage('ja') === 'japanese', '① ja 가 일본어가 아니다');
check(scriptForLanguage('zh-Hans') === 'chinese', '① zh-Hans 가 중국어가 아니다');
check(scriptForLanguage('hi') === 'devanagari', '① hi 가 데바나가리가 아니다');
// 🔴 모르는 언어는 라틴이다. 한국어로 떨어뜨리면 글로벌 기본값(§9)이 뒤집힌다
check(scriptForLanguage('de') === 'latin', '① 모르는 언어가 라틴으로 안 간다');
check(scriptForLanguage('') === 'latin', '① 빈 언어 코드가 라틴으로 안 간다');
check(scriptForLanguage('KO') === 'korean', '① 대문자 언어 코드를 못 읽는다');

// ── ② 빈 결과 ──
check(!canSaveText(''), '② 빈 문자열로 저장이 열린다');
check(!canSaveText('   '), '② 공백만으로 저장이 열린다');
check(!canSaveText('\n\n'), '② 줄바꿈만으로 저장이 열린다');
check(canSaveText(' 가 '), '② 앞뒤 공백이 있는 멀쩡한 글이 막힌다');

// ── 🔴 ③ 줄 합치기 ──
const ko = joinBlocks([block('목표보다', '시스템이', '중요하다')], 'korean');
check(ko === '목표보다시스템이중요하다', `③ 🔴 한국어에 없던 띄어쓰기가 생겼다: ${JSON.stringify(ko)}`);

const en = joinBlocks([block('Systems beat', 'goals every time.')], 'latin');
check(en === 'Systems beat goals every time.', `③ 🔴 라틴 낱말이 붙어 버렸다: ${JSON.stringify(en)}`);

// 블록끼리는 줄바꿈으로 나뉜다
const two = joinBlocks([block('첫 문단'), block('둘째 문단')], 'korean');
check(two === '첫 문단\n둘째 문단', `③ 블록 경계가 사라졌다: ${JSON.stringify(two)}`);

// 🔴 줄을 잃지 않는다. 빈 줄만 버린다
const kept = joinBlocks([block('a', '', '  ', 'b')], 'latin');
check(kept === 'a b', `③ 빈 줄 처리가 틀렸다: ${JSON.stringify(kept)}`);

const many = joinBlocks([block('1', '2', '3', '4', '5')], 'latin');
check(many === '1 2 3 4 5', `③ 🔴 줄을 잃었다: ${JSON.stringify(many)}`);

// 아무것도 없으면 빈 문자열이고, 그러면 ② 가 저장을 막는다
check(joinBlocks([], 'latin') === '', '③ 빈 입력이 빈 문자열이 아니다');
check(joinBlocks([block('', '  ')], 'latin') === '', '③ 빈 줄만 있는 블록이 남았다');
check(!canSaveText(joinBlocks([block('  ')], 'korean')), '③+② 빈 인식 결과로 저장이 열린다');

// 각 줄의 앞뒤 공백은 정리한다. 안 하면 라틴에서 공백이 세 개가 된다
const spacey = joinBlocks([block('  Systems  ', '  beat goals  ')], 'latin');
check(spacey === 'Systems beat goals', `③ 줄 안팎 공백 정리가 틀렸다: ${JSON.stringify(spacey)}`);

// ── 🔴 ④ 이미지 정리 ──
check(
  cleanupTarget('file:///data/user/0/cache/x.jpg') === 'file:///data/user/0/cache/x.jpg',
  '④ 🔴 우리가 만든 임시 파일을 지울 대상으로 안 잡는다',
);
// 🔴 사진 라이브러리 원본은 사용자 것이다. 지우면 안 된다
check(
  cleanupTarget('content://media/external/images/1') === null,
  '④ 🔴 앨범 원본을 지우려 한다. 그건 사용자의 사진이다',
);
check(cleanupTarget('https://example.com/a.jpg') === null, '④ 원격 URL 을 지우려 한다');
check(cleanupTarget('') === null, '④ 빈 경로를 지우려 한다');

// ── ⑤ 네트워크 0건 ──
//
// 🔴 온디바이스라는 것이 결정 #20 의 근거 전체다. 소스에서 통로가 생기면 그 근거가 무너진다.
function sources(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const NET = /\b(fetch|XMLHttpRequest|WebSocket|axios)\s*\(/;
const ocrFiles = sources(join(ROOT, 'features', 'ocr'));
check(ocrFiles.length >= 2, `⑤ 대조군이 부족하다. OCR 소스가 ${ocrFiles.length}개다`);
for (const f of ocrFiles) {
  const text = readFileSync(f, 'utf8');
  check(!NET.test(text), `⑤ 🔴 ${f.replace(ROOT, '')} 에 네트워크 통로가 있다. 온디바이스가 깨진다`);
}
// 🔴 양성 대조: 정규식이 실제로 무언가를 잡는가
check(NET.test('const r = await fetch("x")'), '⑤ 🔴 네트워크 정규식이 아무것도 안 잡는다');

if (bad.length > 0) {
  console.error(`\ncheck:ocr 실패 ${bad.length}건:\n`);
  for (const m of bad) console.error(`  ✗ ${m}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\ncheck:ocr OK — 스크립트 기본값 10종 · 빈 결과 · 🔴 줄 합치기(CJK 무공백 · 라틴 공백) ·` +
    `\n  🔴 앨범 원본 보호 · 네트워크 0건(소스 ${ocrFiles.length}개)` +
    `\n  ⚠ 인식 정확도는 못 잰다. 그건 빌드에서만 본다\n`,
);
