:root {
  --text: #1f2328;
  --muted: #59636e;
  --accent: #b8322f;
  --rule: #e6e8eb;
  --bg-soft: #f6f8fa;
  --max: 1040px;
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  color: var(--text);
  background: #fff;
  font: 17px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.hero, main, footer {
  max-width: var(--max);
  margin: 0 auto;
  padding: 0 24px;
}

.hero { text-align: center; padding-top: 64px; padding-bottom: 8px; }

h1 {
  font-size: 2.3rem;
  line-height: 1.25;
  font-weight: 700;
  margin: 0 auto 28px;
  max-width: 900px;
  letter-spacing: -0.01em;
}

h1 .method { color: var(--accent); }

.authors, .affiliations, .notes { margin: 0 auto; }
.authors { font-size: 1.08rem; max-width: 880px; }
.authors span { display: inline-block; margin: 0 9px; white-space: nowrap; }
.authors a { color: #2563a8; text-decoration: none; }
.authors a:hover { text-decoration: underline; }
.affiliations { margin-top: 10px; color: var(--muted); font-size: 0.98rem; }
.affiliations span { display: inline-block; margin: 0 9px; }
.notes { margin-top: 6px; color: var(--muted); font-size: 0.88rem; }
sup { font-size: 0.68em; line-height: 0; }

.links { margin: 26px 0 8px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.button {
  display: inline-block;
  padding: 8px 18px;
  border-radius: 999px;
  background: var(--text);
  color: #fff;
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
}
.button:hover { background: #000; }
.button.disabled { background: #d0d7de; color: #57606a; cursor: default; }

section { padding: 34px 0 6px; }

h2 {
  font-size: 1.6rem;
  margin: 0 0 16px;
  text-align: center;
  letter-spacing: -0.005em;
}

p { margin: 0 0 16px; }
.abstract { text-align: justify; hyphens: none; }

figure { margin: 18px 0 8px; }
figure img, figure video { display: block; width: 100%; height: auto; }
figure.wide { margin-left: -24px; margin-right: -24px; }
figcaption {
  margin-top: 10px;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.55;
}
figure.wide figcaption { padding: 0 24px; }

.stats {
  list-style: none;
  padding: 0;
  margin: 26px 0 6px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  text-align: center;
}
.stats strong { display: block; font-size: 2rem; color: var(--accent); line-height: 1.2; }
.stats span { display: block; color: var(--muted); font-size: 0.92rem; margin-top: 4px; }

/* Result tabs */
.tabs { display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; margin: 4px 0 14px; }
.tabs [role="tab"] {
  border: 1px solid var(--rule); background: #fff; color: var(--muted);
  padding: 6px 16px; border-radius: 999px; font: inherit; font-size: 0.92rem; font-weight: 600; cursor: pointer;
}
.tabs [role="tab"]:hover { color: var(--text); }
.tabs [role="tab"][aria-selected="true"] { background: var(--text); border-color: var(--text); color: #fff; }
/* Step by step streaming explainer */
.explainer { margin: 24px 0 10px; }
.ex-head { display: grid; grid-template-columns: 36px 1fr 36px; align-items: center; gap: 14px; }
.ex-nav {
  width: 34px; height: 34px; padding: 0;
  border: 1px solid var(--rule); border-radius: 50%;
  background: #fff; color: var(--muted); cursor: pointer;
  display: grid; place-items: center;
}
.ex-nav:hover { color: var(--text); border-color: #c4c9cf; }
.ex-nav svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ex-words { display: grid; min-height: 96px; align-items: center; }
.ex-beat { grid-area: 1 / 1; opacity: 0; visibility: hidden; transition: opacity .35s ease, visibility 0s .35s; }
.ex-beat.is-active { opacity: 1; visibility: visible; transition: opacity .35s ease; }
.ex-title { margin: 0 0 4px; font-weight: 650; font-size: 1.04rem; display: flex; align-items: center; gap: 9px; }
.ex-n {
  flex: none; width: 22px; height: 22px; border-radius: 50%;
  background: var(--accent); color: #fff; font-size: 0.78rem; font-weight: 700;
  display: grid; place-items: center;
}
.ex-line { margin: 0; color: var(--muted); font-size: 0.95rem; line-height: 1.55; }
.ex-stage-wrap { overflow-x: auto; margin-top: 6px; }
.ex-stage { display: block; width: 100%; min-width: 660px; height: auto; }
.ex-stage text { font-size: 15px; fill: #3b424a; }
.ex-stage .lbl { font-size: 14px; fill: #59636e; }
.ex-stage .lbl.strong { fill: var(--accent); font-weight: 600; }
.ex-stage .box { font-size: 14px; font-weight: 600; fill: #7a4a1e; }
.ex-stage .kv { font-size: 11px; font-weight: 700; fill: #7a5c00; }
.ex-stage .tag { font-size: 13px; font-weight: 600; fill: #8a6a00; }
.ex-stage .tlabel { font-size: 17px; fill: #7a828c; font-style: italic; font-family: "Times New Roman", Times, serif; }
.ex-stage .tlabel.now { fill: #4d4a9c; font-weight: 700; }
.ex-stage .note { font-size: 13px; fill: #8a919b; font-style: italic; }
.ex-stage .note.strong { fill: #4d4a9c; font-style: normal; font-weight: 600; }
.ex-stage .big { font-size: 20px; font-weight: 600; fill: #3b424a; }
.ex-stage .small { font-size: 12.5px; fill: #59636e; }
.ex-stage .math { font-family: "Times New Roman", Times, serif; font-style: italic; font-size: 19px; fill: #2b2f36; }
.ex-stage .math .sub { font-size: 12px; font-style: normal; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
.ex-stage .math .plain { font-style: normal; }
.ex-stage .math.small-math { font-size: 15px; }
.ex-stage .scene { transition: opacity .45s ease; }
.ex-controls { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
.ex-play {
  flex: none; width: 32px; height: 32px; padding: 0;
  border: 1px solid var(--rule); border-radius: 50%;
  background: #fff; color: var(--text); cursor: pointer;
  display: grid; place-items: center;
}
.ex-play svg { width: 14px; height: 14px; fill: currentColor; }
.ex-play .i-pause, .ex-play.is-playing .i-play { display: none; }
.ex-play.is-playing .i-pause { display: inline; }
.ex-bar { flex: 1; display: flex; gap: 5px; }
.ex-seg {
  flex: var(--w) 1 0; height: 16px; padding: 0; border: 0; background: none; cursor: pointer; position: relative;
}
.ex-seg::before, .ex-seg i {
  content: ""; position: absolute; left: 0; right: 0; top: 6px; height: 4px; border-radius: 2px;
}
.ex-seg::before { background: #e3e6ea; }
.ex-seg i { background: var(--accent); transform-origin: left center; transform: scaleX(0); }
.ex-count { flex: none; min-width: 3em; text-align: right; font-size: 0.85rem; color: var(--muted); font-variant-numeric: tabular-nums; }



.bibtex { position: relative; }
.bibtex pre {
  margin: 0;
  padding: 18px 20px;
  background: var(--bg-soft);
  border-radius: 8px;
  overflow-x: auto;
  font: 0.86rem/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.copy {
  position: absolute;
  top: 10px;
  right: 10px;
  border: 0;
  border-radius: 6px;
  padding: 4px 10px;
  background: #fff;
  color: var(--muted);
  font-size: 0.8rem;
  cursor: pointer;
}
.copy:hover { color: var(--text); }

footer { padding-top: 40px; padding-bottom: 48px; color: var(--muted); font-size: 0.88rem; text-align: center; }

@media (max-width: 760px) {
  body { font-size: 16px; }
  h1 { font-size: 1.65rem; }
  .stats { grid-template-columns: 1fr; gap: 12px; }
  figure.wide { margin-left: -12px; margin-right: -12px; }
}

/* A shared player supplies the matching frame to both comparison panels. */
[hidden] { display: none !important; }
.panel-note { max-width: 790px; margin: 0 auto 14px; text-align: center; color: var(--muted); font-size: .94rem; }
.result-tools, .compare-options, .example-nav, .transport, .mode-buttons { display: flex; align-items: center; }
.result-tools { flex-wrap: wrap; justify-content: center; gap: 12px 20px; margin: 16px 0; }
.comparison { border: 1px solid #d6dade; border-radius: 12px; overflow: hidden; background: #fff; }
.comparison:focus-visible, .chart-scroll:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.example-head, .compare-options, .transport { padding: 12px 16px; }
.example-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.example-head h3, .eff-card h3 { margin: 0; color: var(--text); font-size: 1.07rem; }
.example-head p, #example-count, #frame-time { margin: 0; color: var(--muted); font-size: .84rem; font-variant-numeric: tabular-nums; }
.example-nav { gap: 9px; white-space: nowrap; }
.comparison button, #results select { border: 1px solid #ccd2d8; background: white; color: var(--text); cursor: pointer; font: inherit; }
button.arrow { width: 36px; height: 36px; border-radius: 50%; font: 25px/1 Arial, sans-serif; }
.comparison button:disabled { opacity: .45; cursor: default; }
#results select { border-radius: 5px; font-size: .85rem; padding: 4px 6px; }
#results label { display: inline-flex; gap: 6px; align-items: center; font-size: .84rem; color: var(--muted); }
.compare-options { flex-wrap: wrap; gap: 8px 16px; border-top: 1px solid var(--rule); background: var(--bg-soft); }
.mode-buttons { margin-left: auto; }
.mode-buttons button { font-size: .82rem; padding: 4px 9px; }
.mode-buttons button:first-child { border-radius: 5px 0 0 5px; }
.mode-buttons button:last-child { border-radius: 0 5px 5px 0; }
.mode-buttons button[aria-pressed=true] { background: #303842; color: white; border-color: #303842; }
.compare-stage { --split: 50%; --tile: 16 / 9; position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: #303842; overflow: hidden; }
.compare-stage .view { position: relative; margin: 0; min-width: 0; aspect-ratio: var(--tile); }
.view canvas { width: 100%; height: 100%; display: block; }
.compare-stage figcaption { position: absolute; z-index: 1; left: 8px; top: 8px; margin: 0; border-radius: 4px; background: #1b2029d9; color: #fff; padding: 2px 7px; font-size: .78rem; font-weight: 600; }
.compare-stage.is-wipe { display: block; aspect-ratio: var(--tile); }
.is-wipe .view { position: absolute; inset: 0; }
.is-wipe .view-a { z-index: 1; clip-path: inset(0 calc(100% - var(--split)) 0 0); }
.is-wipe .view-b figcaption { right: 8px; left: auto; }
.wipe-range, #wipe-handle { display: none; }
.is-wipe .wipe-range { display: block; opacity: 0; position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; z-index: 4; cursor: ew-resize; touch-action: pan-y; }
.is-wipe #wipe-handle { display: block; position: absolute; pointer-events: none; left: var(--split); top: 0; bottom: 0; z-index: 3; width: 2px; background: white; box-shadow: 0 0 4px #0008; }
#wipe-handle span { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); background: #fff; color: #303842; padding: 1px 8px 3px; border-radius: 16px; white-space: nowrap; box-shadow: 0 1px 6px #0006; font: bold 21px/1 Arial; }
.compare-stage:focus-within { outline: 3px solid var(--accent); outline-offset: -3px; }
.transport { gap: 12px; }
.transport button { min-width: 58px; border-radius: 5px; padding: 4px 8px; font-size: .84rem; }
.transport input { flex: 1; min-width: 30px; }
#results input { accent-color: var(--accent); }
#frame-time { min-width: 90px; text-align: right; }
#conditioning, #media-status { margin: 0 16px 12px; font-size: .86rem; color: var(--muted); }
#conditioning summary { cursor: pointer; font-weight: 600; }
#conditioning p { margin: 8px 0; }
#reference-still { width: 190px; max-width: 100%; margin: 10px 0 0; }
@keyframes gallery-enter { from { transform: translateX(var(--enter, 12px)); opacity: .7; } to { transform: translateX(0); opacity: 1; } }
@media (prefers-reduced-motion: no-preference) { .compare-stage.enter { animation: gallery-enter .18s ease-out; } }

/* Every axis uses the same SVG viewBox and the same 320-unit column. */
.chart-scroll { overflow-x: auto; }
.eff-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,2fr); column-gap: 16px; min-width: 775px; }
.eff-card { margin: 0; display: grid; grid-template-rows: subgrid; grid-row: span 4; }
.eff-card h3 { padding: 8px 0; font-size: 1rem; }
.infra-plots, .infra-key { display: grid; grid-template-columns: 1fr 1fr; }
.eff-card img, .eff-card svg { width: 100%; height: auto; display: block; }
.eff-card .chart-key { padding: 8px 4px; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.key-row { display: flex; flex-wrap: wrap; gap: 2px 10px; align-content: start; font-size: .72rem; color: var(--muted); line-height: 1.6; }
.key-row span { white-space: nowrap; }
.r480 { color: #198d83; } .r720 { color: #ce607d; } .r1080 { color: #8c71bb; } .r4k { color: #c18a2a; }
.opt-a { color: #d99989; } .opt-b { color: #c45f56; } .opt-c { color: #952d2d; }
.eff-card figcaption { padding: 0 3px 4px; font-size: .84rem; }
.eff-card a { color: #2563a8; white-space: nowrap; }
@media (max-width: 590px) {
  .hero, main, footer { padding-left: 14px; padding-right: 14px; }
  .example-head, .compare-options, .transport { padding: 9px; }
  .result-tools { gap: 8px; }
  .mode-buttons { margin-left: 0; }
  .tabs [role=tab] { padding: 5px 9px; font-size: .83rem; }
  .compare-stage figcaption { font-size: .68rem; top: 4px; left: 4px; }
  .ex-head { grid-template-columns: 30px 1fr 30px; gap: 7px; }
}
