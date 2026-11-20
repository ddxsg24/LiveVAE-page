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

  /* ---------- Paper style frames (method figure, panel b) ---------- */

  const PAL = {
    query: '#807dbb', queryDark: '#5c58a0', kvNew: '#e4e2f3',
    win: '#fee391', winLine: '#e0a800', gold: '#8a6500',
    ghost: '#fafaf9', ghostLine: '#a9afb8', ghostText: '#8b929d', ink: '#3d4450',
    enc: '#fdd1a2', encLine: '#cd8e58', encTop: '#feddb8', encSide: '#f3b47c',
    out: '#fccde5', outLine: '#e58fbf', arrow: '#b1b8c2',
  };
  const mix = (c1, c2, t) => {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const ch = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  };
  const K = 7;                                              // window size
  const winStart = (q, n) => clamp(q - (K - 1) / 2, 0, n - K); // shifts inward at borders, as in NAT

  // Drawing order of the method figure: planes, then the dashed links, then windows and queries.
  function layers(s) {
    if (!s.layers) s.layers = { planes: svg(s, 'g'), links: svg(s, 'g', { class: 'o-links' }), wins: svg(s, 'g') };
    return s.layers;
  }
  // A latent frame of n x n tokens drawn as an oblique vertical plane: columns run right and up,
  // rows run down. It is w wide, rises by `rise` across its width and is h tall; y is its top left corner.
  function oframe(s, n, w, rise, h, y) {
    const L = layers(s);
    const f = { n, x: 0 };
    f.local = (c, r) => [c * w / n, y - c * rise / n + r * h / n];
    f.pt = (c, r) => { const [a, b] = f.local(c, r); return [a + f.x, b]; };
    f.quad = (c0, r0, c1, r1) => [[c0, r0], [c1, r0], [c1, r1], [c0, r1]].map(p => f.local(...p).join(',')).join(' ');
    f.g = svg(L.planes, 'g', { class: 'oframe' });
    svg(f.g, 'polygon', { points: f.quad(0, 0, n, n), class: 'o-plane' });
    const d = [];
    for (let k = 1; k < n; k++) d.push('M' + f.local(k, 0) + 'L' + f.local(k, n), 'M' + f.local(0, k) + 'L' + f.local(n, k));
    svg(f.g, 'path', { d: d.join(''), class: 'o-grid' });
    svg(f.g, 'polygon', { points: f.quad(0, 0, n, n), class: 'o-edge' });
    f.label = svg(f.g, 'text', { x: w / 2, y: y + h + 28, class: 'o-label' });
    f.wg = svg(L.wins, 'g');
    f.win = svg(f.wg, 'polygon', { class: 'o-win' });
    f.query = svg(f.wg, 'polygon', { class: 'o-query' });
    f.win.style.opacity = f.query.style.opacity = 0;
    return f;
  }
  // role: 'unused' (dashed grey), 'past' (frame t − 1) or 'current' (frame t).
  function place(f, x, role, name, alpha = 1) {
    f.x = x;
    f.g.setAttribute('transform', `translate(${x} 0)`);
    f.wg.setAttribute('transform', `translate(${x} 0)`);
    f.g.setAttribute('class', 'oframe ' + role);
    if (name != null) f.label.textContent = name;
    f.g.style.opacity = f.wg.style.opacity = alpha;
  }
  function setWin(f, c0, r0, alpha) {
    f.win.setAttribute('points', f.quad(c0, r0, c0 + K, r0 + K));
    f.win.style.opacity = alpha;
  }
  function setQuery(f, c, r, alpha) {
    f.query.setAttribute('points', f.quad(c, r, c + 1, r + 1));
    f.query.style.opacity = alpha;
  }
  // Four dashed lines join the window corners in frame a to the same corners in frame b.
  const links = s => [0, 1, 2, 3].map(() => svg(layers(s).links, 'line'));
  function setLinks(lines, a, b, c0, r0, grow = 1, alpha = 1) {
    [[c0, r0], [c0 + K, r0], [c0 + K, r0 + K], [c0, r0 + K]].forEach(([c, r], i) => {
      const [x1, y1] = a.pt(c, r), [x2, y2] = b.pt(c, r);
      lines[i].setAttribute('x1', x1); lines[i].setAttribute('y1', y1);
      lines[i].setAttribute('x2', x1 + (x2 - x1) * grow); lines[i].setAttribute('y2', y1 + (y2 - y1) * grow);
      lines[i].style.opacity = grow > 0 ? alpha : 0;
    });
  }
  // Math label: italic serif symbols with small upright subscripts. parts: [text, 'sub' | ''].
  function mathText(parent, parts, attrs) {
    const t = svg(parent, 'text', { class: 'o-math', ...attrs });
    let low = false;
    for (const [s, kind] of parts) {
      const span = svg(t, 'tspan', {}, s);
      if (kind === 'sub') { span.setAttribute('class', 'sub'); if (!low) span.setAttribute('dy', 5); low = true; }
      else if (low) { span.setAttribute('dy', -5); low = false; }
    }
    return t;
  }
  function markers(s, prefix) {
    const defs = svg(s, 'defs');
    for (const [name, color] of [['g', PAL.arrow], ['y', PAL.winLine], ['p', PAL.query]]) {
      const m = svg(defs, 'marker', { id: prefix + name, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      svg(m, 'path', { d: 'M0,1 L9,5 L0,9 z', fill: color });
    }
  }
  const arrow = (parent, x1, y1, x2, y2, kind, prefix) =>
    svg(parent, 'line', { x1, y1, x2, y2, class: 'o-arrow ' + kind, 'marker-end': `url(#${prefix}${kind})` });

  // Four frames side by side, as in panel (b).
  const ROW4 = { w: 100, rise: 80, h: 210, y: 112, pitch: 175, x0: 67 };
  const ROLES = ['unused', 'past', 'current', 'unused'];
  const NAMES = ['t − 2', 't − 1', 't', 't + 1'];

  function drawWindow(t, view) {
    const s = view.querySelector('svg');
    const n = 15, c0 = winStart(7, n), { w, rise, h, y, pitch, x0 } = ROW4;
    if (!s.frames) {
      s.frames = NAMES.map((name, i) => {
        const f = oframe(s, n, w, rise, h, y);
        place(f, x0 + i * pitch, ROLES[i], name);
        return f;
      });
      s.links = links(s);
      const [, prev, cur] = s.frames;
      s.title = svg(s, 'text', { x: (prev.pt(7.5, 0)[0] + cur.pt(7.5, 0)[0]) / 2, y: 24, class: 'o-title' }, '2 × 7 × 7 window');
    }
    const [old, prev, cur, next] = s.frames;
    const fade = (f, a, b) => { f.g.style.opacity = f.wg.style.opacity = ease(part(t, a, b)); };
    fade(prev, 0, .16); fade(cur, .06, .22); fade(old, .12, .28); fade(next, .12, .28);
    setWin(prev, c0, c0, ease(part(t, .22, .38)));
    setWin(cur, c0, c0, ease(part(t, .22, .38)));
    setQuery(cur, 7, 7, ease(part(t, .3, .42)));
    setLinks(s.links, prev, cur, c0, c0, ease(part(t, .42, .7)));
    s.title.style.opacity = part(t, .7, .84);
  }

  const locality = document.getElementById('locality-explainer');
  if (locality) stepper(locality, [drawProbe, drawSpace, drawTime, drawWindow]);

  /* ---------- Method ---------- */

  const N = 16;

  function drawMask(t, view) {
    const s = view.querySelector('svg');
    const { w, rise, h, y, pitch, x0 } = ROW4;
    if (!s.frames) {
      s.frames = NAMES.map((name, i) => {
        const f = oframe(s, N, w, rise, h, y);
        place(f, x0 + i * pitch, ROLES[i], name);
        return f;
      });
      s.frames[3].label.textContent = 't + 1, masked';
      s.links = links(s);
    }
    // The query moves through frame t along a figure eight that reaches every border.
    const u = t * 2 * Math.PI;
    const qc = clamp(Math.round(7.5 + 7.8 * Math.sin(u)), 0, N - 1);
    const qr = clamp(Math.round(7.5 + 7.8 * Math.sin(2 * u + .35)), 0, N - 1);
    const c0 = winStart(qc, N), r0 = winStart(qr, N);
    const [, prev, cur] = s.frames;
    setWin(prev, c0, r0, 1);
    setWin(cur, c0, r0, 1);
    setQuery(cur, qc, qr, 1);
    setLinks(s.links, prev, cur, c0, r0);
  }

  function drawCache(t, view) {
    const s = view.querySelector('svg');
    const { w, rise, h, y, pitch, x0 } = ROW4;
    if (!s.frames) {
      s.frames = ['t − 2', 't − 1', 't', 't + 1', 't + 2'].map(() => oframe(s, N, w, rise, h, y));
      s.links = links(s);
      const tag = (slot, text, cls) => {
        const x = x0 + slot * pitch, yb = y + h + 44;
        const g = svg(s, 'g', { class: 'o-tag ' + cls });
        svg(g, 'path', { d: `M${x} ${yb - 6}v6h${w}v-6` });
        svg(g, 'text', { x: x + w / 2, y: yb + 22 }, text);
      };
      tag(1, 'KV cache: 1 frame', 'cache');
      tag(2, 'Current frame', 'current');
      s.evict = svg(s, 'text', { y: 30, class: 'o-note evict' }, 'evicted');
      s.arrive = svg(s, 'text', { y: 30, class: 'o-note' }, 'new latent frame');
    }
    // t is current and t − 1 cached; after the slide t + 1 is current, t cached and t − 1 evicted.
    const slide = ease(part(t, .34, .64));
    const show = clamp(1 - part(t, .24, .32) + part(t, .68, .76));
    const names = ['t − 2', 't − 1', 't', 't + 1', 't + 2'];
    const roleAt = p => (p === 1 ? 'past' : p === 2 ? 'current' : 'unused');
    let past, cur;
    s.frames.forEach((f, k) => {
      const p = k - slide, slot = Math.round(p);
      const alpha = k === 0 ? 1 - slide : k === 4 ? slide : 1;
      place(f, x0 + p * pitch, roleAt(slot), names[k], alpha);
      setWin(f, 0, 0, 0);
      setQuery(f, 0, 0, 0);
      if (slot === 1) past = f;
      if (slot === 2) cur = f;
    });
    const c0 = winStart(8, N);
    setWin(past, c0, c0, show);
    setWin(cur, c0, c0, show);
    setQuery(cur, 8, 8, show);
    setLinks(s.links, past, cur, c0, c0, 1, show);
    s.evict.setAttribute('x', s.frames[1].pt(N / 2, 0)[0]);
    s.evict.style.opacity = part(t, .5, .6) * (1 - part(t, .86, .94));
    s.arrive.setAttribute('x', s.frames[4].pt(N / 2, 0)[0]);
    s.arrive.style.opacity = part(t, .3, .4) * (1 - part(t, .66, .74));
  }

  function drawMerge(t, view) {
    const s = view.querySelector('svg');
    const w = 84, rise = 66, h = 170, y = 90, pitch = 175, x0 = 76;
    if (!s.frames) {
      markers(s, 'mm-');
      s.frames = NAMES.map((name, i) => {
        const f = oframe(s, N, w, rise, h, y);
        place(f, x0 + i * pitch, ROLES[i], name);
        // Labels sit left of the lowest corner, so the arrows below stay clear.
        f.label.setAttribute('x', -10);
        f.label.setAttribute('y', y + h - 2);
        f.label.style.textAnchor = 'end';
        return f;
      });
      s.links = links(s);
      const [, prev, cur] = s.frames;
      const c0 = winStart(7, N);
      setWin(prev, c0, c0, 1); setWin(cur, c0, c0, 1); setQuery(cur, 7, 7, 1);
      setLinks(s.links, prev, cur, c0, c0, 1, .5);
      svg(s, 'text', { x: prev.x - 10, y: y + h + 26, class: 'o-note cache' }, 'from cache');
      const g = s.drawing = svg(s, 'g');
      const xa = prev.pt(7.5, 0)[0], xb = cur.pt(7.5, 0)[0], yw = prev.pt(7.5, c0 + K)[1] + 4;
      const box = (x, yy, bw, bh, cls) => svg(g, 'rect', { x: x - bw / 2, y: yy, width: bw, height: bh, rx: 6, class: 'o-box ' + cls });
      s.p1 = svg(g, 'g'); s.p2 = svg(g, 'g'); s.p3 = svg(g, 'g'); s.p4 = svg(g, 'g');
      arrow(s.p1, xa, yw, xa, 302, 'y', 'mm-');
      s.p1.append(box(xa, 306, 148, 36, 'pass'));
      mathText(s.p1, [['o'], ['t−1', 'sub'], [', ℓ'], ['t−1', 'sub']], { x: xa, y: 330 });
      svg(s.p1, 'text', { x: xa - 84, y: 329, class: 'o-side end' }, 'pass 1');
      arrow(s.p2, xb, yw, xb, 302, 'p', 'mm-');
      s.p2.append(box(xb, 306, 148, 36, 'pass now'));
      mathText(s.p2, [['o'], ['t', 'sub'], [', ℓ'], ['t', 'sub']], { x: xb, y: 330 });
      svg(s.p2, 'text', { x: xb + 84, y: 329, class: 'o-side' }, 'pass 2');
      const xm = (xa + xb) / 2;
      arrow(s.p3, xa + 20, 344, xm - 50, 366, 'g', 'mm-');
      arrow(s.p3, xb - 20, 344, xm + 50, 366, 'g', 'mm-');
      s.p3.append(box(xm, 370, 300, 58, 'merge'));
      mathText(s.p3, [['o = w'], ['t−1', 'sub'], [' o'], ['t−1', 'sub'], [' + w'], ['t', 'sub'], [' o'], ['t', 'sub']], { x: xm, y: 395 });
      mathText(s.p3, [['w = softmax(ℓ'], ['t−1', 'sub'], [', ℓ'], ['t', 'sub'], [')']], { x: xm, y: 418, class: 'o-math small' });
      svg(s.p4, 'text', { x: xm, y: 452, class: 'o-note exact' }, 'exactly one softmax over both windows');
    }
    const [, prev, cur] = s.frames;
    const p1 = ease(part(t, .04, .22)), p2 = ease(part(t, .3, .48)), p3 = ease(part(t, .56, .72)), p4 = part(t, .8, .9);
    prev.win.style.opacity = .35 + .65 * Math.max(p1 * (1 - .5 * p2), p3);
    cur.win.style.opacity = cur.query.style.opacity = .35 + .65 * Math.max(p2, p3);
    s.p1.style.opacity = p1; s.p2.style.opacity = p2; s.p3.style.opacity = p3; s.p4.style.opacity = p4;
  }

  // Streaming inference as in panel (d): one column per step, sliding left after each step.
  function drawStream(t, view) {
    const s = view.querySelector('svg');
    const ROW = { inp: 54, enc: 144, lat: 226, dec: 308, out: 390 };
    const X0 = 530, DX = 160;
    if (!s.cols) {
      markers(s, 'ms-');
      const fixed = svg(s, 'g');
      [['input', 'inp'], ['encoder', 'enc'], ['latent', 'lat'], ['decoder', 'dec'], ['output', 'out']]
        .forEach(([text, k]) => svg(fixed, 'text', { x: 118, y: ROW[k] + 5, class: 's-row' }, text));
      [['t − 2', ''], ['t − 1', 'past'], ['t', 'current'], ['t + 1', '']]
        .forEach(([text, cls], i) => svg(fixed, 'text', { x: X0 + (i - 2) * DX, y: 444, class: 's-t ' + cls }, text));

      const stack = (g, yy, fill, stroke) => [8, 4, 0].map(d =>
        svg(g, 'rect', { x: -30 + d, y: yy - 19 - d, width: 60, height: 38, rx: 3, fill, stroke, 'stroke-width': 1.3 }));
      const trap = (g, yy, enc) => {
        const top = enc ? 40 : 26, bot = enc ? 26 : 40;
        const shape = svg(g, 'polygon', { points: `${-top},${yy - 20} ${top},${yy - 20} ${bot},${yy + 20} ${-bot},${yy + 20}` });
        svg(g, 'text', { x: 0, y: yy + 5, class: 's-op' }, enc ? 'Enc' : 'Dec');
        return shape;
      };
      const cube = (g, yy) => {
        const a = 26, o = 8, c = svg(g, 'g');
        svg(c, 'polygon', { points: `${-a / 2},${yy - a / 2} ${a / 2},${yy - a / 2} ${a / 2 + o},${yy - a / 2 - o} ${-a / 2 + o},${yy - a / 2 - o}`, fill: PAL.encTop, stroke: PAL.encLine });
        svg(c, 'polygon', { points: `${a / 2},${yy - a / 2} ${a / 2 + o},${yy - a / 2 - o} ${a / 2 + o},${yy + a / 2 - o} ${a / 2},${yy + a / 2}`, fill: PAL.encSide, stroke: PAL.encLine });
        svg(c, 'rect', { x: -a / 2, y: yy - a / 2, width: a, height: a, fill: PAL.enc, stroke: PAL.encLine });
        return c;
      };
      const kv = (g, yy) => {
        const grp = svg(g, 'g', { transform: `translate(58 ${yy})` });
        const box = svg(grp, 'rect', { x: -11, y: -16, width: 22, height: 32, rx: 2 });
        const k = svg(grp, 'text', { x: 0, y: -3, class: 's-kv' }, 'K');
        const v = svg(grp, 'text', { x: 0, y: 12, class: 's-kv' }, 'V');
        const link = svg(g, 'line', { x1: 71, y1: yy, x2: DX - 36, y2: yy, class: 's-link', 'marker-end': 'url(#ms-y)' });
        return { grp, box, text: [k, v], link };
      };
      s.cols = [0, 1, 2, 3, 4].map(() => {
        const g = svg(s, 'g');
        const ghost = svg(g, 'g', { class: 's-ghost' });
        stack(ghost, ROW.inp, PAL.ghost, PAL.ghostLine);
        trap(ghost, ROW.enc, true); trap(ghost, ROW.dec, false);
        svg(ghost, 'rect', { x: -13, y: ROW.lat - 13, width: 26, height: 26 });
        stack(ghost, ROW.out, PAL.ghost, PAL.ghostLine);
        const c = { g, ghost };
        c.inp = svg(g, 'g'); stack(c.inp, ROW.inp, '#ffffff', PAL.ink);
        c.a1 = svg(g, 'line', { x1: 0, y1: ROW.inp + 22, x2: 0, y2: ROW.enc - 24, class: 's-arrow' });
        c.encG = svg(g, 'g'); c.enc = trap(c.encG, ROW.enc, true);
        c.a2 = svg(g, 'line', { x1: 0, y1: ROW.enc + 22, x2: 0, y2: ROW.lat - 24, class: 's-arrow' });
        c.lat = cube(g, ROW.lat);
        c.a3 = svg(g, 'line', { x1: 0, y1: ROW.lat + 16, x2: 0, y2: ROW.dec - 24, class: 's-arrow' });
        c.decG = svg(g, 'g'); c.dec = trap(c.decG, ROW.dec, false);
        c.a4 = svg(g, 'line', { x1: 0, y1: ROW.dec + 22, x2: 0, y2: ROW.out - 30, class: 's-arrow' });
        c.out = svg(g, 'g'); stack(c.out, ROW.out, PAL.out, PAL.outLine);
        c.kvE = kv(g, ROW.enc); c.kvD = kv(g, ROW.dec);
        c.tag = svg(g, 'text', { x: 58, y: ROW.enc - 26, class: 's-tag' }, 'KV cache');
        return c;
      });
    }
    // Three steps per pass; the last one stops before the slide, so the final frame is complete.
    const steps = 2.8 * t, f = steps - Math.floor(steps);
    const shift = ease(part(f, .86, 1));
    const inOn = ease(part(f, 0, .12)), encOn = part(f, .1, .18), latOn = part(f, .38, .46);
    const decOn = part(f, .44, .5), outOn = part(f, .72, .82);
    const encBusy = part(f, .14, .2) * (1 - part(f, .34, .4));
    const decBusy = part(f, .48, .54) * (1 - part(f, .66, .72));
    const op = (node, a) => { node.style.opacity = a; };
    // K/V state: 2 written by the current step (purple), 1 cache read by the next step (yellow), 0 evicted.
    const styleKv = (kv, state, pulse) => {
      const hi = state > 1, u = hi ? state - 1 : state;
      kv.box.setAttribute('fill', hi ? mix(PAL.win, PAL.kvNew, u) : mix(PAL.ghost, PAL.win, u));
      kv.box.setAttribute('stroke', hi ? mix(PAL.winLine, PAL.query, u) : mix(PAL.ghostLine, PAL.winLine, u));
      kv.box.setAttribute('stroke-dasharray', state < .5 ? '4 3' : 'none');
      kv.box.setAttribute('stroke-width', 1.3 + 1.2 * pulse);
      kv.text.forEach(x => x.setAttribute('fill', hi ? mix(PAL.gold, PAL.queryDark, u) : mix(PAL.ghostLine, PAL.gold, u)));
    };
    s.cols.forEach((c, i) => {
      const r = i - 3, rr = r - shift;
      c.g.setAttribute('transform', `translate(${X0 + rr * DX} 0)`);
      op(c.g, rr < -2 ? clamp((rr + 2.7) / .7) : 1);
      const done = r < 0 ? 1 : 0, now = r === 0;
      const vIn = now ? inOn : done, vEnc = now ? encOn : done, vLat = now ? latOn : done;
      const vDec = now ? decOn : done, vOut = now ? outOn : done;
      op(c.inp, vIn);
      c.inp.setAttribute('transform', `translate(0 ${-24 * (1 - vIn)})`);
      op(c.a1, vEnc); op(c.encG, vEnc); op(c.a2, vLat); op(c.lat, vLat);
      op(c.a3, vDec); op(c.decG, vDec); op(c.a4, vOut); op(c.out, vOut);
      op(c.ghost, r >= 0 ? 1 : 0);
      // The current column is outlined in purple, as in the method figure.
      const cur = now ? 1 - shift : 0;
      for (const [shape, busy] of [[c.enc, now ? encBusy : 0], [c.dec, now ? decBusy : 0]]) {
        shape.setAttribute('fill', PAL.enc);
        shape.setAttribute('stroke', mix(PAL.encLine, PAL.query, cur));
        shape.setAttribute('stroke-width', 1.4 + .8 * cur + 1.4 * busy);
      }
      for (const a of [c.a1, c.a2, c.a3, c.a4]) a.setAttribute('stroke', mix(PAL.arrow, PAL.query, cur));
      let stateE = 0, stateD = 0, showE = 1, showD = 1, link = 0;
      if (now) { stateE = stateD = 2 - shift; showE = part(f, .3, .38); showD = part(f, .62, .7); link = shift; }
      if (r === -1) { stateE = stateD = 1 - shift; link = 1 - shift; }
      if (r > 0) showE = showD = 0;
      op(c.kvE.grp, showE); op(c.kvD.grp, showD);
      styleKv(c.kvE, stateE, r === -1 ? encBusy : 0);
      styleKv(c.kvD, stateD, r === -1 ? decBusy : 0);
      op(c.kvE.link, link); op(c.kvD.link, link);
      op(c.tag, r === -1 ? 1 - shift : now ? shift : 0);
    });
  }

  const method = document.getElementById('method-explainer');
  if (method) stepper(method, [drawMask, drawCache, drawMerge, drawStream]);
})();
