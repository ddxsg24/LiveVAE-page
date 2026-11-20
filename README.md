# LiveVAE project page

Project page for **LiveVAE: Causal Window Attention Makes Efficient Streaming Video VAE**.

Live site: https://ddxsg24.github.io/LiveVAE-page/

## Layout

```
index.html               the whole page
static/css/style.css     styles
static/js/main.js        result tabs built from static/videos/clips.json, lazy video playback, BibTeX copy
static/js/explainer.js   step by step animations of the Locality and Method sections
static/images/           paper figures (teaser, motivation, method overview, efficiency plots)
static/images/locality/  example frame and receptive field maps used by the Locality animation
static/explainer/        frames 0 to 32 of the streaming clip (input and LiveVAE output) as sprite sheets
tools/efficiency_plots.py  writes the three Efficiency charts into index.html
static/videos/           comparison videos, one file per clip, plus clips.json
tools/build_videos.py    builds the comparison videos and clips.json from the result folders
```

The site is plain HTML served by GitHub Pages from the `main` branch, so there is no build step. Edit `index.html` and push.

## Updating links

When the paper, code and models are public, replace the three disabled buttons in the `links` block of `index.html` with real links, for example:

```html
<a class="button" href="https://arxiv.org/abs/XXXX.XXXXX">Paper</a>
```

Then fill `\projectpageurl` in the paper's `main.tex` with the live site address above.

## Videos

Every clip is a single MP4 holding all methods side by side, so the panels of a clip
always stay in sync. `tools/build_videos.py` builds them from the result folders:

```
python tools/build_videos.py --recon reconstruction --r2v generation_ref2va_h3_vs_ours --t2v t2v
```

For each clip it cuts all panels to the same number of frames and keeps the clip's own
frame rate (reconstruction sources run at 25, 30 or 50 fps; generations at 24 fps), so
clip lengths differ on purpose. It writes `static/videos/<name>.mp4`, a poster
`<name>.jpg`, and `static/videos/clips.json`, which the page reads to fill the
Reconstruction, Reference to video and Text to video tabs. A tab with no clips is hidden.
Pick clips by editing `CLIPS` at the top of the script.

Layouts: reconstruction is a 2×2 grid of 960×540 panels (ground truth, official VAE,
baseline, LiveVAE); reference to video is three 640×360 panels in a row (clay render,
MiniMax-H3, LiveVAE); text to video is two 960×536 panels. Gaps are 12 px of white.
The page shows every panel of a clip at once, labelled from `clips.json`, or two panels
in a wipe view. Clips not rebuilt in a run keep their existing `clips.json` entries.

## Explainers

`static/js/explainer.js` drives both step explainers with one player: each step is a
`.step-view` in `index.html` (title, line and duration in its data attributes) and a
draw function that renders the step at progress t from 0 to 1. Steps crossfade, and a
step opens in the state the previous one ends in, so shared drawings continue instead of
cutting. The receptive field numbers in the Locality steps come from the paper's
motivation figure. The Method steps follow the drawing and colors of the paper's method
figure: oblique latent frames with dashed links between windows (panel b) and the
streaming encoder and decoder columns (panel d). Step 4 streams the first 33 frames of a
Wan2.2 reconstruction clip (480p, 50 fps) through that diagram, using the sprite sheets in
`static/explainer/` (11 frames of 312×180 per row; ground truth input and LiveVAE output).

For generations the script prints how well the MiniMax-H3 and LiveVAE panels agree on
frame 0 and over the clip. A reference to video clip that already disagrees on frame 0
(below about 20 dB) shows its events at different moments in the two columns.
