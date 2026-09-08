#!/usr/bin/env node
/**
 * check:chars — 제어문자 스윕 (`docs/README.md` §3).
 *
 * 🔴 grep 으로는 CR 을 못 잡는다. Git Bash(MSYS)의 GNU grep 3.0 이 CR 을 통째로 지운 채 넘긴다
 *    (2026-09-08 실측: 파일의 CR 4개를 grep 은 0개로 본다). 그래서 이 축은 **바이트로 읽는다.**
 *
 * 규칙:
 *   · TAB(0x09) · LF(0x0a) 는 허용
 *   · CR(0x0d) 은 **바로 뒤가 LF 일 때만** 허용 (CRLF 줄바꿈)
 *     → 줄 중간 CR · lone-CR 은 결함. 경로·정규식이 조용히 틀리는 방식이다
 *   · 나머지 0x00~0x1f 는 전부 결함 (0x08 \b · 0x0b \v · 0x1b \e …)
 *
 * ⚠ CR 을 통째로 금지하면 안 된다 — `core.autocrlf=true` 면 체크아웃 후 전부 CRLF 라
 *    가드가 오탐 덩어리가 되어 꺼진다. 꺼진 가드는 죽은 가드보다 나쁘다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'dist', 'android', 'ios', 'build']);
const EXT = ['.md', '.mjs', '.js', '.ts', '.tsx', '.json', '.sh', '.py', '.yml', '.yaml'];

const TAB = 0x09;
const LF = 0x0a;
const CR = 0x0d;

/** 결함 바이트 목록을 돌려준다. [{ offset, byte }] */
export function scan(buf) {
  const bad = [];
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b >= 0x20 || b === TAB || b === LF) continue;
    if (b === CR && i + 1 < buf.length && buf[i + 1] === LF) continue;
    bad.push({ offset: i, byte: b });
  }
  return bad;
}

// ── 🔴 양성 대조 — 판정 함수가 살아 있는지 먼저 증명한다 ──────────────────
function selfTest() {
  const cases = [
    ['정상 CRLF', Buffer.from('a\r\nb\r\n', 'latin1'), 0],
    ['정상 LF', Buffer.from('a\nb\n', 'latin1'), 0],
    ['줄 중간 CR', Buffer.from('D:\\emu\rlate\n', 'latin1'), 1],
    ['CRLF 안의 줄 중간 CR', Buffer.from('ok\r\nD:\\e\rread\r\n', 'latin1'), 1],
    ['lone-CR 개행', Buffer.from('a\rb\rc\r', 'latin1'), 3],
    ['0x08 (\\b)', Buffer.from('re/\bt/\n', 'latin1'), 1],
    ['0x0b (\\v)', Buffer.from('C:\\p\volley\n', 'latin1'), 1],
    ['TAB 은 정상', Buffer.from('a\tb\n', 'latin1'), 0],
  ];
  let ok = true;
  for (const [name, buf, want] of cases) {
    const got = scan(buf).length;
    if (got !== want) {
      console.error(`SELF-TEST FAIL: ${name} → ${got}건 (기대 ${want})`);
      ok = false;
    }
  }
  if (!ok) {
    console.error('  판정 함수가 깨졌다. 이 상태의 초록은 거짓이다.');
    process.exit(2);
  }
}
selfTest();
// ──────────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const hits = [];
for (const p of files) {
  const bad = scan(readFileSync(p));
  if (bad.length) {
    const first = bad[0];
    hits.push(
      `${relative(ROOT, p)} — ${bad.length}건, 첫 위치 offset ${first.offset} (0x${first.byte
        .toString(16)
        .padStart(2, '0')})`,
    );
  }
}

if (hits.length) {
  console.error(`check:chars FAIL (${hits.length}개 파일)`);
  for (const h of hits) console.error('  ' + h);
  console.error('  🔴 정규식에 든 것부터 봐라 — 조용히 아무것도 안 잡는 가드가 된다.');
  process.exit(1);
}
console.log(`check:chars OK — ${files.length}개 파일 · SELF-TEST 8케이스 통과`);
