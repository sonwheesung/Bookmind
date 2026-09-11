# 스토어 스크린샷 합성 — 캡처를 1080x1920(9:16) 캔버스에 얹는다.
#
# 🔴 우리 AVD(reread · pixel_6)는 1080x2400(9:20)이라 캡처 그대로는 Play 규격이 아니다.
#    Play 휴대전화 스크린샷은 비율 2:1 이내를 요구하는데 9:20 은 2.22 로 초과한다.
#
# 🔴 **그렇다고 `hw.lcd.height` 를 임의로 바꾸지 않는다.** `common/EMULATOR_POOL.md` §1.3 이
#    *"스토어 스크린샷 규격과 얽힌다. 필요하면 사용자에게 알리고 판단을 받는다"* 로 못 박아 뒀다.
#    그래서 형제 앱(LinkMemo `scripts/compose-store-shot.py`)과 같은 방법을 쓴다.
#    캡처를 줄여서 얹고 남는 자리를 브랜드 색으로 채운다.
#
# 🔴 **캡처를 자르지 않는다.** 자르면 레이아웃이 잘리고, 그러면 스크린샷이 앱을 잘못 보여준다.
#    비율을 유지한 채 축소해서 통째로 넣는다.
#
# 색은 `theme/tokens.ts` 와 `docs/DESIGN_REVIEW.md` §3 에서 온다. 여기서 새로 정하지 않는다.
#
# 실행: python scripts/compose-store-shot.py <입력.png> <출력.png> "<제목>" ["<부제>"]
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
ACCENT = (0x3A, 0x5A, 0x73)  # #3A5A73 — 브랜드
PAPER = (0xFB, 0xFA, 0xF7)  # #FBFAF7
SUB = (0xC8, 0xD6, 0xE0)

# 🔴 맑은 고딕을 쓴다. 한글 글리프가 없는 폰트를 쓰면 두부(□)가 난다.
#    결정 #13 이 앱 안에서 시스템 폰트를 고른 이유와 같은 문제다.
FONT_BOLD = "C:/Windows/Fonts/malgunbd.ttf"
FONT_REG = "C:/Windows/Fonts/malgun.ttf"


def load(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def compose(src_path, out_path, title, subtitle=""):
    shot = Image.open(src_path).convert("RGB")

    canvas = Image.new("RGB", (W, H), ACCENT)
    draw = ImageDraw.Draw(canvas)

    # ── 글자 영역을 위에, 기기 화면을 아래에 ──────────────────────────
    pad = 64
    text_top = 96
    f_title = load(FONT_BOLD, 68)
    f_sub = load(FONT_REG, 38)

    draw.text((pad, text_top), title, font=f_title, fill=PAPER)
    y = text_top + 92
    if subtitle:
        draw.text((pad, y), subtitle, font=f_sub, fill=SUB)
        y += 60

    # ── 캡처를 남은 자리에 비율 유지로 넣는다 ─────────────────────────
    top = y + 48
    avail_h = H - top - 40
    avail_w = W - pad * 2
    scale = min(avail_w / shot.width, avail_h / shot.height)
    new_w = int(shot.width * scale)
    new_h = int(shot.height * scale)
    shot = shot.resize((new_w, new_h), Image.LANCZOS)

    x = (W - new_w) // 2
    # 기기처럼 보이게 얇은 테두리만 둔다
    draw.rectangle([x - 3, top - 3, x + new_w + 2, top + new_h + 2], fill=(0x2A, 0x44, 0x59))
    canvas.paste(shot, (x, top))

    canvas.save(out_path, "PNG", optimize=True)
    ratio = H / W
    print(f"  {out_path}  {W}x{H}  비율 {ratio:.2f} (Play 상한 2.00 이내)")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("사용법: python scripts/compose-store-shot.py <입력.png> <출력.png> <제목> [부제]")
        sys.exit(2)
    compose(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "")
