// Results: every clip is one composite video, so all of its panels share one clock.
// "All panels" shows the composite with a label on each panel; "Wipe" paints two panels
// of the same frame onto canvases and lets the reader drag the divider.
const videoDir = 'static/videos/';
const $ = (id) => document.getElementById(id);
const format = (n) => Number(n.toFixed(2)).toString();
const taskNotes = {
  recon: 'Every VAE encodes and decodes the same clip at its source resolution.',
  r2v: 'The clay render comes from the code world model. MiniMax-H3 turns it into video conditioned on the same reference image and prompt; each VAE encodes the reference and decodes the result.',
  t2v: 'Both VAEs decode the same generated latents.',
};

function startGallery(clips) {
  const allView = $('all-view'), wipeView = $('wipe-view'), stage = $('compare-stage');
  const canvases = [...stage.querySelectorAll('canvas')];
  // A tab whose task has no clips in the manifest stays hidden.
  const tasks = new Set(Object.values(clips).map(c => c.task.split('_')[0]));
  const tabs = [...document.querySelectorAll('#results [role=tab]')].filter(tab => {
    tab.hidden = !tasks.has(tab.dataset.task);
    return !tab.hidden;
  });
  const modelButtons = [...document.querySelectorAll('#latent-switch button')];
  const method = $('compare-method');
  const time = $('compare-time');
  const playButton = $('compare-play');
  const mediaStatus = $('media-status');
  let task = 'recon', model = 'h3', mode = 'all', examples = [], index = 0;
  let video, poster, animationFrame = 0, inView = false, ready = false;
  let wantsPlay = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const curr = () => examples[index][1];

  function drawWipe(source) {
    const c = curr(), [w, h] = c.panel, cols = c.grid[0], gap = c.gutter || 0;
    [Number(method.value), c.labels.length - 1].forEach((tile, i) => {
      const x = (tile % cols) * (w + gap), y = Math.floor(tile / cols) * (h + gap);
      canvases[i].getContext('2d').drawImage(source, x, y, w, h, 0, 0, w, h);
    });
  }
  function render() {
    const c = curr();
    if (mode === 'wipe') {
      if (video && video.readyState >= 2) drawWipe(video);
      else if (poster?.naturalWidth) drawWipe(poster);
    }
    const frame = video && video.readyState >= 1
      ? Math.min(c.frames - 1, Math.floor(video.currentTime * c.fps + .001)) : +time.value;
    time.value = frame;
    $('frame-time').textContent = 'Frame ' + (frame + 1) + ' / ' + c.frames;
  }
  function loop() {
    render();
    animationFrame = video && !video.paused ? requestAnimationFrame(loop) : 0;
  }
  function syncPlayback() {
    if (!video) return;
    if (inView && !document.hidden && ready && wantsPlay) video.play().catch(() => {});
    else video.pause();
  }
  function loadCurrentVideo() {
    if (!video || video.hasAttribute('src')) return;
    video.preload = 'auto';
    video.src = video.dataset.src;
    video.load();
  }
  function useMedia() {
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); video.remove(); }
    cancelAnimationFrame(animationFrame); animationFrame = 0;
    const [name, c] = examples[index];
    const path = videoDir + name;
    ready = false;
    mediaStatus.hidden = true;
    time.max = c.frames - 1;
    time.value = 0;
    playButton.textContent = 'Play';
    playButton.setAttribute('aria-label', 'Play comparison');

    allView.style.aspectRatio = c.width + ' / ' + c.height;
    stage.style.setProperty('--tile', c.panel[0] + ' / ' + c.panel[1]);
    canvases.forEach(canvas => { canvas.width = c.panel[0]; canvas.height = c.panel[1]; });

    const still = new Image();
    poster = still;
    still.onload = () => { if (still === poster) render(); };
    still.src = path + '.jpg';

    const player = document.createElement('video');
    video = player;
    player.muted = player.loop = player.playsInline = true;
    player.preload = 'none';
    player.poster = path + '.jpg';
    player.setAttribute('aria-label', c.title + ': ' + c.labels.join(', '));
    player.dataset.src = path + '.mp4';
    player.addEventListener('loadeddata', () => {
      if (video !== player) return;
      ready = true; render(); syncPlayback();
    });
    player.addEventListener('seeked', () => { if (video === player) render(); });
    player.addEventListener('play', () => {
      if (video !== player) return;
      playButton.textContent = 'Pause'; playButton.setAttribute('aria-label', 'Pause comparison');
      if (!animationFrame) animationFrame = requestAnimationFrame(loop);
    });
    player.addEventListener('pause', () => {
      if (video !== player) return;
      render();
      playButton.textContent = 'Play'; playButton.setAttribute('aria-label', 'Play comparison');
    });
    player.addEventListener('error', () => {
      if (video !== player || !player.hasAttribute('src')) return;
      mediaStatus.textContent = 'This video could not be loaded. Select another example or reload the page.';
      mediaStatus.hidden = false;
    });
    allView.prepend(player);
    render();
    if (inView) loadCurrentVideo();
  }
  function placeLabels(c) {
    const [w, h] = c.panel, [cols] = c.grid, gap = c.gutter || 0;
    $('all-labels').replaceChildren(...c.labels.map((label, i) => {
      const tag = document.createElement('span');
      tag.textContent = label;
      tag.style.left = ((i % cols) * (w + gap)) / c.width * 100 + '%';
      tag.style.top = (Math.floor(i / cols) * (h + gap)) / c.height * 100 + '%';
      if (i === c.labels.length - 1) tag.className = 'ours';
      return tag;
    }));
  }
  function selectExample(direction = 0) {
    const [, c] = examples[index];
    const previous = method.selectedOptions[0]?.text;
    method.replaceChildren(...c.labels.slice(0, -1).map((label, n) => new Option(label, n)));
    const matched = [...method.options].find(o => o.text === previous);
    method.value = matched?.value ?? (task === 'r2v' ? '1' : '0');
    $('left-label').textContent = method.selectedOptions[0].text;
    $('example-title').textContent = c.title;
    $('example-meta').textContent = [c.resolution, format(c.seconds) + ' s', format(c.fps) + ' fps', c.frames + ' frames'].filter(Boolean).join(' · ');
    $('example-count').textContent = (index + 1) + ' / ' + examples.length;
    for (const id of ['previous-example', 'next-example']) $(id).disabled = examples.length < 2;
    placeLabels(c);
    const shown = mode === 'all' ? allView : stage;
    shown.classList.remove('enter');
    if (direction) {
      shown.style.setProperty('--enter', direction * 16 + 'px');
      void shown.offsetWidth;
      shown.classList.add('enter');
    }
    useMedia();
  }
  function filter() {
    const key = task === 'recon' ? 'recon_' + model : task;
    examples = Object.entries(clips).filter(([, c]) => c.task === key);
    if (!examples.length) throw new Error('No matching video examples.');
    index = 0;
    selectExample();
  }
  function changeTask(tab) {
    task = tab.dataset.task;
    tabs.forEach(t => { t.tabIndex = t === tab ? 0 : -1; t.setAttribute('aria-selected', t === tab); });
    $('result-view').setAttribute('aria-labelledby', tab.id);
    $('task-note').textContent = taskNotes[task];
    $('latent-switch').hidden = task !== 'recon';
    filter();
  }
  function advance(d) {
    if (examples.length < 2) return;
    index = (index + d + examples.length) % examples.length;
    selectExample(d);
  }
  function setMode(next) {
    mode = next;
    allView.hidden = mode !== 'all';
    wipeView.hidden = mode !== 'wipe';
    $('mode-all').setAttribute('aria-pressed', mode === 'all');
    $('mode-wipe').setAttribute('aria-pressed', mode === 'wipe');
    render();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => changeTask(tab));
    tab.addEventListener('keydown', e => {
      const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = tabs[(i + d + tabs.length) % tabs.length];
      changeTask(next); next.focus();
    });
  });
  modelButtons.forEach(button => button.addEventListener('click', () => {
    model = button.dataset.model;
    modelButtons.forEach(b => b.setAttribute('aria-pressed', b === button));
    filter();
  }));
  $('previous-example').addEventListener('click', () => advance(-1));
  $('next-example').addEventListener('click', () => advance(1));
  const carousel = document.querySelector('#results .comparison');
  carousel.addEventListener('keydown', e => {
    if (e.target !== carousel) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); advance(e.key === 'ArrowRight' ? 1 : -1);
    }
  });
  method.addEventListener('change', () => {
    $('left-label').textContent = method.selectedOptions[0].text;
    render();
  });
  $('mode-all').addEventListener('click', () => setMode('all'));
  $('mode-wipe').addEventListener('click', () => setMode('wipe'));
  $('wipe-range').addEventListener('input', e => stage.style.setProperty('--split', e.target.value + '%'));
  playButton.addEventListener('click', () => {
    wantsPlay = video.paused; loadCurrentVideo(); syncPlayback();
  });
  time.addEventListener('input', () => {
    wantsPlay = false; video.pause();
    loadCurrentVideo();
    const at = (+time.value + .1) / curr().fps;
    if (video.readyState >= 1) video.currentTime = at;
    else video.addEventListener('loadedmetadata', () => { video.currentTime = at; }, { once: true });
    $('frame-time').textContent = 'Frame ' + (+time.value + 1) + ' / ' + curr().frames;
  });
  document.addEventListener('visibilitychange', syncPlayback);
  changeTask(tabs[0]);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) loadCurrentVideo();
      syncPlayback();
    }).observe(carousel);
  } else { inView = true; loadCurrentVideo(); }
}

// no-cache revalidates with the server, so a manifest cached before an update is never used.
fetch(videoDir + 'clips.json', { cache: 'no-cache' })
  .then(response => { if (!response.ok) throw Error(); return response.json(); })
  .then(startGallery)
  .catch(() => { $('example-title').textContent = 'Video examples could not be loaded.'; });

document.querySelectorAll('.copy').forEach((button) => {
  button.addEventListener('click', async () => {
    const text = document.getElementById(button.dataset.target).innerText;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch (err) {
      button.textContent = 'Select and copy';
    }
    setTimeout(() => { button.textContent = 'Copy'; }, 1600);
  });
});

// Speed comparison, from Table 1 of the paper. Each entry gives [encoder ms, decoder ms, PSNR]
// at 480p, 720p, 1080p and 2160p. Encoder null: the method keeps the official encoder.
// null for a whole resolution: out of memory.
const speedData = {
  h3: [
    { name: 'MiniMax-H3', kind: 'official', r: [[623.0, 435.3, 32.99], [1453.5, 1010.6, 34.31], [3107.5, 2152.0, 35.86], [11465.1, 8026.2, 38.68]] },
    { name: 'TAEH3', kind: 'both', r: [[7.6, 9.4, 27.59], [15.4, 20.3, 28.72], [32.7, 44.8, 29.99], [134.4, 176.5, 32.28]] },
    { name: 'LightVAE-Lite', kind: 'both', r: [[339.4, 146.9, 29.71], [789.5, 341.3, 31.05], [1691.8, 730.4, 32.54], [6254.1, 2715.8, 35.39]] },
    { name: 'LynnReal-Omni', kind: 'dec', r: [[null, 285.7, 33.16], [null, 659.5, 34.43], [null, 1398.1, 35.94], [null, 5231.7, 38.77]] },
    { name: 'Solar-X', kind: 'dec', r: [[null, 273.5, 31.62], [null, 619.7, 32.93], [null, 1332.6, 34.46], null] },
    { name: 'StreamRender-H3', kind: 'dec', r: [[null, 331.4, 31.86], [null, 647.0, 33.13], [null, 1323.9, 34.75], [null, 4805.5, 37.57]] },
    { name: 'LiveVAE', kind: 'ours', r: [[119.5, 146.0, 33.06], [234.3, 303.4, 34.74], [514.2, 660.2, 36.76], [1856.0, 2445.0, 39.05]] },
    { name: 'LiveVAE-Opt', kind: 'ours', r: [[78.6, 78.6, 33.06], [92.5, 126.7, 34.74], [165.9, 225.9, 36.63], [656.7, 912.2, 39.07]] },
  ],
  wan22: [
    { name: 'Wan2.2', kind: 'official', r: [[175.0, 560.3, 36.08], [382.8, 1264.2, 37.66], [842.3, 2812.4, 39.55], [3463.5, 13446.6, 42.69]] },
    { name: 'TAEW2.2', kind: 'both', r: [[14.4, 16.9, 30.10], [17.9, 22.8, 31.49], [32.5, 42.3, 33.11], [116.2, 154.3, 36.11]] },
    { name: 'TAEW2.2-Super', kind: 'both', r: [[12.1, 22.0, 31.49], [18.0, 46.8, 32.89], [32.7, 102.8, 34.55], [116.3, 399.4, 37.62]] },
    { name: 'LightTAE', kind: 'both', r: [[14.3, 16.7, 27.93], [18.4, 23.2, 28.88], [32.5, 42.3, 29.91], [116.6, 154.7, 31.72]] },
    { name: 'LightVAE-Lite', kind: 'dec', r: [[null, 196.1, 32.64], [null, 438.5, 34.28], [null, 985.5, 36.23], [null, 4724.9, 39.97]] },
    { name: 'LightVAE-Pro', kind: 'dec', r: [[null, 358.0, 35.30], [null, 786.2, 36.91], [null, 1743.8, 38.82], [null, 8351.0, 42.25]] },
    { name: 'Turbo-VAED', kind: 'dec', r: [[null, 306.1, 32.79], [null, 708.7, 34.37], [null, 1734.9, 36.24], [null, 8269.8, 39.56]] },
    { name: 'LiveVAE', kind: 'ours', r: [[124.9, 119.5, 34.46], [261.5, 254.9, 36.24], [569.7, 552.4, 38.40], [2127.6, 2066.0, 42.24]] },
  ],
};

(function speedChart() {
  const root = $('speed-chart');
  if (!root) return;
  const rowsBox = $('speed-rows'), axis = root.querySelector('.speed-axis');
  const state = { model: 'h3', res: 1, part: 'e2e' };
  const maxLog = 2; // the bar axis runs from 1x to 100x on a log scale
  const ticks = [1, 2, 5, 10, 20, 50, 100];
  const at = (v) => Math.min(100, Math.max(0, Math.log10(v) / maxLog * 100));
  const kindLabel = { official: 'Official', both: 'Encoder + decoder', dec: 'Decoder only', ours: 'Encoder + decoder' };
  const ms = (v) => v >= 1000 ? (v / 1000).toFixed(2) + ' s' : v.toFixed(v < 100 ? 1 : 0) + ' ms';
  axis.innerHTML = '<span></span><span></span><span class="sp-ticks">'
    + ticks.map(t => `<span class="${[2, 20, 50].includes(t) ? 'minor' : ''}" style="left:${at(t)}%">${t}&times;</span>`).join('') + '</span>';
  // Faint vertical lines at the ticks, drawn behind every bar.
  root.style.setProperty('--grid', ticks.map(t =>
    `linear-gradient(90deg, transparent calc(${at(t)}% - .5px), #e3e6ea calc(${at(t)}% - .5px), #e3e6ea calc(${at(t)}% + .5px), transparent calc(${at(t)}% + .5px))`).join(','));

  function draw() {
    const rows = speedData[state.model];
    const [oe, od, op] = rows[0].r[state.res];
    rowsBox.innerHTML = rows.map(row => {
      const cell = row.r[state.res];
      const name = `<span class="sp-name">${row.name}</span><span class="sp-kind">${kindLabel[row.kind]}</span>`;
      if (!cell) return `<div class="sp-row ${row.kind}" role="row">${name}<span class="sp-bar"><em>Out of memory</em></span><span></span><span></span></div>`;
      const enc = cell[0] ?? oe, dec = cell[1];
      const time = { e2e: enc + dec, enc, dec }[state.part];
      const base = { e2e: oe + od, enc: oe, dec: od }[state.part];
      const x = base / time;
      const keepsOfficial = row.kind === 'dec' && state.part === 'enc';
      const bar = row.kind === 'official'
        ? '<span class="sp-bar"><b class="ref">1&times; reference</b></span>'
        : keepsOfficial
          ? '<span class="sp-bar"><em>Official encoder</em></span>'
          : `<span class="sp-bar"><i style="width:${at(x)}%"></i><b class="${at(x) > 72 ? 'inside' : ''}" style="left:${at(x)}%">${x.toFixed(1)}&times;</b></span>`;
      const d = cell[2] - op;
      const psnr = row.kind === 'official' ? `<span class="sp-psnr ref">${op.toFixed(2)} dB</span>`
        : `<span class="sp-psnr ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : '&minus;'}${Math.abs(d).toFixed(2)} dB</span>`;
      return `<div class="sp-row ${row.kind}" role="row">${name}${bar}<span class="sp-time">${ms(time)}</span>${psnr}</div>`;
    }).join('');
  }

  root.querySelectorAll('.switch').forEach(group => {
    group.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;
      group.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === button));
      state[group.dataset.key] = group.dataset.key === 'res' ? +button.dataset.value : button.dataset.value;
      draw();
    });
  });
  draw();
})();
