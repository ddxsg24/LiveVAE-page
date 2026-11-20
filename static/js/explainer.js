// Step explainers of the Locality and Method sections.
// Each step has a duration and a draw(t, view) that renders the step at progress t in [0, 1],
// so playing, pausing, jumping to a step and reduced motion all go through the same code.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = x => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
  const part = (t, a, b) => clamp((t - a) / (b - a));
  // Piecewise path through [time, value] keys, eased between keys.
  const keys = (t, pts) => {
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) {
        const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
        return v0 + (v1 - v0) * ease(part(t, t0, t1));
      }
    }
    return pts[pts.length - 1][1];
  };
  const lerpList = (list, x) => {
    const i = Math.min(list.length - 2, Math.floor(x));
    return list[i] + (list[i + 1] - list[i]) * (x - i);
  };
  function svg(parent, name, attrs = {}, text) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    parent.append(node);
    return node;
  }

  // Shared player: head with arrows and step text, the stage, then play button, segments and counter.
  function stepper(root, draws) {
    const views = [...root.querySelectorAll('.step-view')];
    const stage = root.querySelector('.step-stage');
    const arrow = (label, d) => `<button type="button" class="step-arrow" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg></button>`;
    const head = document.createElement('div');
    head.className = 'step-head';
    head.innerHTML = arrow('Previous step', 'M15 5l-7 7 7 7') +
      '<div class="step-words" aria-live="polite"><p class="step-title"><span class="step-n"></span><span class="step-name"></span></p><p class="step-line"></p></div>' +
      arrow('Next step', 'M9 5l7 7-7 7');
    root.prepend(head);
    const bar = document.createElement('div');
    bar.className = 'step-bar';
    bar.innerHTML = '<button type="button" class="step-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path/></svg></button><div class="step-segments"></div><span class="step-count"></span>';
    stage.after(bar);
    const [prev, next] = head.querySelectorAll('.step-arrow');
    const play = bar.querySelector('.step-play');
    const segments = views.map((v, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg';
      b.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + v.dataset.title);
      b.innerHTML = '<i></i>';
      b.addEventListener('click', () => select(i));
      bar.querySelector('.step-segments').append(b);
      return b;
    });
    let step = 0, elapsed = 0, handle = 0, last = 0, visible = false, wantsPlay = !reduced;
    const duration = () => +views[step].dataset.duration || 6000;
    const playing = () => wantsPlay && visible && !document.hidden;

    function render() {
      const t = clamp(elapsed / duration());
      draws[step](t, views[step]);
      segments.forEach((s, i) => s.firstChild.style.width = (i < step ? 100 : i > step ? 0 : t * 100) + '%');
    }
    function select(n) {
      step = (n + views.length) % views.length;
      // While paused, show the finished state of the chosen step.
      elapsed = playing() ? 0 : duration();
      views.forEach((v, i) => { v.hidden = i !== step; });
      head.querySelector('.step-n').textContent = step + 1;
      head.querySelector('.step-name').textContent = views[step].dataset.title;
      head.querySelector('.step-line').textContent = views[step].dataset.line;
      bar.querySelector('.step-count').textContent = (step + 1) + ' / ' + views.length;
      segments.forEach((s, i) => s.setAttribute('aria-current', i === step ? 'step' : 'false'));
      render();
    }
    function frame(now) {
      elapsed += Math.min(now - last, 100);
      last = now;
      if (elapsed >= duration()) { elapsed = 0; select(step + 1); }
      render();
      handle = requestAnimationFrame(frame);
    }
    function sync() {
      const on = playing();
      if (on && !handle) {
        if (elapsed >= duration()) elapsed = 0;
        last = performance.now();
        handle = requestAnimationFrame(frame);
      }
      if (!on && handle) { cancelAnimationFrame(handle); handle = 0; }
      play.setAttribute('aria-label', on ? 'Pause' : 'Play');
      play.querySelector('path').setAttribute('d', on ? 'M8 5h3v14H8zM13 5h3v14h-3z' : 'M8 5l11 7-11 7z');
    }
    prev.addEventListener('click', () => select(step - 1));
    next.addEventListener('click', () => select(step + 1));
    play.addEventListener('click', () => { wantsPlay = !playing(); visible = true; sync(); });
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { threshold: .25 }).observe(root);
    } else { visible = true; }
    // Draw every step once so the stage is sized by the tallest step from the start.
    views.forEach((v, i) => draws[i](1, v));
    select(0);
    sync();
  }

  /* ---------- Locality ---------- */

  const MODEL_COLORS = ['#2f6fb7', '#d1495b', '#5d97d6', '#e0707f'];

  function drawProbe(t, view) {
    const g = view.querySelector('.probe-grid');
    if (!g.firstChild) {
      const c = 73.2, cell = 3.4, x0 = c - 7.5 * cell;
      for (let j = 0; j < 15; j++) for (let i = 0; i < 15; i++) {
        svg(g, 'rect', { x: x0 + i * cell, y: x0 + j * cell, width: cell, height: cell,
          'data-ring': Math.max(Math.abs(i - 7), Math.abs(j - 7)) });
      }
      svg(g, 'circle', { class: 'pulse', cx: c, cy: c, r: 2 });
      svg(g, 'circle', { class: 'dot', cx: c, cy: c, r: 1.6 });
    }
    // Rings of the 15 x 15 neighborhood appear from the probe outward.
    g.querySelectorAll('rect').forEach(r => {
      const ring = +r.dataset.ring;
      r.style.opacity = part(t, .12 + ring * .045, .2 + ring * .045);
      r.classList.toggle('center', ring === 0);
    });
    const pulse = g.querySelector('.pulse');
    const beat = (t * 3) % 1;
    pulse.setAttribute('r', 1.8 + beat * 5);
    pulse.style.opacity = (1 - beat) * .8;
    const show = ease(part(t, .5, .75));
    view.querySelector('.probe-link').style.opacity = show;
    const map = view.querySelector('.probe-map');
    map.style.opacity = show;
    map.style.transform = 'translateX(' + (1 - show) * -14 + 'px)';
  }

  function drawSpace(t, view) {
    // Window index: 0 = 3x3, 1 = 5x5, 2 = 7x7, 3 = 9x9; it rests on 7x7.
    const idx = keys(t, [[0, 0], [.13, 0], [.21, 1], [.32, 1], [.40, 2], [.51, 2], [.59, 3], [.69, 3], [.77, 2], [1, 2]]);
    const k = 3 + 2 * idx;
    view.querySelectorAll('.erf').forEach((erf, n) => {
      const values = erf.dataset.values.split(' ').map(Number);
      const win = erf.querySelector('i');
      const size = k / 15 * 100;
      win.style.width = win.style.height = size + '%';
      win.style.left = win.style.top = (100 - size) / 2 + '%';
      erf.querySelector('b').textContent = lerpList(values, idx).toFixed(1) + '%';
      erf.style.setProperty('--c', MODEL_COLORS[n]);
    });
    view.querySelectorAll('.chips span').forEach((c, i) => c.classList.toggle('on', i === Math.round(idx)));
    view.querySelector('.note').style.opacity = part(t, .8, .88);
  }

  function drawTime(t, view) {
    // Temporal window T, from 1 (current frame only) to 3; it rests on T = 2.
    const T = keys(t, [[0, 1], [.16, 1], [.26, 2], [.42, 2], [.52, 3], [.66, 3], [.76, 2], [1, 2]]);
    view.querySelectorAll('.time-row').forEach((row, n) => {
      const v = row.dataset.values.split(' ').map(Number);
      if (!row.querySelector('.tile')) {
        // Shares each frame adds, from the oldest to the current frame.
        const shares = [100 - v[2], v[2] - v[1], v[1] - v[0], v[0]];
        shares.forEach((share, i) => {
          const tile = document.createElement('span');
          tile.className = 'tile' + (i === 0 ? ' older' : '');
          tile.dataset.age = 3 - i;
          tile.title = share.toFixed(1) + '% of the influence';
          tile.innerHTML = '<i style="height:' + share + '%"></i>';
          row.append(tile);
        });
        row.append(document.createElement('b'));
        row.style.setProperty('--c', MODEL_COLORS[n]);
      }
      row.querySelectorAll('.tile').forEach(tile => {
        const inside = clamp(T - +tile.dataset.age);
        tile.style.setProperty('--in', inside);
      });
      row.querySelector('b').textContent = lerpList(v, T - 1).toFixed(1) + '%';
    });
    view.querySelectorAll('.time-head span').forEach((h, i) => {
      h.classList.toggle('on', i >= 2 && i <= 4 && 4 - i < Math.round(T));
    });
    view.querySelectorAll('.chips span').forEach((c, i) => c.classList.toggle('on', i === Math.round(T) - 1));
    view.querySelector('.note').style.opacity = part(t, .8, .88);
  }

  // A tilted 13 x 13 latent plane; the window and query are drawn inside its inner group.
  const TILT = 'matrix(1 0 0.62 0.46 0 0)';
  function plane(parent, x, y, cell, n) {
    const g = svg(parent, 'g', { transform: `translate(${x} ${y})` });
    const p = svg(g, 'g', { transform: TILT });
    svg(p, 'rect', { width: cell * n, height: cell * n, class: 'plane' });
    const d = [];
    for (let k = 1; k < n; k++) d.push(`M${k * cell} 0v${cell * n}`, `M0 ${k * cell}h${cell * n}`);
    svg(p, 'path', { d: d.join(''), class: 'plane-lines' });
    return { g, p };
  }

  function drawWindow(t, view) {
    const s = view.querySelector('svg');
    const cell = 13, n = 13, w0 = 3 * cell, ws = 7 * cell;
    const at = { back: [40, 22], front: [40, 118] };
    if (!s.firstChild) {
      const back = plane(s, ...at.back, cell, n);
      // Edges joining the two windows into one 2 x 7 x 7 block, drawn between the planes.
      const corner = ([ox, oy], cx, cy) => [ox + cx + .62 * cy, oy + .46 * cy];
      const edges = svg(s, 'g', { class: 'edges' });
      for (const [cx, cy] of [[w0, w0], [w0 + ws, w0], [w0, w0 + ws], [w0 + ws, w0 + ws]]) {
        const [x1, y1] = corner(at.back, cx, cy), [x2, y2] = corner(at.front, cx, cy);
        svg(edges, 'line', { x1, y1, x2, y2, pathLength: 1 });
      }
      const front = plane(s, ...at.front, cell, n);
      back.g.classList.add('back');
      front.g.classList.add('front');
      for (const pl of [back, front]) svg(pl.p, 'rect', { x: w0, y: w0, width: ws, height: ws, class: 'win' });
      svg(front.p, 'rect', { x: 6 * cell, y: 6 * cell, width: cell, height: cell, class: 'query' });
      svg(s, 'text', { x: 360, y: 66, class: 'plane-label' }, 'Previous latent frame, t − 1');
      svg(s, 'text', { x: 360, y: 162, class: 'plane-label' }, 'Current latent frame, t');
      svg(s, 'text', { x: 360, y: 120, class: 'block-label' }, '2 × 7 × 7 window');
    }
    s.querySelector('.back').style.opacity = ease(part(t, 0, .2));
    s.querySelector('.front').style.opacity = ease(part(t, .1, .3));
    s.querySelectorAll('.plane-label').forEach((l, i) => { l.style.opacity = ease(part(t, i * .1, .2 + i * .1)); });
    s.querySelectorAll('.win, .query').forEach(r => { r.style.opacity = ease(part(t, .3, .5)); });
    s.querySelectorAll('.edges line').forEach(l => { l.style.strokeDashoffset = 1 - ease(part(t, .5, .75)); });
    s.querySelector('.block-label').style.opacity = part(t, .7, .85);
  }

  const locality = document.getElementById('locality-explainer');
  if (locality) stepper(locality, [drawProbe, drawSpace, drawTime, drawWindow]);

  /* ---------- Method ---------- */

  const N = 14, WIN = 7;
  const winStart = q => clamp(q - 3, 0, N - WIN);   // the window shifts inward at borders

  // A frame of N x N tokens; cells[j * N + i].
  let hatches = 0;
  function tokenFrame(parent, x, y, cell, label) {
    if (!parent.hatchId) {
      parent.hatchId = 'hatch' + (++hatches);
      const pattern = svg(svg(parent, 'defs'), 'pattern', { id: parent.hatchId, width: 6, height: 6,
        patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
      svg(pattern, 'line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#c9ced6', 'stroke-width': 2 });
    }
    const g = svg(parent, 'g', { transform: `translate(${x} ${y})` });
    const cells = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      cells.push(svg(g, 'rect', { x: i * cell + .5, y: j * cell + .5, width: cell - 1, height: cell - 1, rx: 1.2, class: 'tok' }));
    }
    const outline = svg(g, 'rect', { width: WIN * cell, height: WIN * cell, class: 'win-line' });
    const hatch = svg(g, 'rect', { width: N * cell, height: N * cell, class: 'hatch', fill: `url(#${parent.hatchId})` });
    const text = svg(g, 'text', { x: N * cell / 2, y: N * cell + 22, class: 'frame-label' }, label);
    return { g, cells, outline, hatch, text, cell, x, y };
  }
  // Paint a frame: role 'current' (query + window), 'cached' (window), 'future' (masked) or 'idle'.
  function paint(f, role, qi, qj, strength = 1) {
    const wi = winStart(qi), wj = winStart(qj);
    f.cells.forEach((c, k) => {
      const i = k % N, j = Math.floor(k / N);
      const inWin = i >= wi && i < wi + WIN && j >= wj && j < wj + WIN;
      let cls = 'tok';
      if (role === 'future') cls += ' masked';
      else if (role !== 'idle' && inWin) cls += role === 'current' ? ' key' : ' key prev';
      if (role === 'current' && i === qi && j === qj) cls = 'tok query';
      c.setAttribute('class', cls);
    });
    const on = role === 'current' || role === 'cached';
    f.outline.setAttribute('x', wi * f.cell);
    f.outline.setAttribute('y', wj * f.cell);
    f.outline.style.opacity = on ? strength : 0;
    f.hatch.style.opacity = role === 'future' ? 1 : 0;
    f.g.style.setProperty('--strength', strength);
  }
  function drawMask(t, view) {
    const s = view.querySelector('svg');
    if (!s.frames) {
      const cell = 11, w = N * cell, gap = (640 - 3 * w) / 4;
      s.frames = ['t − 1', 't', 't + 1'].map((label, k) => tokenFrame(s, gap + k * (w + gap), 18, cell, label));
      s.frames[2].text.textContent = 't + 1, masked';
      s.link = svg(s, 'path', { class: 'link' });
    }
    // The query traces a figure eight through frame t and reaches every border.
    const u = t * 2 * Math.PI;
    const qi = clamp(Math.round(6.5 + 6.6 * Math.sin(u)), 0, N - 1);
    const qj = clamp(Math.round(6.5 + 6.6 * Math.sin(2 * u)), 0, N - 1);
    const [prev, cur, fut] = s.frames;
    paint(prev, 'cached', qi, qj);
    paint(cur, 'current', qi, qj);
    paint(fut, 'future', qi, qj);
    // A curve from the query to its window in frame t - 1.
    const cell = cur.cell;
    const x1 = cur.x + (qi + .5) * cell, y1 = cur.y + (qj + .5) * cell;
    const x2 = prev.x + (winStart(qi) + 3.5) * cell, y2 = prev.y + (winStart(qj) + 3.5) * cell;
    s.link.setAttribute('d', `M${x1} ${y1}C${x1 - 40} ${y1 - 46} ${x2 + 40} ${y2 - 46} ${x2} ${y2}`);
  }

  function drawCache(t, view) {
    const s = view.querySelector('svg');
    const cell = 9, w = N * cell, pitch = 150, x0 = (640 - 2 * pitch - w) / 2, y = 30;
    if (!s.frames) {
      s.frames = ['t − 1', 't', 't + 1', 't + 2'].map(label => tokenFrame(s, 0, y, cell, label));
      const tag = (x, text, cls) => {
        const g = svg(s, 'g', { class: 'slot-tag ' + cls, transform: `translate(${x} ${y + w + 38})` });
        svg(g, 'path', { d: `M0 0v-6h${w}v6`, class: 'bracket' });
        svg(g, 'text', { x: w / 2, y: 18 }, text);
        return g;
      };
      tag(x0, 'KV cache: 1 frame', 'cache');
      tag(x0 + pitch, 'Current frame', 'current');
      s.evict = svg(s, 'text', { x: x0 + w / 2, y: y - 10, class: 'evict' }, 'evicted');
      s.arrive = svg(s, 'text', { x: x0 + 3 * pitch + w / 2, y: y - 10, class: 'arrive' }, 'new latent frame');
    }
    // Before: t is current, t - 1 cached. After the slide: t + 1 is current, t cached, t - 1 evicted.
    const slide = ease(part(t, .36, .66));
    const fadeWin = 1 - part(t, .28, .36) + part(t, .68, .76);
    const after = t >= .52;
    const qi = 6, qj = 6;
    s.frames.forEach((f, k) => {
      const x = x0 + (k - slide) * pitch;
      f.g.setAttribute('transform', `translate(${x} ${y})`);
      const slot = Math.round(k - slide);
      const role = slot === 0 ? 'cached' : slot === 1 ? 'current' : slot === 2 ? 'future' : 'idle';
      paint(f, role, qi, qj, clamp(fadeWin));
      let alpha = 1;
      if (k === 0) alpha = 1 - slide;          // t - 1 leaves the cache
      if (k === 3) alpha = slide;              // t + 2 arrives as the new future frame
      f.g.style.opacity = alpha;
    });
    s.frames[2].text.textContent = after ? 't + 1' : 't + 1, masked';
    s.frames[3].text.textContent = 't + 2, masked';
    s.evict.style.opacity = part(t, .36, .46) * (1 - part(t, .62, .7));
    s.evict.setAttribute('x', Math.max(40, x0 - slide * pitch + w / 2));
    s.arrive.style.opacity = part(t, .3, .38) * (1 - part(t, .62, .7));
    s.arrive.setAttribute('x', Math.min(600, x0 + (3 - slide) * pitch + w / 2));
  }

  function drawMerge(t, view) {
    const s = view.querySelector('svg');
    if (!s.frames) {
      const cell = 10;
      s.frames = [tokenFrame(s, 40, 18, cell, 't − 1'), tokenFrame(s, 220, 18, cell, 't')];
      s.outs = [svg(s, 'text', { x: 110, y: 205, class: 'out' }, 'o, ℓ from t − 1'), svg(s, 'text', { x: 290, y: 205, class: 'out' }, 'o, ℓ from t')];
      const sym = (v, i) => `<tspan font-style="italic">${v}</tspan><tspan class="sub" dy="4">${i}</tspan><tspan dy="-4">`;
      s.outs[0].innerHTML = sym('o', 't−1') + ', </tspan>' + sym('ℓ', 't−1') + '</tspan>';
      s.outs[1].innerHTML = sym('o', 't') + ', </tspan>' + sym('ℓ', 't') + '</tspan>';
    }
    const phase = t < .25 ? 0 : t < .5 ? 1 : t < .75 ? 2 : 3;
    const [prev, cur] = s.frames;
    paint(prev, 'cached', 6, 6, phase === 1 ? .25 : 1);
    paint(cur, 'current', 6, 6, phase === 0 ? .25 : 1);
    prev.g.style.opacity = phase === 1 ? .45 : 1;
    cur.g.style.opacity = phase === 0 ? .45 : 1;
    s.outs[0].style.opacity = phase === 0 ? part(t, .05, .15) : phase === 1 ? .45 : 1;
    s.outs[1].style.opacity = phase === 1 ? part(t, .3, .4) : phase === 0 ? 0 : 1;
    view.querySelectorAll('.eq').forEach(eq => eq.classList.toggle('on', +eq.dataset.phase === phase));
    view.querySelectorAll('.eq').forEach(eq => eq.classList.toggle('done', +eq.dataset.phase < phase));
    // Illustrative weights; they always sum to one.
    const grow = ease(part(t, .52, .7));
    const bars = view.querySelectorAll('.weights span i');
    bars[0].style.width = 38 * grow + '%';
    bars[1].style.width = 62 * grow + '%';
  }

  // Streaming with the real clip: frame 0 alone, then four frames per latent.
  const sprites = ['input', 'output'].map(name => {
    const img = new Image();
    img.src = 'static/explainer/walk_' + name + '.jpg';
    return img;
  });
  const digits = '₀₁₂₃₄₅₆₇₈';
  const latent = n => n < 0 ? '—' : 'z' + digits[n];
  const first = k => k === 0 ? 0 : k * 4 - 3;
  const range = k => k === 0 ? 'Frame 0' : 'Frames ' + first(k) + '–' + k * 4;
  function showFrame(canvas, image, k) {
    if (!image.naturalWidth) { image.onload = () => { canvas.dataset.frame = ''; }; return; }
    if (canvas.dataset.frame === String(k)) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (k >= 0) ctx.drawImage(image, (k % 7) * 200 + 1, Math.floor(k / 7) * 117 + 1, 194, 111, 0, 0, 194, 111);
    canvas.dataset.frame = k;
  }
  function drawStream(t, view) {
    const get = id => document.getElementById(id);
    const clock = Math.min(9.99999, t * 10);
    const tick = Math.floor(clock), phase = clock - tick;
    const emit = phase >= .58;
    const encoding = tick < 9, decoding = tick > 0;
    const sample = Math.min(1, phase / .56);
    const input = encoding ? first(tick) + Math.floor((4 * tick - first(tick)) * sample) : 32;
    const delivered = tick - 2 + Number(emit);
    const output = delivered < 0 ? -1 : (emit
      ? first(delivered) + Math.floor((4 * delivered - first(delivered)) * Math.min(1, (phase - .58) / .30))
      : 4 * delivered);
    showFrame(get('stream-input'), sprites[0], input);
    showFrame(get('stream-output'), sprites[1], output);
    get('input-range').textContent = encoding ? range(tick) : 'Input complete';
    get('new-latent').textContent = latent(encoding ? tick - 1 + Number(emit) : 8);
    get('decode-latent').textContent = latent(decoding ? tick - 1 : (emit ? 0 : -1));
    get('encode-state').textContent = !encoding ? 'Complete' : emit ? 'Emitted' : 'Encoding';
    get('decode-state').textContent = decoding ? (emit ? 'Emitted' : 'Decoding') : (emit ? 'Decoding' : 'Waiting');
    get('output-range').textContent = delivered < 0 ? 'Waiting' : range(delivered);
    const flow = view.querySelector('.stream-flow');
    flow.classList.toggle('emitted', emit);
    flow.classList.toggle('decoder-ready', decoding || emit);
    get('chunk-index').textContent = 'Tick ' + (tick + 1) + ' / 10';
  }

  const method = document.getElementById('method-explainer');
  if (method) stepper(method, [drawMask, drawCache, drawMerge, drawStream]);
})();
