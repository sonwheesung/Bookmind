#!/usr/bin/env node
/**
 * check:ocr — OCR 열 축(`docs/KNOWLEDGE_SYSTEM.md` §2.3).
 *
 * ⚠ **인식 정확도는 잴 수 없다.** 모델은 네이티브에 있고 node 에 없다.
 *    여기서 재는 것은 **우리 코드가 정하는 것**뿐이다: 스크립트 · 줄 합치기 · 저장 가능 · 정리 ·
 *    네트워크 · 읽기 순서 · 좌표 배율 · 좌표 없는 줄 폴백(뒤의 셋은 결정 #22 로 생겼다).
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
  canSaveSelection,
  canSaveText,
  cleanupTarget,
  collectLines,
  displayHeight,
  joinBlocks,
  joinSelected,
  lineJoiner,
  needsFallback,
  readingOrder,
  scaleBoxes,
  scriptForLanguage,
} from '../features/ocr/compute.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const block = (...lines) => ({ lines: lines.map((text) => ({ text })) });

/** 좌표가 있는 줄. `k` 는 해상도 배수(같은 배치를 픽셀만 키운다) */
const at = (text, left, top, width, height, k = 1) => ({
  text,
  frame: { left: left * k, top: top * k, width: width * k, height: height * k },
});
const framed = (...lines) => ({ lines });
const ids = (lines) => lines.map((l) => l.id).join(',');
const texts = (lines) => lines.map((l) => l.text).join('|');

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

  // ⑤ 🔴 양성 대조 — 줄 모으기가 **실제로 줄을 만들어 내는가**.
  //    늘 빈 배열을 돌려주는 함수는 축 ⑥⑦⑧ 의 절반을 통과한다
  const one = collectLines([framed(at('가', 0, 0, 10, 10))]);
  if (one.lines.length !== 1) fail('좌표가 멀쩡한 줄을 못 모은다');
  if (one.missingFrames !== 0) fail('멀쩡한 줄을 좌표 없는 것으로 센다');

  // ⑥ 🔴 양성 대조 — 정렬이 **순서를 바꿀 수 있는가**. 입력을 그대로 돌려주는 함수를 배제한다
  const shuffled = [at('아래', 0, 100, 50, 20), at('위', 0, 0, 50, 20)].map((l, i) => ({
    id: String(i),
    text: l.text,
    frame: l.frame,
  }));
  if (texts(readingOrder(shuffled)) !== '위|아래') fail('정렬이 순서를 바꾸지 못한다');

  // ⑦ 🔴 양성 대조 — 배율이 **값을 실제로 바꾸는가**. 원본을 그대로 돌려주는 함수를 배제한다
  const box = scaleBoxes([{ id: 'a', text: 'x', frame: { left: 10, top: 20, width: 30, height: 40 } }], 100, 50);
  if (box.length !== 1) fail('박스를 하나도 안 만든다');
  if (box[0].left === 10) fail('배율이 좌표를 안 바꾼다(늘 원본을 돌려준다)');

  // ⑧ 폴백 판정이 **양쪽을 다 낼 수 있는가**
  if (needsFallback(0) !== false) fail('빠진 줄이 없는데 폴백이 필요하다고 한다');
  if (needsFallback(1) !== true) fail('빠진 줄이 있는데 폴백이 필요 없다고 한다');
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

// ── 🔴 ⑥ 읽기 순서 (결정 #22 · §2.2) ──
//
// 🔴 **입력을 일부러 뒤섞어 넣는다.** 이미 정렬된 입력으로 재면 정렬을 통째로 없애도 초록이 유지된다.
//    이 프로젝트가 같은 자리를 세 번 밟았다(`100%` 이스케이프 · `weekCells` 월요일 · 그리고 여기).
const page = collectLines([
  framed(
    at('셋째 줄', 40, 200, 300, 30),
    at('첫째 줄', 40, 100, 300, 30),
    at('둘째 줄 오른쪽', 200, 150, 140, 30),
    at('둘째 줄 왼쪽', 40, 152, 150, 30),
  ),
]);
check(page.lines.length === 4, `⑥ 줄을 다 못 모았다: ${page.lines.length}`);
const ordered = texts(readingOrder(page.lines));
check(
  ordered === '첫째 줄|둘째 줄 왼쪽|둘째 줄 오른쪽|셋째 줄',
  `⑥ 🔴 읽기 순서가 틀렸다: ${ordered}`,
);

// 🔴 같은 줄 판정이 **해상도에 딸리지 않는다.** 책담은 고정 10px 을 썼고, 그 값은 사진 크기에 딸린다.
//    같은 배치를 픽셀만 여덟 배로 키워 같은 순서가 나오는지 잰다.
const big = collectLines([
  framed(
    at('셋째 줄', 40, 200, 300, 30, 8),
    at('첫째 줄', 40, 100, 300, 30, 8),
    at('둘째 줄 오른쪽', 200, 150, 140, 30, 8),
    at('둘째 줄 왼쪽', 40, 152, 150, 30, 8),
  ),
]);
check(
  texts(readingOrder(big.lines)) === ordered,
  `⑥ 🔴 해상도가 바뀌자 읽기 순서가 달라졌다: ${texts(readingOrder(big.lines))}`,
);

// 고른 것만 나온다 · 스크립트별 구분자를 지킨다
const sel = new Set([page.lines[1].id, page.lines[0].id]);
check(
  joinSelected(page.lines, sel, 'korean') === '첫째 줄셋째 줄',
  `⑥ 한국어에 없던 띄어쓰기가 생겼다: ${JSON.stringify(joinSelected(page.lines, sel, 'korean'))}`,
);
check(
  joinSelected(page.lines, sel, 'latin') === '첫째 줄 셋째 줄',
  `⑥ 라틴에서 낱말이 붙었다: ${JSON.stringify(joinSelected(page.lines, sel, 'latin'))}`,
);
check(joinSelected(page.lines, new Set(), 'korean') === '', '⑥ 아무것도 안 골랐는데 글이 나온다');
check(!canSaveSelection(page.lines, new Set(), 'korean'), '⑥ 🔴 하나도 안 골랐는데 저장이 열린다');
check(canSaveSelection(page.lines, sel, 'korean'), '⑥ 골랐는데 저장이 막힌다');
// 🔴 없는 id 를 골라도 조용히 통과하지 않는다(빈 결과 → 저장 잠김)
check(!canSaveSelection(page.lines, new Set(['없는-id']), 'korean'), '⑥ 없는 id 로 저장이 열린다');

// ── 🔴 ⑦ 좌표 배율 (§2.2.1) ──
const boxes = scaleBoxes(page.lines, 1000, 500);
check(boxes.length === 4, `⑦ 박스 수가 안 맞는다: ${boxes.length}`);
const first = boxes.find((b) => b.id === page.lines[1].id);
check(first !== undefined, '⑦ id 가 박스에 안 실린다');
check(
  first.left === 20 && first.top === 50 && first.width === 150 && first.height === 15,
  `⑦ 🔴 환산이 틀렸다: ${JSON.stringify(first)}`,
);
// 🔴 배치 전(폭 0)에는 아무것도 그리지 않는다. 안 그러면 박스가 왼쪽 위에 뭉친다
check(scaleBoxes(page.lines, 1000, 0).length === 0, '⑦ 🔴 표시 폭이 0 인데 박스를 그린다');
check(scaleBoxes(page.lines, 0, 500).length === 0, '⑦ 🔴 원본 폭이 0 인데 박스를 그린다');
// 🔴 표시 높이가 박스와 **같은 배율**을 쓴다. 다르면 사진과 박스가 어긋난다
check(displayHeight(1000, 2000, 500) === 1000, `⑦ 표시 높이가 틀렸다: ${displayHeight(1000, 2000, 500)}`);
check(displayHeight(0, 2000, 500) === 0, '⑦ 원본 폭이 0 인데 높이가 나온다');
const k = displayHeight(1000, 1000, 500) / 1000;
check(
  Math.abs(boxes[0].left - page.lines[0].frame.left * k) < 1e-9,
  '⑦ 🔴 박스 배율과 표시 높이 배율이 다르다',
);

// ── 🔴 ⑧ 좌표 없는 줄 폴백 (§2.2) ──
const mixed = [
  framed(
    at('좌표 있다', 40, 100, 300, 30),
    { text: '좌표가 없다' },
    { text: '너비가 0 이다', frame: { left: 0, top: 0, width: 0, height: 10 } },
  ),
];
const m = collectLines(mixed);
check(m.lines.length === 1, `⑧ 고를 수 있는 줄 수가 틀렸다: ${m.lines.length}`);
check(m.missingFrames === 2, `⑧ 🔴 빠진 줄을 안 센다: ${m.missingFrames}`);
check(needsFallback(m.missingFrames), '⑧ 🔴 빠진 줄이 있는데 폴백을 안 켠다');
// 🔴 그 문장을 **가져올 길이 남아 있어야** 한다. 폴백 경로(전체 텍스트)에 그대로 있다
const fallbackText = joinBlocks(mixed, 'korean');
check(
  fallbackText.includes('좌표가 없다') && fallbackText.includes('너비가 0 이다'),
  `⑧ 🔴 좌표 없는 줄이 폴백에서도 사라졌다: ${JSON.stringify(fallbackText)}`,
);
check(!needsFallback(collectLines([framed(at('가', 0, 0, 10, 10))]).missingFrames), '⑧ 멀쩡한데 폴백을 켠다');
// id 가 블록을 넘어 겹치지 않는다
const twoBlocks = collectLines([framed(at('a', 0, 0, 10, 10)), framed(at('b', 0, 20, 10, 10))]);
check(new Set(twoBlocks.lines.map((l) => l.id)).size === 2, `⑧ id 가 겹친다: ${ids(twoBlocks.lines)}`);

// ── 🔴 ⑨ 화면이 판정을 거치나 (결정 #22) ──
//
// 🔴 순수 함수를 만들어 두고 화면이 안 쓰면 아무것도 안 지킨 것이다.
const scan = readFileSync(join(ROOT, 'app', 'knowledge', 'scan.tsx'), 'utf8');
check(scan.includes('scaleBoxes('), '⑨ 🔴 화면이 `scaleBoxes` 를 안 쓴다(좌표를 직접 계산하고 있다)');
check(scan.includes('displayHeight('), '⑨ 🔴 화면이 `displayHeight` 를 안 쓴다(배율이 둘이 된다)');
check(scan.includes('joinSelected('), '⑨ 🔴 화면이 `joinSelected` 를 안 쓴다');
// 🔴 옛 경로: 인식 결과를 통째로 편집 칸에 부어 넣던 코드. 그게 결정 #22 가 뒤집은 그것이다
check(
  !/setText\(\s*out\s*\)/.test(scan),
  '⑨ 🔴 화면이 인식 결과를 통째로 편집 칸에 붓는다(결정 #22 이전 코드다)',
);
check(/setText\(\s*out\s*\)/.test('setText(out)'), '⑨ 🔴 옛 코드를 찾는 정규식이 아무것도 안 잡는다');

// ── 🔴 ⑩ 폴백이 화면까지 이어지나 ──
check(scan.includes('needsFallback('), '⑩ 🔴 화면이 `needsFallback` 을 안 쓴다');
check(scan.includes('fallbackText'), '⑩ 🔴 화면이 폴백 텍스트를 안 쓴다(그 줄을 가져올 길이 없다)');

if (bad.length > 0) {
  console.error(`\ncheck:ocr 실패 ${bad.length}건:\n`);
  for (const m of bad) console.error(`  ✗ ${m}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\ncheck:ocr OK — 스크립트 기본값 10종 · 빈 결과 · 🔴 줄 합치기(CJK 무공백 · 라틴 공백) ·` +
    `\n  🔴 앨범 원본 보호 · 네트워크 0건(소스 ${ocrFiles.length}개)` +
    `\n  🔴 읽기 순서(입력을 뒤섞어 잼 · 해상도 8배에도 같은 순서) · 좌표 배율(폭 0 이면 안 그린다) ·` +
    `\n  🔴 좌표 없는 줄 폴백(그 문장을 잃지 않는다) · 화면 배선(scaleBoxes·displayHeight·joinSelected·폴백)` +
    `\n  ⚠ 인식 정확도는 못 잰다. 그건 빌드에서만 본다\n`,
);
