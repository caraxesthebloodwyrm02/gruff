#!/usr/bin/env python3
"""Generate interval-ledger.png — clock-synced tempo, mood, and palette."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / 'canvas-fonts'
OUT = ROOT / 'interval-ledger.png'

W, H = 2400, 3000
M = 140


@dataclass(frozen=True)
class ClockSkin:
    """Tempo + mood + colors derived from local wall clock."""

    tempo: float
    mood: str
    mood_note: str
    paper: tuple[int, int, int]
    ink: tuple[int, int, int]
    muted: tuple[int, int, int]
    grid_dot: tuple[int, int, int]
    accent: tuple[int, int, int]
    fine: tuple[int, int, int]
    bloom: tuple[tuple[int, int, int], ...]


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _piecewise_tempo_base(h: float) -> float:
    """Base BPM from hour-of-day [0,24); morning ~9h peaks ~92."""
    # (hour, tempo)
    nodes = [
        (0.0, 58.0),
        (5.0, 62.0),
        (7.5, 78.0),
        (9.0, 92.5),
        (10.5, 95.0),
        (12.5, 102.0),
        (15.0, 98.0),
        (17.5, 86.0),
        (20.0, 72.0),
        (22.5, 64.0),
        (24.0, 58.0),
    ]
    if h <= 0:
        return nodes[0][1]
    if h >= 24:
        return nodes[-1][1]
    for (h0, t0), (h1, t1) in zip(nodes, nodes[1:]):
        if h0 <= h <= h1:
            u = 0.0 if h1 == h0 else (h - h0) / (h1 - h0)
            return _lerp(t0, t1, u)
    return nodes[-1][1]


def _minute_modulation(now: datetime) -> float:
    """Small BPM sway locked to the minute hand (±~1.5)."""
    m = now.minute + now.second / 60.0
    return 1.45 * math.sin(2 * math.pi * m / 60.0)


def _second_phase(now: datetime) -> float:
    """0..1 phase within the current minute for strip modulation."""
    return (now.second + now.microsecond / 1e6) / 60.0


def compute_skin(now: datetime | None = None) -> ClockSkin:
    now = now or datetime.now()
    h = now.hour + now.minute / 60.0 + now.second / 3600.0
    base = _piecewise_tempo_base(h)
    tempo = max(52.0, min(112.0, base + _minute_modulation(now)))

    # Mood bands (local solar-ish day)
    if 5.0 <= h < 8.0:
        mood, note = 'lift', 'cool dawn · thin air'
        paper, ink, muted, grid_dot, accent, fine = (
            (238, 242, 248),
            (32, 44, 62),
            (110, 122, 138),
            (206, 214, 226),
            (120, 108, 168),
            (190, 198, 210),
        )
        bloom = ((220, 228, 248), (200, 216, 240))
    elif 8.0 <= h < 12.0:
        mood, note = 'bloom', 'morning yellow · opening'
        paper, ink, muted, grid_dot, accent, fine = (
            (253, 249, 232),
            (42, 36, 28),
            (124, 118, 98),
            (236, 224, 186),
            (212, 158, 42),
            (220, 210, 180),
        )
        bloom = (
            (248, 228, 140),
            (240, 210, 110),
            (255, 238, 170),
            (220, 190, 80),
        )
    elif 12.0 <= h < 15.0:
        mood, note = 'glare', 'midday white · high edge'
        paper, ink, muted, grid_dot, accent, fine = (
            (252, 252, 248),
            (28, 32, 36),
            (108, 112, 118),
            (228, 228, 224),
            (196, 88, 62),
            (210, 210, 206),
        )
        bloom = ((255, 244, 220), (240, 236, 230))
    elif 15.0 <= h < 19.0:
        mood, note = 'tide', 'afternoon drift · long shadows'
        paper, ink, muted, grid_dot, accent, fine = (
            (246, 242, 234),
            (34, 38, 44),
            (118, 120, 126),
            (218, 214, 206),
            (158, 92, 72),
            (200, 196, 188),
        )
        bloom = ((235, 210, 180), (220, 200, 170))
    elif 19.0 <= h < 22.0:
        mood, note = 'ember', 'evening warmth · settling'
        paper, ink, muted, grid_dot, accent, fine = (
            (248, 236, 226),
            (48, 32, 28),
            (130, 108, 98),
            (228, 210, 198),
            (178, 72, 48),
            (216, 200, 190),
        )
        bloom = ((240, 180, 140), (220, 150, 120))
    else:
        mood, note = 'basin', 'night pool · low register'
        paper, ink, muted, grid_dot, accent, fine = (
            (232, 234, 240),
            (26, 30, 48),
            (100, 108, 128),
            (200, 204, 218),
            (100, 120, 188),
            (180, 186, 200),
        )
        bloom = ((210, 216, 235), (190, 200, 225))

    return ClockSkin(
        tempo=tempo,
        mood=mood,
        mood_note=note,
        paper=paper,
        ink=ink,
        muted=muted,
        grid_dot=grid_dot,
        accent=accent,
        fine=fine,
        bloom=bloom,
    )


def load_fonts() -> tuple[ImageFont.FreeTypeFont, ImageFont.FreeTypeFont]:
    sans = FONTS / 'LiberationSans-Regular.ttf'
    mono = FONTS / 'DejaVuSansMono.ttf'
    if not sans.is_file() or not mono.is_file():
        raise FileNotFoundError(f"Expected fonts in {FONTS}")
    return (
        ImageFont.truetype(str(sans), 22),
        ImageFont.truetype(str(mono), 13),
    )


def draw_blooms(
    draw: ImageDraw.ImageDraw,
    skin: ClockSkin,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    seed: int,
) -> None:
    if skin.mood != 'bloom':
        return
    rng = random.Random(seed)
    for _ in range(38):
        cx = rng.randint(x0 + 40, x1 - 40)
        cy = rng.randint(y0 + 40, y1 - 40)
        r = rng.randint(28, 110)
        fill = skin.bloom[rng.randint(0, len(skin.bloom) - 1)]
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill, outline=None)


def draw_field_grid(
    draw: ImageDraw.ImageDraw,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    grid_dot: tuple[int, int, int],
) -> None:
    step = 52
    for x in range(x0, x1, step):
        for y in range(y0, y1, step):
            draw.ellipse((x, y, x + 1, y + 1), fill=grid_dot)


def draw_pulse_strip(
    draw: ImageDraw.ImageDraw,
    x0: int,
    y_mid: int,
    width: int,
    n_ticks: int,
    ink: tuple[int, int, int],
    phase: float,
    tempo: float,
) -> None:
    """One tick per BPM (rounded); height phase locked to clock."""
    if width < 2 or n_ticks < 2:
        return
    waves = max(2, int(round(tempo / 18.0)))
    for i in range(n_ticks):
        t = i / (n_ticks - 1)
        x = int(x0 + t * width)
        u = t + phase
        h = 10 + int(22 * (0.5 + 0.5 * math.sin(u * math.pi * 2 * waves)))
        draw.line((x, y_mid - h // 2, x, y_mid + h // 2), fill=ink, width=1)


def register_maestro(
    draw: ImageDraw.ImageDraw,
    x0: int,
    x1: int,
    y0: int,
    y1: int,
    tempo: float,
    ink: tuple[int, int, int],
    seed: int,
) -> None:
    rng = random.Random(seed)
    yc = (y0 + y1) // 2
    n = max(140, min(320, int(140 + tempo * 1.35)))
    cycles = tempo / 75.0
    for i in range(n):
        t = i / (n - 1)
        x = int(x0 + t * (x1 - x0))
        wobble = int(2.5 * math.sin(t * math.pi * 2 * cycles * 6))
        y = yc + wobble
        h = 4 + rng.randint(0, 1)
        draw.line((x, y - h, x, y + h), fill=ink, width=1)


def register_chronicler(
    draw: ImageDraw.ImageDraw,
    x0: int,
    x1: int,
    y0: int,
    y1: int,
    tempo: float,
    ink: tuple[int, int, int],
    muted: tuple[int, int, int],
    phase: float,
) -> None:
    yc = (y0 + y1) // 2
    amp = (y1 - y0) * 0.35
    pts: list[tuple[int, int]] = []
    n = 400
    for i in range(n):
        t = i / (n - 1)
        x = int(x0 + t * (x1 - x0))
        phase_shift = phase * math.pi * 2
        wave = t * math.pi * (1.6 + tempo / 120.0) * 2.2 + 0.3 * math.sin(t * math.pi * 5)
        y = int(yc + amp * math.sin(wave + phase_shift))
        pts.append((x, y))
    draw.line(pts, fill=ink, width=1)
    step = max(28, int(55 - tempo / 4))
    for i in range(0, n, step):
        x, y = pts[i]
        draw.line((x, y - 4, x, y + 4), fill=muted, width=1)


def register_sentry(
    draw: ImageDraw.ImageDraw,
    x0: int,
    x1: int,
    y0: int,
    y1: int,
    tempo: float,
    ink: tuple[int, int, int],
    seed: int,
) -> None:
    rng = random.Random(seed + 3)
    yc = (y0 + y1) // 2
    n = max(380, min(620, int(400 + tempo * 1.2)))
    spike_p = max(0.04, min(0.14, 0.14 - tempo / 1400.0))
    prev: tuple[int, int] | None = None
    for i in range(n):
        t = i / (n - 1)
        x = int(x0 + t * (x1 - x0))
        spike = rng.random() < spike_p
        y = yc + (rng.randint(-42, 42) if spike else rng.randint(-6, 6))
        if prev:
            draw.line((prev[0], prev[1], x, y), fill=ink, width=1)
        prev = (x, y)


def draw_frame(
    draw: ImageDraw.ImageDraw,
    ink: tuple[int, int, int],
    fine: tuple[int, int, int],
) -> None:
    draw.rectangle((M - 24, M - 24, W - M + 24, H - M + 24), outline=fine, width=1)
    draw.rectangle((M, M, W - M, H - M), outline=ink, width=2)


def main() -> None:
    now = datetime.now()
    skin = compute_skin(now)
    font_sans, font_mono = load_fonts()

    img = Image.new('RGB', (W, H), skin.paper)
    draw = ImageDraw.Draw(img)

    inner_l = M + 48
    inner_r = W - M - 48
    inner_t = M + 56

    seed = now.year * 10000 + now.month * 100 + now.day + now.hour * 60 + now.minute
    draw_blooms(draw, skin, inner_l, inner_t, inner_r, inner_t + 520, seed)
    draw_field_grid(draw, inner_l, inner_t, inner_r, inner_t + 520, skin.grid_dot)

    title = 'INTERVAL LEDGER'
    bb = draw.textbbox((0, 0), title, font=font_sans)
    th = bb[3] - bb[1]
    draw.text((inner_l, M + 8), title, font=font_sans, fill=skin.ink)

    time_s = now.strftime('%H:%M')
    sub = f"{time_s} local · {skin.tempo:.1f} bpm · {skin.mood} — {skin.mood_note}"
    draw.text((inner_l, M + 8 + th + 12), sub, font=font_mono, fill=skin.muted)

    strip_y = inner_t + 88
    strip_h = 56
    draw.rectangle(
        (inner_l, strip_y - strip_h // 2, inner_r, strip_y + strip_h // 2),
        outline=skin.fine,
        width=1,
    )
    bpm_ticks = max(52, min(112, int(round(skin.tempo))))
    phase = _second_phase(now)
    draw_pulse_strip(
        draw,
        inner_l + 8,
        strip_y,
        inner_r - inner_l - 16,
        bpm_ticks,
        skin.ink,
        phase,
        skin.tempo,
    )

    reg_left = inner_l + 32
    reg_right = inner_r - 280
    y_base = strip_y + 120
    reg_h = 210
    gap = 100

    registers = [
        ('M', register_maestro, y_base),
        ('C', register_chronicler, y_base + reg_h + gap),
        ('S', register_sentry, y_base + 2 * (reg_h + gap)),
    ]

    for label, painter, y0 in registers:
        y1 = y0 + reg_h
        draw.rectangle((reg_left - 48, y0, reg_right + 8, y1), outline=skin.fine, width=1)
        draw.text((reg_left - 40, y0 + 8), label, font=font_mono, fill=skin.accent)
        if painter is register_maestro:
            painter(draw, reg_left, reg_right, y0, y1, skin.tempo, skin.ink, seed)
        elif painter is register_chronicler:
            painter(draw, reg_left, reg_right, y0, y1, skin.tempo, skin.ink, skin.muted, phase)
        else:
            painter(draw, reg_left, reg_right, y0, y1, skin.tempo, skin.ink, seed)

    col_x = reg_right + 36
    notes = [
        'CAT. MLB-1',
        '—',
        'k 500',
        't 45',
        'e 10',
        '—',
        f"tempo {skin.tempo:.1f}",
        f"mood {skin.mood}",
        f"clock {time_s}",
    ]
    ny = y_base + 6
    line_gap = 22
    for line in notes:
        draw.text(
            (col_x, ny),
            line,
            font=font_mono,
            fill=skin.ink if line.startswith('CAT') else skin.muted,
        )
        ny += line_gap

    foot_y = H - M - 72
    draw.line((M, foot_y - 32, W - M, foot_y - 32), fill=skin.fine, width=1)
    draw.text(
        (inner_l, foot_y),
        f"FIG. 1 — tempo↔mood↔clock chain  ·  rendered {now:%Y-%m-%d %H:%M:%S}",
        font=font_mono,
        fill=skin.muted,
    )

    draw_frame(draw, skin.ink, skin.fine)

    img.save(OUT, 'PNG', dpi=(300, 300))
    print(f"Wrote {OUT}  (tempo={skin.tempo:.1f} mood={skin.mood} at {time_s})")


if __name__ == '__main__':
    main()
