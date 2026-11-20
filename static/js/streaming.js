// Step by step animation of LiveVAE streaming inference (Method section).
// Steps 1 to 3 are schematic; steps 4 and 5 use real frames of a Wan2.2 reconstruction clip.
(() => {
  const root = document.getElementById('stream-explainer');
  if (!root) return;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = root.querySelector('.ex-stage');
  const beats = [...root.querySelectorAll('.ex-beat')];
  const segs = [...root.querySelectorAll('.ex-seg')];
  const fills = segs.map((s) => s.querySelector('i'));
  const playBtn = root.querySelector('.ex-play');
  const count = root.querySelector('.ex-count');
  const durations = beats.map((b) => Number(b.dataset.dur) * 1000);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = {
    line: '#8a919b', paper: '#ffffff', grid: '#cfd4da', ghost: '#f3f4f6', ghostLine: '#b9bec6',
    enc: '#f6caa2', encLine: '#d98b4a', lat: '#f0a463', outLine: '#d77aa0',
    win: '#ffe08a', winLine: '#d4a400', query: '#7c7ac4', queryDark: '#4d4a9c', done: '#d9d8f0',
  };

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const mix = (c1, c2, t) => {
    const a = parseInt(c1.slice(1), 16);
    const b = parseInt(c2.slice(1), 16);
    const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  };

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }
  function label(str, attrs, parent) {
    const t = el('text', attrs, parent);
    t.textContent = str;
    return t;
  }
  // Math label such as "O_prev": italic serif symbols, small upright subscripts.
  // parts: [text, kind] with kind '' (symbol), 'sub' (subscript) or 'plain' (upright text).
  function mathText(parts, attrs, parent) {
    const t = el('text', { class: 'math', ...attrs }, parent);
    let lowered = false;
    for (const [s, kind] of parts) {
      const span = el('tspan', {}, t);
      span.textContent = s;
      if (kind === 'sub') {
        span.setAttribute('class', 'sub');
        if (!lowered) span.setAttribute('dy', '5');
        lowered = true;
      } else {
        if (kind === 'plain') span.setAttribute('class', 'plain');
        if (lowered) span.setAttribute('dy', '-5');
        lowered = false;
      }
    }
    return t;
  }
  const show = (node, o) => { node.style.opacity = o; };
  const tName = (r) => (r === 0 ? 't' : r > 0 ? `t+${r}` : `t−${-r}`);

  el('defs', {}, svg).innerHTML = `
    <marker id="ex-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 z" fill="${C.line}"/></marker>
    <marker id="ex-arrow-y" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 z" fill="${C.winLine}"/></marker>
    <marker id="ex-arrow-q" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 z" fill="${C.query}"/></marker>`;

  // A flat token grid with a 7x7 window and a query cell, drawn at (x, y).
  const NU = 13, NV = 9, WIN = 7;
  function flatGrid(parent, x, y, cs, opts = {}) {
    const g = el('g', { transform: `translate(${x},${y})` }, parent);
    el('rect', { width: NU * cs, height: NV * cs, fill: opts.fill || C.paper, stroke: opts.stroke || '#5b6470', 'stroke-width': 1.3 }, g);
    const cells = el('g', {}, g);
    let d = '';
    for (let u = 1; u < NU; u++) d += `M${u * cs},0V${NV * cs}`;
    for (let v = 1; v < NV; v++) d += `M0,${v * cs}H${NU * cs}`;
    el('path', { d, stroke: C.grid, 'stroke-width': 0.8, fill: 'none' }, g);
    const win = el('rect', { width: WIN * cs, height: WIN * cs, fill: C.win, 'fill-opacity': 0.55, stroke: C.winLine, 'stroke-width': 2 }, g);
    const q = el('rect', { width: cs, height: cs, fill: C.query, stroke: C.queryDark, 'stroke-width': 1 }, g);
    const place = (qu, qv) => {
      const wu = clamp(qu - 3, 0, NU - WIN);
      const wv = clamp(qv - 3, 0, NV - WIN);
      win.setAttribute('x', wu * cs); win.setAttribute('y', wv * cs);
      q.setAttribute('x', qu * cs); q.setAttribute('y', qv * cs);
    };
    return { g, cells, win, q, place, cs, w: NU * cs, h: NV * cs };
  }

  // ---------------------------------------------------------------------------
  // Scene 1: the 2x7x7 causal window, sliding forward in time.
  // ---------------------------------------------------------------------------
  const slide = el('g', { class: 'scene' }, svg);
  const CS = 15;
  const SKEW = { a: 0.85, b: -0.32 };
  const GY = 140;
  const fx = (r) => 330 + 235 * r;               // left edge of latent frame r (r = -1 is t-1)
  const proj = (r, u, v) => [fx(r) + SKEW.a * u, GY + SKEW.b * u + v];
  const persp = {};
  for (const r of [-1, 0, 1, 2]) {
    const outer = el('g', {}, slide);
    const ghost = el('g', {}, outer);
    const solid = el('g', {}, outer);
    const m = `matrix(${SKEW.a},${SKEW.b},0,1,${fx(r)},${GY})`;
    const gg = el('g', { transform: m }, ghost);
    el('rect', { width: NU * CS, height: NV * CS, fill: C.ghost, stroke: C.ghostLine, 'stroke-width': 1.3, 'stroke-dasharray': '5 4', 'vector-effect': 'non-scaling-stroke' }, gg);
    const sg = el('g', { transform: m }, solid);
    el('rect', { width: NU * CS, height: NV * CS, fill: C.paper, stroke: '#5b6470', 'stroke-width': 1.3, 'vector-effect': 'non-scaling-stroke' }, sg);
    let d = '';
    for (let u = 1; u < NU; u++) d += `M${u * CS},0V${NV * CS}`;
    for (let v = 1; v < NV; v++) d += `M0,${v * CS}H${NU * CS}`;
    el('path', { d, stroke: C.grid, 'stroke-width': 0.8, fill: 'none', 'vector-effect': 'non-scaling-stroke' }, sg);
    const win = el('rect', { width: WIN * CS, height: WIN * CS, fill: C.win, 'fill-opacity': 0.6, stroke: C.winLine, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, sg);
    const q = el('rect', { width: CS, height: CS, fill: C.query, stroke: C.queryDark, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, sg);
    const [lx, ly] = proj(r, 0, NV * CS);
    const name = label(tName(r), { x: lx + 4, y: ly + 24, class: 'tlabel' }, outer);
    const note = label('', { x: lx + 4, y: ly + 44, class: 'note' }, outer);
    persp[r] = { ghost, solid, win, q, name, note };
  }
  const bracket = el('g', {}, slide);
  const bLine = el('path', { fill: 'none', stroke: C.winLine, 'stroke-width': 2 }, bracket);
  const bText = label('causal window 2 × 7 × 7', { y: 36, 'text-anchor': 'middle', class: 'tag' }, bracket);
  const slideCap = label('', { x: 500, y: 330, 'text-anchor': 'middle', class: 'lbl' }, slide);
  const legend1 = el('g', { transform: 'translate(24,446)' }, slide);
  el('rect', { x: 0, y: -11, width: 13, height: 13, fill: C.query }, legend1);
  label('query', { x: 19, y: 0, class: 'lbl' }, legend1);
  el('rect', { x: 78, y: -11, width: 13, height: 13, fill: C.win, stroke: C.winLine }, legend1);
  label('window', { x: 97, y: 0, class: 'lbl' }, legend1);

  // The query wanders a little inside each frame so the spatial window moves too.
  const wander = [[3, 2], [5, 3], [7, 4], [9, 5], [11, 6], [12, 7]];

  function drawSlide(p) {
    // c is the index of the current latent frame: 0 (t), then 1 (t+1), then 2 (t+2).
    const c = ease(seg(p, 0.3, 0.4)) + ease(seg(p, 0.66, 0.76));
    const local = c < 0.5 ? seg(p, 0, 0.3) : c < 1.5 ? seg(p, 0.4, 0.66) : seg(p, 0.76, 1);
    const [qu, qv] = wander[Math.min(wander.length - 1, Math.floor(local * wander.length))];
    const cur = Math.round(c);
    for (const r of [-1, 0, 1, 2]) {
      const f = persp[r];
      const on = clamp(1.5 - Math.abs(r - (c - 0.5)));   // part of the 2-frame window
      const arrived = clamp(c - r + 1);
      show(f.solid, arrived * (0.35 + 0.65 * on));
      show(f.ghost, 1 - arrived);
      const wu = clamp(qu - 3, 0, NU - WIN), wv = clamp(qv - 3, 0, NV - WIN);
      f.win.setAttribute('x', wu * CS); f.win.setAttribute('y', wv * CS);
      f.q.setAttribute('x', qu * CS); f.q.setAttribute('y', qv * CS);
      show(f.win, on);
      show(f.q, clamp(1 - Math.abs(r - c) * 2));
      f.name.setAttribute('class', r === cur ? 'tlabel now' : 'tlabel');
      f.note.textContent = r > c + 0.5 ? 'not arrived yet' : r < c - 1.5 ? 'no longer read' : '';
    }
    const xl = fx(c - 1) + 6;
    const xr = fx(c) + SKEW.a * NU * CS - 6;
    bLine.setAttribute('d', `M${xl},56 V46 H${xr} V56`);
    bText.setAttribute('x', (xl + xr) / 2);
    slideCap.textContent = cur === 0
      ? 'Queries of frame t read frames t−1 and t'
      : cur === 1 ? 'Frame t+1 arrives: the window now covers t and t+1' : 'Frame t+2 arrives: the window covers t+1 and t+2';
  }

  // ---------------------------------------------------------------------------
  // Scene 2: keys and values of t-1 come from the KV cache; each query gives one output token.
  // ---------------------------------------------------------------------------
  const kv = el('g', { class: 'scene' }, svg);
  el('rect', { x: 26, y: 112, width: 244, height: 196, rx: 12, fill: '#fffbea', stroke: C.winLine, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }, kv);
  label('KV cache', { x: 40, y: 104, class: 'tag' }, kv);
  const cacheSets = [0, 1].map((i) => {
    const g = el('g', {}, kv);
    const K = flatGrid(g, 40, 160, 7.6, { fill: '#fff6cc', stroke: C.winLine });
    const V = flatGrid(g, 156, 160, 7.6, { fill: '#fff6cc', stroke: C.winLine });
    for (const m of [K, V]) { show(m.q, 0); show(m.win, 0); }
    const sub = i === 0 ? 't−1' : 't';
    mathText([['K', ''], [sub, 'sub']], { x: 40 + 49, y: 254, 'text-anchor': 'middle' }, g);
    mathText([['V', ''], [sub, 'sub']], { x: 156 + 49, y: 254, 'text-anchor': 'middle' }, g);
    return { g, K, V };
  });
  const cacheNote = label('computed one step earlier', { x: 148, y: 290, 'text-anchor': 'middle', class: 'small' }, kv);
  const ft = flatGrid(kv, 380, 136, 14);
  label('frame t: queries, keys, values', { x: 380 + ft.w / 2, y: 124, 'text-anchor': 'middle', class: 'lbl' }, kv);
  const ot = flatGrid(kv, 700, 136, 14);
  show(ot.win, 0); show(ot.q, 0);
  label('output tokens of frame t', { x: 700 + ot.w / 2, y: 124, 'text-anchor': 'middle', class: 'lbl' }, kv);
  const outCells = [];
  for (let v = 0; v < NV; v++) {
    for (let u = 0; u < NU; u++) {
      outCells.push(el('rect', { x: u * 14 + 1, y: v * 14 + 1, width: 12, height: 12, fill: C.query, rx: 1.5 }, ot.cells));
    }
  }
  const camWin = el('rect', { width: WIN * 7.6, height: WIN * 7.6, fill: 'none', stroke: C.winLine, 'stroke-width': 2, 'stroke-dasharray': '4 3' }, cacheSets[0].K.g);
  el('line', { x1: 272, y1: 210, x2: 372, y2: 210, stroke: C.winLine, 'stroke-width': 2, 'marker-end': 'url(#ex-arrow-y)' }, kv);
  label('read', { x: 322, y: 202, 'text-anchor': 'middle', class: 'small' }, kv);
  el('line', { x1: 568, y1: 210, x2: 692, y2: 210, stroke: C.query, 'stroke-width': 2, 'marker-end': 'url(#ex-arrow-q)' }, kv);
  label('one output per query', { x: 630, y: 202, 'text-anchor': 'middle', class: 'small' }, kv);
  const writeChip = el('g', {}, kv);
  el('rect', { x: -30, y: -15, width: 60, height: 30, rx: 5, fill: C.win, stroke: C.winLine, 'stroke-width': 1.4 }, writeChip);
  mathText([['K', ''], ['t', 'sub'], [' ', 'plain'], ['V', ''], ['t', 'sub']], { x: 0, y: 3, 'text-anchor': 'middle' }, writeChip);
  const kvCap = label('', { x: 500, y: 400, 'text-anchor': 'middle', class: 'lbl' }, kv);

  function drawKv(p) {
    const scan = seg(p, 0.04, 0.7);
    const n = NU * NV;
    const k = Math.min(n - 1, Math.floor(scan * n));
    const qu = k % NU, qv = Math.floor(k / NU);
    ft.place(qu, qv);
    show(ft.q, p < 0.72 ? 1 : 0);
    show(ft.win, p < 0.72 ? 1 : 0);
    const wu = clamp(qu - 3, 0, NU - WIN), wv = clamp(qv - 3, 0, NV - WIN);
    camWin.setAttribute('x', wu * 7.6); camWin.setAttribute('y', wv * 7.6);
    show(camWin, p < 0.72 ? 1 : 0);
    outCells.forEach((cell, i) => {
      const filled = i < k || (scan >= 1);
      cell.setAttribute('fill', i === k && scan < 1 ? C.query : C.done);
      show(cell, filled || i === k ? 1 : 0);
    });
    // Frame t is done: its keys and values move into the cache and replace those of t-1.
    const move = ease(seg(p, 0.76, 0.92));
    writeChip.setAttribute('transform', `translate(${471 + (148 - 471) * move},${330 - 120 * move})`);
    show(writeChip, seg(p, 0.72, 0.76) * (1 - seg(p, 0.92, 0.97)));
    show(cacheSets[0].g, 1 - seg(p, 0.86, 0.94));
    show(cacheSets[1].g, seg(p, 0.9, 0.98));
    cacheNote.textContent = p < 0.88 ? 'computed one step earlier' : 'ready for frame t+1';
    kvCap.textContent = p < 0.72
      ? 'Each query reads its window in frame t and the same window of the cached keys and values of t−1'
      : 'Frame t is done: its keys and values replace those of t−1 in the cache';
  }

  // ---------------------------------------------------------------------------
  // Scene 3: the 2x7x7 attention as two 2D window attentions, merged exactly.
  // ---------------------------------------------------------------------------
  const pass = el('g', { class: 'scene' }, svg);
  const gA = flatGrid(pass, 40, 64, 13, { fill: '#fff6cc', stroke: C.winLine });
  const gB = flatGrid(pass, 40, 268, 13);
  gA.place(6, 4); gB.place(6, 4);
  gA.q.setAttribute('fill', 'none'); gA.q.setAttribute('stroke-dasharray', '3 2');
  label('Cached K, V · previous frame', { x: 40, y: 54, class: 'lbl' }, pass);
  label('K, V · current frame', { x: 40, y: 258, class: 'lbl' }, pass);
  function roundBox(x, y, w, h, fill, stroke, parent) {
    return el('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 8, fill, stroke, 'stroke-width': 1.4 }, parent);
  }
  const P1 = { x: 430, y: 122 }, P2 = { x: 430, y: 326 }, PM = { x: 760, y: 224 };
  roundBox(P1.x, P1.y, 230, 62, '#fffaf0', C.winLine, pass);
  label('2D attention · previous', { x: P1.x, y: P1.y - 8, 'text-anchor': 'middle', class: 'lbl' }, pass);
  mathText([['O', ''], ['prev', 'sub'], [' ,  ', 'plain'], ['L', ''], ['prev', 'sub']], { x: P1.x, y: P1.y + 18, 'text-anchor': 'middle' }, pass);
  roundBox(P2.x, P2.y, 230, 62, '#fffaf0', C.winLine, pass);
  label('2D attention · current', { x: P2.x, y: P2.y - 8, 'text-anchor': 'middle', class: 'lbl' }, pass);
  mathText([['O', ''], ['cur', 'sub'], [' ,  ', 'plain'], ['L', ''], ['cur', 'sub']], { x: P2.x, y: P2.y + 18, 'text-anchor': 'middle' }, pass);
  const mBox = roundBox(PM.x, PM.y, 300, 70, '#f4f3fb', C.query, pass);
  mathText([['O', ''], [' = ', 'plain'], ['α', ''], ['prev', 'sub'], ['O', ''], ['prev', 'sub'], [' + ', 'plain'], ['α', ''], ['cur', 'sub'], ['O', ''], ['cur', 'sub']], { x: PM.x, y: PM.y - 4, 'text-anchor': 'middle' }, pass);
  mathText([['[α', ''], ['prev', 'sub'], [', α', ''], ['cur', 'sub'], ['] = softmax([', 'plain'], ['L', ''], ['prev', 'sub'], [', ', 'plain'], ['L', ''], ['cur', 'sub'], ['])', 'plain']], { x: PM.x, y: PM.y + 22, 'text-anchor': 'middle', class: 'math small-math' }, pass);
  label('Joint attention over 98 keys', { x: PM.x, y: PM.y + 62, 'text-anchor': 'middle', class: 'note strong' }, pass);
  label('L = log normalizer', { x: PM.x, y: PM.y + 82, 'text-anchor': 'middle', class: 'small' }, pass);
  const paths = {
    a: el('path', { d: `M${40 + gA.w + 8},${64 + gA.h / 2} L${P1.x - 120},${P1.y}`, fill: 'none', stroke: C.winLine, 'stroke-width': 1.6, 'marker-end': 'url(#ex-arrow-y)' }, pass),
    b: el('path', { d: `M${40 + gB.w + 8},${268 + gB.h / 2} L${P2.x - 120},${P2.y}`, fill: 'none', stroke: C.winLine, 'stroke-width': 1.6, 'marker-end': 'url(#ex-arrow-y)' }, pass),
    m1: el('path', { d: `M${P1.x + 116},${P1.y + 10} L${PM.x - 120},${PM.y - 36}`, fill: 'none', stroke: C.query, 'stroke-width': 1.6, 'marker-end': 'url(#ex-arrow-q)' }, pass),
    m2: el('path', { d: `M${P2.x + 116},${P2.y - 10} L${PM.x - 120},${PM.y + 36}`, fill: 'none', stroke: C.query, 'stroke-width': 1.6, 'marker-end': 'url(#ex-arrow-q)' }, pass),
  };
  const dots = Object.fromEntries(Object.keys(paths).map((k) => [k, el('circle', { r: 5, fill: k.length === 1 ? C.winLine : C.query }, pass)]));
  const placeDot = (k, t) => {
    const path = paths[k];
    const pt = path.getPointAtLength(path.getTotalLength() * t);
    dots[k].setAttribute('cx', pt.x); dots[k].setAttribute('cy', pt.y);
    show(dots[k], t > 0 && t < 1 ? 1 : 0);
  };

  function drawPass(p) {
    const t1 = seg(p, 0.06, 0.34);
    placeDot('a', t1); placeDot('b', t1);
    const t2 = seg(p, 0.42, 0.68);
    placeDot('m1', t2); placeDot('m2', t2);
    const glow = seg(p, 0.68, 0.76);
    mBox.setAttribute('stroke-width', 1.4 + 2.2 * glow);
    gB.q.setAttribute('stroke-width', 1 + 3 * glow);
  }

  // ---------------------------------------------------------------------------
  // Scenes 4 and 5: encoding and decoding a real clip, one latent frame per step.
  // Sprites hold frames 0 to 32 (7 per row, 200 x 117 pitch, 196 x 113 frames).
  // ---------------------------------------------------------------------------
  const SPRITE = { input: 'static/explainer/walk_input.jpg', output: 'static/explainer/walk_output.jpg' };
  function frameView(parent, which, x, y, w, h) {
    const box = el('svg', { x, y, width: w, height: h, viewBox: '0 0 194 111', preserveAspectRatio: 'none' }, parent);
    const img = el('image', { href: SPRITE[which], width: 1568, height: 782 }, box);
    el('rect', { x, y, width: w, height: h, fill: 'none', stroke: which === 'input' ? '#5b6470' : C.outLine, 'stroke-width': 1.2 }, parent);
    let shown = -1;
    return (k) => {
      if (k === shown) return;
      shown = k;
      img.setAttribute('x', -((k % 7) * 200 + 1));
      img.setAttribute('y', -(Math.floor(k / 7) * 117 + 1));
    };
  }

  const walk = el('g', { class: 'scene' }, svg);
  const inputView = frameView(walk, 'input', 124, 46, 320, 184);
  const outputView = frameView(walk, 'output', 556, 46, 320, 184);
  const outputCover = el('rect', { x: 556, y: 46, width: 320, height: 184, fill: C.ghost }, walk);
  const waiting = label('Waiting for the first latent', { x: 716, y: 143, 'text-anchor': 'middle', class: 'lbl' }, walk);
  const inputCaption = label('', { x: 284, y: 32, 'text-anchor': 'middle', class: 'lbl' }, walk);
  const outputCaption = label('', { x: 716, y: 32, 'text-anchor': 'middle', class: 'lbl strong' }, walk);
  const rows = [['Input frames', 302], ['Encoder latent', 350], ['Decoder output', 398]];
  const chunkCount = 9;
  const tracks = rows.map(([name, y], row) => {
    label(name, { x: 148, y: y + 5, 'text-anchor': 'end', class: 'lbl' }, walk);
    return Array.from({ length: chunkCount }, (_, k) => {
      const x = 166 + k * 86;
      const cell = el('rect', { x, y: y - 15, width: 78, height: 30, rx: 4 }, walk);
      const first = k === 0 ? 0 : 4 * k - 3;
      const range = k === 0 ? '0' : first + '–' + (4 * k);
      label(row === 1 ? 'z' + '₀₁₂₃₄₅₆₇₈'[k] : range,
        { x: x + 39, y: y + 5, 'text-anchor': 'middle', class: 'small' }, walk);
      return cell;
    });
  });
  const streamStatus = label('', { x: 500, y: 264, 'text-anchor': 'middle', class: 'lbl' }, walk);
  label('Frame 0, then four frames per chunk', { x: 166, y: 441, class: 'small' }, walk);

  // The same stream clock spans both beats. At k+.65 latent k is ready and decoding
  // begins. Its final frame appears at k+1.4, after the next input has started.
  function drawWalk(t) {
    let newestInput = 0;
    let newestOutput = -1;
    let latestLatent = -1;
    const colors = ['#e1e6eb', '#f4cca1', '#edd2dd'];
    for (let k = 0; k < chunkCount; k++) {
      const age = t - k;
      const first = k === 0 ? 0 : 4 * k - 3;
      const span = k === 0 ? 0 : 3;
      if (age >= 0) newestInput = first + Math.floor(span * seg(age, 0, .52));
      if (age >= .65) latestLatent = k;
      if (age >= .83) newestOutput = first + Math.floor(span * seg(age, .83, 1.4));
      const starts = [0, .65, .83];
      const ends = [.52, .83, 1.4];
      tracks.forEach((track, r) => {
        const started = age >= starts[r];
        const active = started && age < ends[r];
        track[k].setAttribute('fill', started ? colors[r] : '#f8f9fa');
        track[k].setAttribute('stroke', active ? C.queryDark : '#dce1e6');
        track[k].setAttribute('stroke-width', active ? 2.4 : 1);
      });
    }
    inputView(newestInput);
    if (newestOutput >= 0) outputView(newestOutput);
    show(outputCover, newestOutput < 0 ? 1 : 0);
    show(waiting, newestOutput < 0 ? 1 : 0);
    inputCaption.textContent = 'Input · frame ' + newestInput;
    outputCaption.textContent = newestOutput < 0 ? 'LiveVAE output' : 'LiveVAE output · frame ' + newestOutput;
    if (latestLatent < 0) streamStatus.textContent = 'Encoding the first frame';
    else if (newestOutput === 32) streamStatus.textContent = 'All 33 frames reconstructed';
    else streamStatus.textContent = 'Latent ' + latestLatent + ' is available to the decoder';
  }

  // ---------------------------------------------------------------------------
  // Playback: one beat at a time, with text, progress bar and controls.
  // ---------------------------------------------------------------------------
  let beat = 0;
  let elapsed = 0;
  let playing = false;
  let userPaused = reduceMotion;
  let inView = false;
  let last = 0;
  let raf = 0;

  function draw() {
    const p = clamp(elapsed / durations[beat]);
    show(slide, beat === 0 ? 1 : 0);
    show(kv, beat === 1 ? 1 : 0);
    show(pass, beat === 2 ? 1 : 0);
    show(walk, beat >= 3 ? 1 : 0);
    if (beat === 0) drawSlide(p);
    if (beat === 1) drawKv(p);
    if (beat === 2) drawPass(p);
    if (beat === 3) drawWalk(3 * p);
    if (beat === 4) drawWalk(3 + 6.5 * p);
    fills.forEach((fi, i) => { fi.style.transform = `scaleX(${i < beat ? 1 : i === beat ? p : 0})`; });
  }

  function setBeat(i) {
    beat = (i + beats.length) % beats.length;
    elapsed = 0;
    beats.forEach((b, j) => b.classList.toggle('is-active', j === beat));
    segs.forEach((s, j) => s.setAttribute('aria-current', j === beat ? 'step' : 'false'));
    count.textContent = `${beat + 1} / ${beats.length}`;
    draw();
  }

  function frame(now) {
    const dt = Math.min(now - last, 100);
    last = now;
    elapsed += dt;
    if (elapsed >= durations[beat]) setBeat(beat + 1);
    draw();
    raf = playing ? requestAnimationFrame(frame) : 0;
  }

  function setPlaying(on) {
    playing = on;
    playBtn.classList.toggle('is-playing', on);
    playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!on) { cancelAnimationFrame(raf); raf = 0; draw(); }
  }

  playBtn.addEventListener('click', () => {
    userPaused = playing;
    if (!playing && elapsed >= durations[beat]) elapsed = 0;
    setPlaying(!playing);
  });
  root.querySelector('.ex-prev').addEventListener('click', () => setBeat(beat - 1));
  root.querySelector('.ex-next').addEventListener('click', () => setBeat(beat + 1));
  segs.forEach((s, i) => s.addEventListener('click', () => setBeat(i)));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { setBeat(beat + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { setBeat(beat - 1); e.preventDefault(); }
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      if (inView && !userPaused) setPlaying(true);
      if (!inView && playing) setPlaying(false);
    }, { threshold: 0.35 }).observe(svg);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing) setPlaying(false);
    else if (!document.hidden && inView && !userPaused) setPlaying(true);
  });

  setBeat(0);
  // On narrow screens the stage scrolls sideways; start with its middle in view.
  const wrap = svg.parentElement;
  wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;
})();
