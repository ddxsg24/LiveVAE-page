// Each comparison uses one video clock. The canvases sample tiles from the very same frame.
const videoDir = 'static/videos/';
const $ = (name) => document.getElementById(name);
const format = (n) => Number(n.toFixed(2)).toString();
const taskNotes = {
  recon: 'Compare the input and its reconstruction at the same frame. Choose a VAE to compare against LiveVAE.',
  r2v: 'MiniMax-H3 generations conditioned on the same reference image, code video and prompt. Each VAE encodes the reference and decodes the result.',
  t2v: 'The official MiniMax-H3 VAE and LiveVAE decode the same generated latents.',
};

function startGallery(clips) {
  const stage = $('compare-stage');
  const canvases = [...stage.querySelectorAll('canvas')];
  const availableTasks = new Set(Object.values(clips).map(c => c.task.split('_')[0]));
  const tabs = [...document.querySelectorAll('#results [role=tab]')].filter(tab => {
    tab.hidden = !availableTasks.has(tab.dataset.task);
    return !tab.hidden;
  });
  const method = $('compare-method');
  const resolution = $('result-resolution');
  const time = $('compare-time');
  const playButton = $('compare-play');
  const crop = $('native-detail');
  const mediaStatus = $('media-status');
  let task = 'recon', examples = [], index = 0;
  let video, poster, tiles, panel, frameCallback, animationFrame;
  let resumeTime = 0, inView = false, wantsPlay = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ready = false;
  const curr = () => examples[index][1];
  const option = (label, value) => new Option(label, value);

  function draw(source) {
    const [w, h] = panel;
    const cols = curr().grid[0];
    const gap = curr().gutter || 0;
    tiles.forEach((tile, i) => {
      const x = (tile % cols) * (w + gap), y = Math.floor(tile / cols) * (h + gap);
      canvases[i].getContext('2d').drawImage(source, x, y, w, h, 0, 0, w, h);
    });
  }
  function render(mediaTime) {
    if (!video || video.readyState < 2) {
      if (poster?.naturalWidth) draw(poster);
      return;
    }
    draw(video);
    const frame = Math.min(curr().frames - 1, Math.floor((mediaTime ?? video.currentTime) * curr().fps + .001));
    time.value = frame;
    $('frame-time').textContent = 'Frame ' + (frame + 1) + ' / ' + curr().frames;
  }
  function stopPainter() {
    if (frameCallback != null && video?.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameCallback);
    cancelAnimationFrame(animationFrame);
    frameCallback = animationFrame = null;
  }
  function paintWhilePlaying() {
    stopPainter();
    if (video.paused) return;
    if (video.requestVideoFrameCallback) {
      frameCallback = video.requestVideoFrameCallback((_, meta) => {
        frameCallback = null;
        render(meta.mediaTime);
        paintWhilePlaying();
      });
    } else {
      animationFrame = requestAnimationFrame(() => { render(); paintWhilePlaying(); });
    }
  }
  function syncPlayback() {
    if (!video) return;
    if (inView && !document.hidden && ready && wantsPlay) video.play().catch(() => {});
    else video.pause();
  }
  function useMedia(at = 0) {
    stopPainter();
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    const [name, c] = examples[index];
    const detail = crop.checked && c.detail;
    const path = videoDir + name + (detail ? '_detail' : '');
    panel = detail || c.panel;
    const [w, h] = panel;
    stage.style.setProperty('--tile', w + ' / ' + h);
    canvases.forEach(canvas => { canvas.width = w; canvas.height = h; });
    tiles = [Number(method.value), c.labels.length - 1];
    ready = false;
    resumeTime = at;
    mediaStatus.hidden = true;
    time.max = c.frames - 1;
    time.value = Math.min(c.frames-1, Math.floor(at*c.fps));
    $('frame-time').textContent = 'Frame ' + (+time.value + 1) + ' / ' + c.frames;
    playButton.textContent = 'Play';
    playButton.setAttribute('aria-label', 'Play comparison');
    const still = new Image();
    poster = still;
    still.onload = () => { if (still === poster && video.readyState < 2) draw(still); };
    const player = document.createElement('video');
    video = player;
    player.muted = player.loop = player.playsInline = true;
    player.preload = 'none';
    player.addEventListener('loadedmetadata', () => {
      if (video !== player) return;
      if (resumeTime > 0) player.currentTime = Math.min(resumeTime, (c.frames - 1) / c.fps);
    });
    player.addEventListener('loadeddata', () => {
      if (video !== player) return;
      ready = true; render(); syncPlayback();
    });
    player.addEventListener('seeked', () => { if (video === player) render(); });
    player.addEventListener('play', () => {
      if (video !== player) return;
      playButton.textContent = 'Pause'; playButton.setAttribute('aria-label', 'Pause comparison');
      paintWhilePlaying();
    });
    player.addEventListener('pause', () => {
      if (video !== player) return;
      stopPainter(); render();
      playButton.textContent = 'Play'; playButton.setAttribute('aria-label', 'Play comparison');
    });
    player.addEventListener('error', () => {
      if (video !== player || !player.hasAttribute('src')) return;
      mediaStatus.textContent = 'This video could not be loaded. Select another example or reload the page.';
      mediaStatus.hidden = false;
    });
    still.src = path + '.jpg';
    player.dataset.src = path + '.mp4';
    if (inView) loadCurrentVideo();
  }
  function loadCurrentVideo() {
    if (!video || video.hasAttribute('src')) return;
    video.preload = 'auto';
    video.src = video.dataset.src;
    video.load();
  }
  function selectExample(direction = 0) {
    const [, c] = examples[index];
    const prevMethod = method.selectedOptions[0]?.text;
    method.replaceChildren(...c.labels.slice(0, -1).map((label, n) => option(label, n)));
    const matched = [...method.options].find(o => o.text === prevMethod);
    method.value = matched?.value ?? (task === 'r2v' ? '1' : '0');
    method.parentElement.hidden = method.options.length < 2;
    $('left-label').textContent = method.selectedOptions[0].text;
    crop.checked = false;
    crop.parentElement.hidden = !c.detail;
    $('example-title').textContent = c.title;
    const source = c.source ? c.source.join(' × ') : 'Web preview';
    $('example-meta').textContent = [c.resolution, source, format(c.seconds) + ' s', format(c.fps) + ' fps', c.frames + ' frames'].filter(Boolean).join(' · ');
    $('example-count').textContent = (index + 1) + ' / ' + examples.length;
    for (const id of ['previous-example','next-example']) $(id).disabled = examples.length < 2;
    const inputs = $('conditioning');
    inputs.hidden = !c.prompt && !c.reference;
    inputs.open = false;
    $('example-prompt').textContent = c.prompt || '';
    $('reference-still').hidden = !c.reference;
    if (c.reference) $('reference-still').src = videoDir + c.reference;
    else $('reference-still').removeAttribute('src');
    stage.classList.remove('enter');
    if (direction) {
      stage.style.setProperty('--enter', direction * 16 + 'px');
      void stage.offsetWidth;
      stage.classList.add('enter');
    }
    useMedia();
  }
  function filter(resetResolution = false) {
    const recon = task === 'recon';
    $('model-filter').hidden = $('resolution-filter').hidden = !recon;
    let list = Object.entries(clips).filter(([, c]) => c.task === (recon ? 'recon_' + $('result-model').value : task));
    if (recon && resetResolution) {
      const available = new Set(list.map(([, c]) => c.resolution));
      resolution.replaceChildren(option('All', ''), ...['480p','720p','1080p','4K'].filter(r=>available.has(r)).map(r=>option(r,r)));
    }
    if (recon && resolution.value) list = list.filter(([, c]) => c.resolution === resolution.value);
    if (!list.length) throw new Error('No matching video examples.');
    examples = list; index = 0;
    selectExample();
  }
  function changeTask(tab) {
    task = tab.dataset.task;
    tabs.forEach(t => { t.tabIndex = t === tab ? 0 : -1; t.setAttribute('aria-selected', t === tab); });
    $('result-view').setAttribute('aria-labelledby', tab.id);
    $('task-note').textContent = taskNotes[task];
    filter(true);
  }
  function advance(d) {
    if (examples.length < 2) return;
    index = (index + d + examples.length) % examples.length;
    selectExample(d);
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
  $('result-model').addEventListener('change', () => filter(true));
  resolution.addEventListener('change', () => filter());
  $('previous-example').addEventListener('click', () => advance(-1));
  $('next-example').addEventListener('click', () => advance(1));
  const carousel = stage.closest('.comparison');
  carousel.addEventListener('keydown', e => {
    if (e.target !== carousel) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); advance(e.key === 'ArrowRight' ? 1 : -1);
    }
  });
  method.addEventListener('change', () => {
    tiles[0] = Number(method.value);
    $('left-label').textContent = method.selectedOptions[0].text;
    render();
  });
  crop.addEventListener('change', () => useMedia(video?.currentTime || 0));
  for (const mode of ['side','wipe']) $('mode-' + mode).addEventListener('click', () => {
    stage.classList.toggle('is-wipe', mode === 'wipe');
    $('mode-side').setAttribute('aria-pressed', mode === 'side');
    $('mode-wipe').setAttribute('aria-pressed', mode === 'wipe');
    render();
  });
  $('wipe-range').addEventListener('input', e => stage.style.setProperty('--split', e.target.value + '%'));
  playButton.addEventListener('click', () => {
    wantsPlay = video.paused; loadCurrentVideo(); syncPlayback();
  });
  time.addEventListener('input', () => {
    wantsPlay = false; video.pause();
    resumeTime = (+time.value + .1) / curr().fps;
    loadCurrentVideo();
    if (video.readyState >= 1) video.currentTime = resumeTime;
  });
  document.addEventListener('visibilitychange', syncPlayback);
  changeTask(tabs[0]);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) loadCurrentVideo();
      syncPlayback();
    }).observe(stage);
  } else { inView = true; loadCurrentVideo(); }
}
fetch(videoDir + 'clips.json')
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
