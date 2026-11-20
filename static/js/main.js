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
