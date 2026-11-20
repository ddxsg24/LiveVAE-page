"""Build the comparison videos of the project page from the result folders.

Each clip becomes one MP4 that holds every method side by side, so the panels can
never drift apart in the browser. Within a clip all panels are cut to the same
number of frames and written at the clip's own frame rate; clips keep their own
lengths (reconstruction sources run at 25, 30 or 50 fps, generations at 24 fps).

Usage:
    python tools/build_videos.py --recon DIR --r2v DIR --t2v DIR [--out static/videos]

DIR are the downloaded Drive folders:
    recon/{h3,wan22}/<category>/<clip>/<res>/{GT,...}.mp4
    r2v/<clip>/{code_video,MiniMax-H3,Ours}.mp4
    t2v/h3/<category>/<clip>/{MiniMax-H3_official,Ours}.mp4
Missing clips are skipped with a warning. A summary for every built clip (frames,
fps, seconds, layout, column labels) is written to <out>/clips.json; the page
builds its result tabs from that file, so no HTML needs editing after a rebuild.

For generations (r2v, t2v) the script also prints how closely the MiniMax-H3 and
LiveVAE panels agree frame by frame (PSNR at 160x90). T2V decodes the same latents,
so it should stay high throughout. In r2v the reference is encoded by each VAE, so
the two generations drift apart over time; a clip that already disagrees on its
first frame (bullet_time_01 did, about 14 dB) shows events at different moments
and is a poor comparison.
"""
import argparse
import json
import subprocess

import numpy as np
from fractions import Fraction
from pathlib import Path

GUTTER = 12          # white gap between panels, in pixels
CRF = 20          # high quality while keeping each composite near 10 MB or less

# Columns per task, in display order: (file stem, label shown on the page)
COLUMNS = {
    "recon_h3": [("GT", "Ground truth"), ("MiniMax-H3_official", "MiniMax-H3"),
                 ("StreamRender-H3", "StreamRender-H3"), ("Ours", "LiveVAE (ours)")],
    "recon_wan22": [("GT", "Ground truth"), ("Wan2.2_official", "Wan2.2"),
                    ("LightVAE-Pro", "LightVAE-Pro"), ("Ours", "LiveVAE (ours)")],
    "r2v": [("code_video", "Clay render"), ("MiniMax-H3", "MiniMax-H3"), ("Ours", "LiveVAE (ours)")],
    "t2v": [("MiniMax-H3_official", "MiniMax-H3"), ("Ours", "LiveVAE (ours)")],
}

# Selected clips: (task, path relative to the task root, output name, title)
CLIPS = [
    # Reconstruction, MiniMax-H3 latent space (720p sources)
    ("recon_h3", "h3/people/03_162a710c/720p", "recon_h3_library", "Library"),
    ("recon_h3", "h3/fine_detail/02_186c3f01/720p", "recon_h3_ice", "Ice"),
    ("recon_h3", "h3/urban_indoor/02_106ea626/720p", "recon_h3_cooking", "Cooking"),
    ("recon_h3", "h3/urban_indoor/01_18c07b0a/720p", "recon_h3_interior", "Interior"),
    ("recon_h3", "h3/fast_motion/01_1770b97f/720p", "recon_h3_stage", "Stage fire"),
    # Reconstruction, Wan2.2 latent space (the game clip is 480p: its 720p files exceed the Drive download limit)
    ("recon_wan22", "wan22/fast_motion/03_38403026/480p", "recon_wan22_game", "Game cinematic"),
    ("recon_wan22", "wan22/people/02_162a710c/720p", "recon_wan22_library", "Library"),
    ("recon_wan22", "wan22/nature/01_28dc5178/720p", "recon_wan22_kayak", "Ice kayak"),
    ("recon_wan22", "wan22/fast_motion/01_3dfc8bd1/720p", "recon_wan22_motocross", "Motocross"),
    # Reference to video (MiniMax-H3 only; Wan2.2 has no reference generation)
    ("r2v", "gaming_01", "gaming_01", "Gaming"),
    ("r2v", "robotics_simulation_01_a", "robotics_simulation_01_a", "Robotics simulation"),
    ("r2v", "scene_world_editing_01_a", "scene_world_editing_01_a", "Scene and world editing"),
    ("r2v", "trajectory_variation_01_a", "trajectory_variation_01_a", "Trajectory variation"),
    ("r2v", "physical_grounding_01", "physical_grounding_01", "Physical grounding"),
    ("r2v", "architectural_cinematics_01", "architectural_cinematics_01", "Architectural cinematics"),
    ("r2v", "product_cinematography_01", "product_cinematography_01", "Product cinematography"),
    # Text to video (same DiT latents, only the VAE differs)
    ("t2v", "h3/fine_detail/02_A_clear_glass_of_coffee_is_gently_poured", "t2v_coffee", "Coffee pour"),
]

# Grid layout (columns, rows) per task. Panels keep the source resolution (no rescaling),
# except r2v, whose generations are downscaled to 640x360 panels.
LAYOUT = {
    "recon_h3": (None, (2, 2)),
    "recon_wan22": (None, (2, 2)),
    "r2v": ((640, 360), (3, 1)),
    "t2v": (None, (2, 1)),
}


def probe(path):
    """Return (frame count, frame rate as Fraction, width, height) of the first video stream."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames",
         "-show_entries", "stream=nb_read_frames,r_frame_rate,avg_frame_rate,width,height",
         "-of", "json", str(path)],
        check=True, capture_output=True, text=True).stdout
    s = json.loads(out)["streams"][0]
    rate = Fraction(s["avg_frame_rate"]) if s["avg_frame_rate"] != "0/0" else Fraction(s["r_frame_rate"])
    return int(s["nb_read_frames"]), rate, int(s["width"]), int(s["height"])


def small_frames(path, frames):
    """Grayscale 160x90 frames, for comparing two panels."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-frames:v", str(frames),
         "-vf", "scale=160:90:flags=area,format=gray", "-f", "rawvideo", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, 90, 160).astype(np.float32)


def agreement(a, b, frames):
    """Per frame PSNR (dB) between two panels: first frame and median."""
    x, y = small_frames(a, frames), small_frames(b, frames)
    n = min(len(x), len(y))
    mse = ((x[:n] - y[:n]) ** 2).mean(axis=(1, 2))
    psnr = 10 * np.log10(255 ** 2 / np.maximum(mse, 1e-6))
    return round(float(psnr[0]), 1), round(float(np.median(psnr)), 1)


def build(task, src_dir, name, out_dir, offsets=None):
    cols = COLUMNS[task]
    panel, (gx, gy) = LAYOUT[task]
    files = [src_dir / f"{stem}.mp4" for stem, _ in cols]
    missing = [f for f in files if not f.exists()]
    if missing:
        print(f"skip {name}: missing {', '.join(m.name for m in missing)}")
        return None
    info = [probe(f) for f in files]
    pw, ph = panel or (info[0][2], info[0][3])
    rates = {r for _, r, _, _ in info}
    # Generated panels sometimes carry a slightly different time base (e.g. code video
    # 24 fps vs 24.0 fps rounding); use the most common rate and play frames one to one.
    rate = max(rates, key=lambda r: sum(1 for _, x, _, _ in info if x == r))
    offsets = offsets or [0] * len(files)
    frames = min(n - o for (n, _, _, _), o in zip(info, offsets))

    inputs, chains = [], []
    for i, (f, o) in enumerate(zip(files, offsets)):
        inputs += ["-i", str(f)]
        chains.append(
            f"[{i}:v]setpts=N/({rate.numerator}/{rate.denominator})/TB,"
            f"trim=start_frame={o}:end_frame={o + frames},setpts=PTS-STARTPTS,"
            f"scale={pw}:{ph}:flags=lanczos,setsar=1,"
            f"pad={pw + (GUTTER if i % gx != gx - 1 else 0)}:{ph + (GUTTER if i // gx != gy - 1 else 0)}:0:0:white[p{i}]")
    rows = []
    for r in range(gy):
        ids = "".join(f"[p{r * gx + c}]" for c in range(gx))
        if gx > 1:
            chains.append(f"{ids}hstack=inputs={gx}[r{r}]")
        else:
            chains.append(f"{ids}null[r{r}]")
        rows.append(f"[r{r}]")
    if gy > 1:
        chains.append(f"{''.join(rows)}vstack=inputs={gy},format=yuv420p[v]")
    else:
        chains.append(f"{rows[0]}format=yuv420p[v]")

    out = out_dir / f"{name}.mp4"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chains), "-map", "[v]",
         "-r", f"{rate.numerator}/{rate.denominator}", "-frames:v", str(frames),
         "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF), "-pix_fmt", "yuv420p",
         "-movflags", "+faststart", "-an", str(out)],
        check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-frames:v", "1", "-q:v", "3",
                    str(out_dir / f"{name}.jpg")], check=True)
    width = gx * pw + (gx - 1) * GUTTER
    height = gy * ph + (gy - 1) * GUTTER
    summary = {"task": task, "frames": frames, "fps": round(float(rate), 3),
               "seconds": round(frames / float(rate), 2), "width": width, "height": height,
               "grid": [gx, gy], "panel": [pw, ph], "gutter": GUTTER,
               "source_frames": [n for n, _, _, _ in info],
               "source_fps": [round(float(r), 3) for _, r, _, _ in info]}
    line = (f"{name}: {frames} frames at {float(rate):.3f} fps ({summary['seconds']} s), "
            f"sources {summary['source_frames']} frames")
    if task in ("r2v", "t2v"):
        first, median = agreement(files[-2], files[-1], frames)
        summary["agreement_db"] = {"first_frame": first, "median": median}
        line += f", H3 vs ours {first} dB on frame 0, {median} dB median"
        if first < 20:
            line += "  <-- generations differ from the first frame"
    print(line)
    return summary


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--recon", type=Path)
    ap.add_argument("--r2v", type=Path)
    ap.add_argument("--t2v", type=Path)
    ap.add_argument("--out", type=Path, default=Path("static/videos"))
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    roots = {"recon_h3": args.recon, "recon_wan22": args.recon, "r2v": args.r2v, "t2v": args.t2v}

    # Keep entries of clips that are not rebuilt in this run (e.g. r2v when --r2v is omitted).
    manifest = args.out / "clips.json"
    summary = json.loads(manifest.read_text()) if manifest.exists() else {}
    # Tasks rebuilt in this run are replaced as a whole, so dropped clips leave the manifest.
    rebuilt = {task for task, *_ in CLIPS if roots[task] is not None}
    summary = {k: v for k, v in summary.items() if v["task"] not in rebuilt}
    for entry in summary.values():
        entry["labels"] = [label for _, label in COLUMNS[entry["task"]]]
    for task, rel, name, title in CLIPS:
        root = roots[task]
        if root is None:
            continue
        s = build(task, root / rel, name, args.out)
        if s:
            s["title"] = title
            s["labels"] = [label for _, label in COLUMNS[task]]
            if task.startswith("recon"):
                s["resolution"] = Path(rel).name
            summary[name] = s
    order = {t: i for i, t in enumerate(["recon_h3", "recon_wan22", "r2v", "t2v"])}
    summary = dict(sorted(summary.items(), key=lambda kv: order.get(kv[1]["task"], 9)))
    manifest.write_text(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
