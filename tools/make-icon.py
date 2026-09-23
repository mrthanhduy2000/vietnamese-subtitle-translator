# Draws the extension icon: the same mark the YouTube button wears, a speech bubble with the
# product's spark inside, white on the terracotta accent. No SVG rasteriser on this machine, so the
# shape is drawn directly with PIL at 8x and downsampled.
from PIL import Image, ImageDraw
import sys, os

ACCENT = (217, 119, 87, 255)      # #D97757
WHITE = (255, 255, 255, 255)
SS = 8                            # supersampling

def bezier(p0, p1, p2, p3, n=24):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0]
        y = u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]
        out.append((x, y))
    return out

SPARK = (
    bezier((12, 2), (12.4, 7.2), (16.8, 11.6), (22, 12))
    + bezier((22, 12), (16.8, 12.4), (12.4, 16.8), (12, 22))
    + bezier((12, 22), (11.6, 16.8), (7.2, 12.4), (2, 12))
    + bezier((2, 12), (7.2, 11.6), (11.6, 7.2), (12, 2))
)

def draw_icon(size, stroke=1.8, mark_frac=0.64, bg=True, pad_shape=True):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=ACCENT)

    # the mark lives in a 24x24 box, centred
    box = S * mark_frac
    ox = (S - box) / 2
    oy = (S - box) / 2
    u = box / 24.0
    P = lambda x, y: (ox + x * u, oy + y * u)

    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    # bubble body + tail, filled, then hollowed out to leave an outline of `stroke` units
    body = [P(1.4, 4.6), P(22.6, 18.1)]
    md.rounded_rectangle([body[0][0], body[0][1], body[1][0], body[1][1]], radius=2.8 * u, fill=255)
    md.polygon([P(13.4, 16.0), P(8.2, 21.6), P(8.2, 16.0)], fill=255)
    s = stroke * u
    md.rounded_rectangle([body[0][0] + s, body[0][1] + s, body[1][0] - s, body[1][1] - s],
                         radius=max(1.0, 2.8 * u - s), fill=0)
    md.polygon([P(13.4 - stroke * 1.5, 16.0), P(8.2 + stroke * 0.55, 21.6 - stroke * 1.5), P(8.2 + stroke * 0.55, 16.0)], fill=0)
    # the hollow of the tail must join the hollow of the body, or the outline crosses the bubble
    x0 = P(8.2 + stroke * 0.55, 0)[0]
    x1 = P(13.4 - stroke * 1.5, 0)[0]
    if x1 > x0:
        md.rectangle([x0, P(0, 16.0)[1] - s, x1, P(0, 18.1)[1] - s], fill=0)

    # spark inside the bubble
    cx, cy, scale = 12, 11.2, 0.44
    md.polygon([P(cx + (x - 12) * scale, cy + (y - 12) * scale) for x, y in SPARK], fill=255)

    img.paste(WHITE, (0, 0), mask)
    return img.resize((size, size), Image.LANCZOS)

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    # smaller sizes get a bigger, bolder mark, or the bubble turns to mush in the toolbar
    for size, stroke, frac in [(128, 1.8, 0.66), (48, 2.0, 0.72), (32, 2.4, 0.82), (16, 2.7, 0.88)]:
        name = "icon.png" if size == 128 else f"icon-{size}.png"
        draw_icon(size, stroke=stroke, mark_frac=frac).save(os.path.join(out, name))
        print("da ve", name)
    draw_icon(512, stroke=1.8, mark_frac=0.66).save(os.path.join(out, "preview-512.png"))
