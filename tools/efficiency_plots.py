"""Write the three Efficiency charts into index.html.

All three charts share one SVG geometry (same viewBox, plot box, tick and title
positions), so their axes line up when they sit in one row. Run from the repo root:

    python tools/efficiency_plots.py
"""
import re
from pathlib import Path

W, H = 340, 236                      # viewBox
X0, X1, YT, YB = 44, 332, 30, 186    # plot box
RES = ["480p", "720p", "1080p", "2160p"]

# (A) Attention windows: change in PSNR (dB) and change in time (%) relative to 2x7x7.
WINDOWS = {
    "2×3×3":   {"480p": (-0.185, 0.15), "720p": (-0.21, -0.25), "1080p": (-0.19, 0.2), "2160p": (-0.2, 0.15)},
    "2×16×16": {"480p": (0.125, 3.69), "720p": (0.13, 0.15), "1080p": (0.05, -0.15), "2160p": (-0.1, 0.0)},
    "3×7×7":   {"480p": (0.01, 11.63), "720p": (0.0, 11.22), "1080p": (0.015, 12.48), "2160p": (-0.02, 12.13)},
    "4×7×7":   {"480p": (0.105, 22.76), "720p": (0.095, 21.24), "1080p": (0.105, 22.56), "2160p": (0.06, 21.85)},
}
RES_COLOR = {"480p": "#198d83", "720p": "#ce607d", "1080p": "#8c71bb", "2160p": "#c18a2a"}
SHAPE = {"2×3×3": "circle", "2×16×16": "square", "3×7×7": "triangle", "4×7×7": "diamond"}

# (B) Cumulative end to end speedup over LiveVAE at 480p/720p/1080p/2160p.
SPEEDUP = [
    ("+ Attention fusion", "#cb8c81", "square", [1.666, 1.763, 1.785, 1.678]),
    ("+ Region-wise compilation", "#bd5d50", "triangle", [1.689, 2.453, 2.452, 2.246]),
    ("+ FP8 feedforward (QAT)", "#902f2b", "diamond", [1.022, 2.082, 2.997, 2.741]),
]
# (C) PSNR change (dB) of the full stack, with and without QAT.
PSNR = [
    ("FP8 with QAT", [-0.06, -0.08, -0.13, 0.02], False),
    ("FP8 without QAT", [-1.35, -1.71, -2.33, -3.43], True),
]
DARK = "#902f2b"
BASE = "#92989d"


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def marker(shape, x, y, color, r=4.2, hollow=False):
    fill = "#fff" if hollow else color
    common = f'fill="{fill}" stroke="{color}" stroke-width="1.6"'
    if shape == "circle":
        return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" {common}/>'
    if shape == "square":
        return f'<rect x="{f(x - r)}" y="{f(y - r)}" width="{f(2 * r)}" height="{f(2 * r)}" {common}/>'
    if shape == "triangle":
        return f'<path d="M{f(x)} {f(y - r * 1.15)}L{f(x + r * 1.1)} {f(y + r * 0.75)}H{f(x - r * 1.1)}Z" {common}/>'
    if shape == "diamond":
        return f'<path d="M{f(x)} {f(y - r * 1.15)}L{f(x + r * 1.15)} {f(y)}L{f(x)} {f(y + r * 1.15)}L{f(x - r * 1.15)} {f(y)}Z" {common}/>'
    if shape == "star":
        import math
        pts = []
        for k in range(10):
            rad = r * 1.9 if k % 2 == 0 else r * 0.8
            a = -math.pi / 2 + k * math.pi / 5
            pts.append(f"{f(x + rad * math.cos(a))} {f(y + rad * math.sin(a))}")
        return f'<path d="M{"L".join(pts)}Z" fill="{color}"/>'
    raise ValueError(shape)


def frame(ylabel, yticks, ymap, xlabel, xticks):
    """Axis titles, ticks and the left and bottom axis lines, identical for every chart."""
    out = [f'<text x="0" y="14" class="axis-title">{ylabel}</text>']
    for v, label in yticks:
        out.append(f'<text x="{X0 - 7}" y="{f(ymap(v) + 4)}" text-anchor="end">{label}</text>')
    for x, label in xticks:
        out.append(f'<text x="{f(x)}" y="{YB + 18}" text-anchor="middle">{label}</text>')
    out.append(f'<text x="{(X0 + X1) / 2:.0f}" y="{YB + 42}" text-anchor="middle" class="x-title">{xlabel}</text>')
    out.append(f'<path d="M{X0} {YT}V{YB}H{X1}" fill="none" stroke="#a4abb0"/>')
    return out


def svg(label, body):
    return (f'<svg class="eff-plot" viewBox="0 0 {W} {H}" role="img" aria-label="{label}">'
            + "".join(body) + "</svg>")


def chart_windows():
    xmin, xmax, ymin, ymax = -0.25, 0.17, -5, 25.5
    xm = lambda v: X0 + (v - xmin) / (xmax - xmin) * (X1 - X0)
    ym = lambda v: YB - (v - ymin) / (ymax - ymin) * (YB - YT)
    body = [f'<rect x="{f(xm(0))}" y="{f(ym(0))}" width="{f(X1 - xm(0))}" height="{f(YB - ym(0))}" fill="#e6f2ee"/>',
            f'<text x="{X1 - 4}" y="{YB - 5}" text-anchor="end" class="better">Better</text>']
    body += frame("Change in time (%)", [(v, str(v)) for v in (0, 5, 10, 15, 20, 25)], ym,
                  "Change in PSNR (dB)", [(xm(v), t) for v, t in ((-0.2, "−0.2"), (-0.1, "−0.1"), (0, "0"), (0.1, "0.1"))])
    body.append(f'<path d="M{f(xm(0))} {YT}V{YB}M{X0} {f(ym(0))}H{X1}" stroke="{BASE}" stroke-dasharray="3 3"/>')
    for window, points in WINDOWS.items():
        for res, (dx, dy) in points.items():
            body.append(marker(SHAPE[window], xm(dx), ym(dy), RES_COLOR[res]))
    body.append(marker("star", xm(0), ym(0), "#2b3240"))
    return svg("Change in time against change in PSNR for attention windows relative to 2 by 7 by 7", body)


def category_x(i):
    return X0 + (i + 0.5) * (X1 - X0) / len(RES)


def chart_speedup():
    ymin, ymax = 0.8, 3.2
    ym = lambda v: YB - (v - ymin) / (ymax - ymin) * (YB - YT)
    shade_x = (category_x(1) + category_x(2)) / 2
    body = [f'<rect x="{f(shade_x)}" y="{YT}" width="{f(X1 - shade_x)}" height="{YB - YT}" fill="#faf0eb"/>',
            f'<text x="{X1 - 5}" y="{YB - 6}" text-anchor="end" class="shade-label">FP8 recommended</text>']
    body += frame("Speedup over LiveVAE (×)", [(v, f(v)) for v in (1, 1.5, 2, 2.5, 3)], ym,
                  "Resolution", [(category_x(i), r) for i, r in enumerate(RES)])
    body.append(f'<path d="M{X0} {f(ym(1))}H{X1}" stroke="{BASE}" stroke-dasharray="4 4"/>')
    for _, color, shape, values in SPEEDUP:
        pts = " ".join(f"{f(category_x(i))},{f(ym(v))}" for i, v in enumerate(values))
        body.append(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="2.2"/>')
        body += [marker(shape, category_x(i), ym(v), color) for i, v in enumerate(values)]
    return svg("Cumulative end to end speedup over LiveVAE at four resolutions", body)


def chart_psnr():
    ymin, ymax = -3.75, 0.35
    ym = lambda v: YB - (v - ymin) / (ymax - ymin) * (YB - YT)
    body = frame("Change in PSNR (dB)", [(v, "−" + str(-v) if v < 0 else str(v)) for v in (0, -1, -2, -3)], ym,
                 "Resolution", [(category_x(i), r) for i, r in enumerate(RES)])
    body.append(f'<path d="M{X0} {f(ym(0))}H{X1}" stroke="{BASE}" stroke-dasharray="4 4"/>')
    for _, values, hollow in PSNR:
        pts = " ".join(f"{f(category_x(i))},{f(ym(v))}" for i, v in enumerate(values))
        dash = ' stroke-dasharray="6 4"' if hollow else ""
        body.append(f'<polyline points="{pts}" fill="none" stroke="{DARK}" stroke-width="2.2"{dash}/>')
        body += [marker("diamond", category_x(i), ym(v), DARK, hollow=hollow) for i, v in enumerate(values)]
    return svg("PSNR change of the optimized LiveVAE with and without QAT at four resolutions", body)


def swatch(color, shape=None, dashed=False, hollow=False):
    dash = ' stroke-dasharray="4 3"' if dashed else ""
    m = marker(shape, 12, 6, color, r=3.4, hollow=hollow) if shape else ""
    return (f'<svg class="sw" viewBox="0 0 24 12" aria-hidden="true"><path d="M1 6H23" stroke="{color}" '
            f'stroke-width="2"{dash}/>{m}</svg>')


def legend(items):
    return '<ul class="legend">' + "".join(f"<li>{sw}{text}</li>" for sw, text in items) + "</ul>"


def section():
    dot = lambda shape, color: (f'<svg class="sw sw-dot" viewBox="0 0 12 12" aria-hidden="true">'
                                f'{marker(shape, 6, 6, color, r=3.6)}</svg>')
    key_a = ('<ul class="legend legend-wrap">'
             + "".join(f"<li>{dot('circle', c)}{r}</li>" for r, c in RES_COLOR.items())
             + '</ul><ul class="legend legend-wrap">'
             + "".join(f"<li>{dot(SHAPE[w], '#5b6470')}{w}</li>" for w in WINDOWS)
             + f"<li>{dot('star', '#2b3240')}2×7×7 (default)</li></ul>")
    key_b = legend([(swatch(BASE, dashed=True), "LiveVAE")] + [(swatch(c, s), n) for n, c, s, _ in SPEEDUP])
    key_c = legend([(swatch(BASE, dashed=True), "LiveVAE"), (swatch(DARK, "diamond"), PSNR[0][0]),
                    (swatch(DARK, "diamond", dashed=True, hollow=True), PSNR[1][0])])
    cards = [
        ("A", "Attention windows", chart_windows(), key_a, "Relative to the default 2 × 7 × 7 window."),
        ("B", "Infrastructure optimization speedup", chart_speedup(), key_b, "Cumulative end to end speedup over LiveVAE."),
        ("C", "PSNR with FP8", chart_psnr(), key_c, "QAT recovers the PSNR lost to FP8."),
    ]
    html = ['<section id="efficiency"><h2>Efficiency</h2>', '  <div class="eff-grid">']
    for letter, title, chart, key, caption in cards:
        html.append(f'    <figure class="eff-card"><h3><b>{letter}</b> {title}</h3>{chart}'
                    f'<div class="chart-key">{key}</div><figcaption>{caption}</figcaption></figure>')
    html += ["  </div>", "</section>"]
    return "\n".join(html)


if __name__ == "__main__":
    page = Path("index.html")
    text = page.read_text()
    new = re.sub(r'<section id="efficiency">.*?</section>', lambda m: section(), text, count=1, flags=re.S)
    page.write_text(new)
    print("efficiency section written")
