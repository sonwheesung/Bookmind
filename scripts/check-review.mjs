#!/usr/bin/env node
/**
 * check:review — 복습 규칙을 **값으로** 잰다(`docs/REVIEW_SYSTEM.md` §2.1~§2.3 · §3.1).
 *
 * 🔴 왜 가드로 두나: 여기 걸린 것들은 **기기에서 재현하기 어려운 축**이다 —
 *    자정 경계·시간대·밀린 카드 200장·이모지 경계. 손으로 밟으면 한 번 보고 다시는 안 본다.
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 검사 실패는 exit 1.
 */
import { pickCue, CUE_HEAD_CHARS } from '../features/review/cue.ts';
import { DAILY_LIMIT, endOfLocalDay, firstDueAt, takeDue } from '../features/review/queue.ts';

// ── 🔴 SELF-TEST — 판정 함수가 살아 있는가 ───────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };

  // ① pickCue 가 실제로 갈래를 가르는가 (한 갈래만 돌려주면 아래 검사가 무의미하다)
  const kinds = new Set([
    pickCue({ content: 'x'.repeat(50), thought: '생각' }).kind,
    pickCue({ content: 'x'.repeat(50), bookTitle: '책' }).kind,
    pickCue({ content: 'x'.repeat(50), tags: ['t'] }).kind,
    pickCue({ content: 'x'.repeat(50) }).kind,
  ]);
  if (kinds.size !== 4) fail(`pickCue 가 갈래를 못 가른다 — ${[...kinds].join(',')}`);

  // ② takeDue 가 실제로 자르는가 / 안 자를 때도 있는가
  const many = Array.from({ length: 5 }, (_, i) => ({ knowledge_id: `k${i}`, due_at: `2026-09-0${i + 1}` }));
  if (takeDue(many, 2).length !== 2) fail('takeDue 가 상한을 안 지킨다');
  if (takeDue(many, 99).length !== 5) fail('상한이 넉넉한데도 잘랐다');

  // ③ endOfLocalDay 가 시각을 실제로 옮기는가
  const a = endOfLocalDay(new Date(2026, 8, 9, 1, 0, 0));
  const b = endOfLocalDay(new Date(2026, 8, 9, 23, 0, 0));
  if (a !== b) fail('같은 날인데 하루의 끝이 다르게 나온다');
  if (endOfLocalDay(new Date(2026, 8, 10, 1, 0, 0)) === a) fail('다음 날인데 하루의 끝이 같다');
}

// ── 검사 ─────────────────────────────────────────────────────────────
const bad = [];
const check = (cond, msg) => {
  if (!cond) bad.push(msg);
};

function checkCue() {
  const long = '목표보다 시스템을 만드는 것이 중요하다는 이야기';

  // §3.1 우선순위 — 있는 것부터
  check(
    pickCue({ content: long, thought: ' 내 생각 ', bookTitle: '책', tags: ['t'] }).kind === 'thought',
    '내 생각이 1순위가 아니다',
  );
  check(
    pickCue({ content: long, bookTitle: '책', page: '123p', tags: ['t'] }).kind === 'source',
    '책·페이지가 2순위가 아니다',
  );
  check(pickCue({ content: long, tags: ['습관'] }).kind === 'tags', '태그가 3순위가 아니다');
  check(pickCue({ content: long }).kind === 'head', '단서가 없을 때 앞 글자가 안 나온다');

  // 공백만 있는 값은 단서가 아니다
  check(pickCue({ content: long, thought: '   ' }).kind !== 'thought', '공백뿐인 생각을 단서로 썼다');
  check(
    pickCue({ content: long, bookTitle: '  ', page: '  ' }).kind !== 'source',
    '공백뿐인 출처를 단서로 썼다',
  );
  check(pickCue({ content: long, tags: ['', '  '] }).kind !== 'tags', '공백뿐인 태그를 단서로 썼다');

  // 🔴 앞 글자 단서는 원문보다 짧아야 한다 — 다 보여주면 회상이 아니다
  const head = pickCue({ content: long });
  check(head.text.endsWith('…'), '앞 글자 단서에 말줄임이 없다');
  check(
    [...head.text].length === CUE_HEAD_CHARS + 1,
    `앞 글자 수가 ${CUE_HEAD_CHARS} 가 아니다: ${head.text}`,
  );

  // 짧은 원문은 단서를 아예 주지 않는다(§8 엣지 케이스)
  check(pickCue({ content: '짧다' }).kind === 'none', '짧은 원문인데 앞 글자를 보여줬다');
  check(
    pickCue({ content: 'x'.repeat(CUE_HEAD_CHARS) }).kind === 'none',
    '경계(=12자)에서 단서를 줬다 — 다 보여주게 된다',
  );
  check(pickCue({ content: 'x'.repeat(CUE_HEAD_CHARS + 1) }).kind === 'head', '경계+1 에서 단서를 안 줬다');

  // 🔴 이모지·조합 문자를 코드 유닛으로 자르면 글자가 깨진다
  const emoji = pickCue({ content: '🔴'.repeat(20) });
  check([...emoji.text].length === CUE_HEAD_CHARS + 1, '이모지 원문에서 글자 수가 어긋난다');
  check(
    !emoji.text.includes('�') &&
      !/[\uD800-\uDFFF]/.test(emoji.text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')),
    '🔴 서로게이트가 깨졌다 — 반쪽 글자가 화면에 나간다',
  );
}

function checkQueue() {
  // §2.3 저장한 날에는 안 뜬다
  const saved = new Date(2026, 8, 9, 23, 0, 0); // 밤 11시 저장
  const due = firstDueAt(saved);
  check(due > saved.toISOString(), '새 카드가 저장 시점보다 앞에 예약됐다');
  check(due >= endOfLocalDay(saved), '저장한 날 안에 뜬다 — 되읽기가 된다(§2.3)');

  // 자정을 넘기면 뜬다
  const justAfterMidnight = new Date(2026, 8, 10, 0, 30, 0);
  check(due < endOfLocalDay(justAfterMidnight), '자정을 넘겼는데 큐에 안 뜬다');

  // §2.2 밀린 카드 200장 → 상한까지만, 오래된 순
  const backlog = Array.from({ length: 200 }, (_, i) => ({
    knowledge_id: `k${i}`,
    due_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  }));
  const shuffled = [...backlog].reverse();
  const taken = takeDue(shuffled);
  check(taken.length === DAILY_LIMIT, `상한이 ${DAILY_LIMIT} 인데 ${taken.length} 장이 나왔다`);
  check(taken[0]?.knowledge_id === 'k0', '오래된 순이 아니다 — 밀린 것이 계속 밀린다');
  check(taken[DAILY_LIMIT - 1]?.knowledge_id === `k${DAILY_LIMIT - 1}`, '정렬이 어긋난다');

  // 빈 큐
  check(takeDue([]).length === 0, '빈 큐에서 뭔가 나왔다');
}

selfTest();
checkCue();
checkQueue();

if (bad.length > 0) {
  console.error(`check:review FAIL (${bad.length})`);
  for (const m of bad) console.error('  ' + m);
  process.exit(1);
}
console.log(`check:review OK — 단서 4갈래 · 자정 경계 · 상한 ${DAILY_LIMIT} · SELF-TEST 3종`);
