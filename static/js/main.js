// Result galleries are built from static/videos/clips.json, which tools/build_videos.py
// writes. Every clip is one video holding all methods side by side, so the panels of a
// clip never drift apart; each clip keeps its own frame count and frame rate.
const VIDEO_DIR = 'static/videos/';

const fmt = (x) => String(Number(x.toFixed(2)));

function renderClip(name, c) {
  const fig = document.createElement('figure');
  fig.className = 'clip';
  const cap = document.createElement('figcaption');
  cap.textContent = c.title;
  const dur = document.createElement('span');
  dur.className = 'dur';
  dur.textContent = `${c.frames} frames · ${fmt(c.fps)} fps · ${fmt(c.frames / c.fps)} s`;
  cap.appendChild(dur);

  const media = document.createElement('div');
  media.className = 'clip-media';
  const video = document.createElement('video');
  Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'none' });
  video.setAttribute('muted', '');
  video.dataset.src = `${VIDEO_DIR}${name}.mp4`;
  video.poster = `${VIDEO_DIR}${name}.jpg`;
  video.width = c.width;
  video.height = c.height;
  media.appendChild(video);

  // Grids of more than one row get their labels on top of each panel.
  const [gx, gy] = c.grid;
  if (gy > 1) {
    const [pw, ph] = c.panel;
    c.labels.forEach((text, i) => {
      const tag = document.createElement('span');
      tag.className = /ours/i.test(text) ? 'panel-tag ours' : 'panel-tag';
      tag.textContent = text;
      tag.style.left = `${(100 * (i % gx) * (pw + c.gutter)) / c.width}%`;
      tag.style.top = `${(100 * Math.floor(i / gx) * (ph + c.gutter)) / c.height}%`;
      media.appendChild(tag);
    });
  }
  fig.append(cap, media);
  return fig;
}

// A single row of panels gets one sticky header whose columns match the panel widths.
function renderHead(c) {
  const head = document.createElement('div');
  head.className = 'video-head';
  const [gx] = c.grid;
  const [pw] = c.panel;
  head.style.gridTemplateColumns = c.labels.slice(0, gx)
    .map((_, i) => `${pw + (i < gx - 1 ? c.gutter : 0)}fr`).join(' ');
  c.labels.slice(0, gx).forEach((text) => {
    const span = document.createElement('span');
    span.textContent = text;
    if (/ours/i.test(text)) span.className = 'ours';
    head.appendChild(span);
  });
  return head;
}

function setupTabs() {
  document.querySelectorAll('[role="tablist"][data-group]').forEach((list) => {
    const group = list.dataset.group;
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const panels = [...document.querySelectorAll(`[role="tabpanel"][data-group="${group}"]`)];
    // Hide tabs whose panel has no clips yet.
    tabs.forEach((t) => {
      const panel = panels.find((p) => p.dataset.tab === t.dataset.tab);
      t.hidden = !panel || !panel.querySelector('.clip');
    });
    const shown = tabs.filter((t) => !t.hidden);
    list.hidden = shown.length < 2;
    const select = (name) => {
      tabs.forEach((t) => {
        const on = t.dataset.tab === name;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach((p) => {
        p.hidden = p.dataset.tab !== name;
        if (p.hidden) p.querySelectorAll('video').forEach((v) => v.pause());
      });
    };
    list.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (tab) select(tab.dataset.tab);
    });
    list.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      const i = shown.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      const next = shown[(i + step + shown.length) % shown.length];
      select(next.dataset.tab);
      next.focus();
    });
    if (shown.length) select(shown[0].dataset.tab);
  });
}

// Load and play each video only while it is on screen.
function setupVideos() {
  const videos = document.querySelectorAll('video[data-src]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          if (!video.src) video.src = video.dataset.src;
          video.play().catch(() => {});
        } else if (!video.paused) {
          video.pause();
        }
      });
    }, { rootMargin: '200px 0px' });
    videos.forEach((video) => observer.observe(video));
  } else {
    videos.forEach((video) => { video.src = video.dataset.src; video.autoplay = true; });
  }
  // Click a clip to restart it from its first frame.
  videos.forEach((video) => video.addEventListener('click', () => {
    video.currentTime = 0;
    video.play().catch(() => {});
  }));
}

fetch(`${VIDEO_DIR}clips.json`)
  .then((r) => r.json())
  .catch(() => ({}))
  .then((clips) => {
    document.querySelectorAll('.gallery[data-task]').forEach((gallery) => {
      const entries = Object.entries(clips).filter(([, c]) => c.task === gallery.dataset.task);
      if (!entries.length) return;
      if (entries[0][1].grid[1] === 1) gallery.appendChild(renderHead(entries[0][1]));
      entries.forEach(([name, c]) => gallery.appendChild(renderClip(name, c)));
    });
    setupTabs();
    setupVideos();
  });

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
