#!/usr/bin/env node
/**
 * 아이콘 생성기 — `docs/DESIGN_REVIEW.md` §3 의 A안(두 페이지 + 콜론)을 PNG 로 그린다.
 *
 * 🔴 **왜 스크립트인가**: 아이콘은 네 장이고 규격이 서로 다르다(안전 영역 · 단색 · 96px).
 *    손으로 만들면 한 장을 고칠 때 나머지 셋이 어긋나고, 그 어긋남은 **기기에서만 보인다**.
 *    한 곳에서 같은 도형을 그려 네 장을 함께 낸다.
 *
 * 🔴 **왜 SVG 가 아닌가**: ChatGPT 가 SVG 코드블록을 두 번 **빈 채로** 보냈다(2026-09-09).
 *    컨셉·색·규격은 확정됐으므로 그 사양대로 도형을 직접 그린다. SVG 툴체인을 안 들인다.
 *
 * 실행: `node scripts/make-icons.mjs`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'icons');

/** `docs/DESIGN_REVIEW.md` §3 에서 확정한 값 */
const PAPER = [0xfb, 0xfa, 0xf7]; // #FBFAF7
const ACCENT = [0x3a, 0x5a, 0x73]; // #3A5A73
const WHITE = [0xff, 0xff, 0xff];

// ── 아주 작은 PNG 라이터 (RGBA, 무손실) ────────────────────────────────
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** `px[y][x] = [r,g,b,a]` 를 PNG 파일로 */
function writePng(path, size, px) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const c = px[y][x];
      raw[p++] = c[0];
      raw[p++] = c[1];
      raw[p++] = c[2];
      raw[p++] = c[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  return png.length;
}

// ── 도형 ──────────────────────────────────────────────────────────────
/**
 * A안 — 두 페이지가 마주 보고, 가운데 여백이 `Re:Read` 의 콜론을 만든다.
 *
 * 🔴 **좌표는 1024 기준의 비율로 쓴다.** 96px 알림 아이콘도 같은 함수로 그려야
 *    두 아이콘의 형태가 어긋나지 않는다.
 * ⚠ 적응형 전경은 바깥 33% 가 잘릴 수 있어 도형이 **가운데 66%(174~850)** 안에 있어야 한다.
 */
function shapeCoverage(u, v, tight) {
  // u,v: 0..1 정규화 좌표
  const half = tight ? 0.36 : 0.33; // 아이콘 본체 반폭(비율)
  const cx = 0.5;
  const cy = 0.5;
  const pageH = tight ? 0.56 : 0.51;
  const gap = tight ? 0.1 : 0.094;
  const r = tight ? 0.035 : 0.028; // 모서리 반지름

  const top = cy - pageH / 2;
  const bot = cy + pageH / 2;
  const leftL = cx - half;
  const rightL = cx - gap / 2;
  const leftR = cx + gap / 2;
  const rightR = cx + half;

  const inRounded = (x0, x1) => {
    if (u < x0 || u > x1 || v < top || v > bot) return false;
    // 모서리 둥글리기
    const dx = Math.min(u - x0, x1 - u);
    const dy = Math.min(v - top, bot - v);
    if (dx >= r || dy >= r) return true;
    return (dx - r) * (dx - r) + (dy - r) * (dy - r) <= r * r;
  };

  if (inRounded(leftL, rightL) || inRounded(leftR, rightR)) return true;

  // 🔴 콜론 — 가운데 여백에 점 둘. 이것이 `Re:Read` 의 `:` 이다
  const dot = tight ? 0.032 : 0.026;
  for (const dy of [-0.115, 0.115]) {
    const ddx = u - cx;
    const ddy = v - (cy + dy);
    if (ddx * ddx + ddy * ddy <= dot * dot) return true;
  }
  return false;
}

/** 4x 슈퍼샘플링. 🔴 96px 에서 계단이 보이면 알림 아이콘이 지저분해진다 */
function render(size, fg, bg, tight) {
  const px = [];
  const S = 4;
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const u = (x + (sx + 0.5) / S) / size;
          const v = (y + (sy + 0.5) / S) / size;
          if (shapeCoverage(u, v, tight)) hit++;
        }
      }
      const a = hit / (S * S);
      if (bg === null) {
        row.push([fg[0], fg[1], fg[2], Math.round(a * 255)]);
      } else {
        row.push([
          Math.round(bg[0] + (fg[0] - bg[0]) * a),
          Math.round(bg[1] + (fg[1] - bg[1]) * a),
          Math.round(bg[2] + (fg[2] - bg[2]) * a),
          255,
        ]);
      }
    }
    px.push(row);
  }
  return px;
}

mkdirSync(OUT, { recursive: true });

const made = [];
// ① 런처 아이콘(적응형이 아닌 기기용) — 배경을 굽는다
made.push(['icon.png', 1024, writePng(join(OUT, 'icon.png'), 1024, render(1024, PAPER, ACCENT, true))]);
// ② 적응형 전경 — 🔴 투명 배경. 배경색은 app.json 이 지정한다
made.push([
  're-read-foreground.png',
  1024,
  writePng(join(OUT, 're-read-foreground.png'), 1024, render(1024, PAPER, null, false)),
]);
// ③ Android 13+ 테마 아이콘 — 🔴 흰 단색. 색은 OS 가 정한다
made.push([
  're-read-monochrome.png',
  1024,
  writePng(join(OUT, 're-read-monochrome.png'), 1024, render(1024, WHITE, null, false)),
]);
// ④ 알림 — 🔴 흰 실루엣 + 투명. 안드로이드는 알파만 쓰고 색을 버린다
made.push([
  're-read-notification.png',
  96,
  writePng(join(OUT, 're-read-notification.png'), 96, render(96, WHITE, null, true)),
]);

for (const [name, size, bytes] of made) {
  console.log(`  ${name.padEnd(26)} ${String(size).padStart(4)}px  ${String(bytes).padStart(7)} bytes`);
}
console.log(`아이콘 ${made.length}장 생성 — ${OUT}`);
