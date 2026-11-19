# LiveVAE project page

Project page for **LiveVAE: Causal Window Attention Makes Efficient Streaming Video VAE**.

Live site: https://ddxsg24.github.io/LiveVAE-page/

## Layout

```
index.html               the whole page
static/css/style.css     styles
static/js/main.js        lazy loading for the comparison videos, BibTeX copy button
static/images/           paper figures (teaser, motivation, method overview, efficiency plots)
static/videos/           reference to video comparisons (code video | MiniMax-H3 VAE | LiveVAE)
```

The site is plain HTML served by GitHub Pages from the `main` branch, so there is no build step. Edit `index.html` and push.

## Updating links

When the paper, code and models are public, replace the three disabled buttons in the `links` block of `index.html` with real links, for example:

```html
<a class="button" href="https://arxiv.org/abs/XXXX.XXXXX">Paper</a>
```

Then fill `\projectpageurl` in the paper's `main.tex` with the live site address above.

## Videos

Each comparison video is three panels stacked horizontally (640×360 each, 12 px gaps), H.264 at 24 fps. To add one, compose it the same way and add a `<figure class="clip">` block in the gallery.
