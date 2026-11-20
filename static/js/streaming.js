// Step by step animation of LiveVAE streaming inference (Method section).
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
    ink: '#3b424a', muted: '#7a828c', line: '#8a919b',
    paper: '#ffffff', grid: '#cfd4da', ghost: '#f3f4f6', ghostLine: '#b9bec6',
    enc: '#f6caa2', encLine: '#d98b4a', lat: '#f0a463',
    out: '#f8cadb', outLine: '#d77aa0',
    win: '#ffe08a', winLine: '#d4a400', query: '#7c7ac4', accent: '#b8322f',
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

  el('defs', {}, svg).innerHTML = `
    <marker id="ex-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 z" fill="${C.line}"/></marker>
    <marker id="ex-arrow-y" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 z" fill="${C.winLine}"/></marker>`;

  // ---------------------------------------------------------------------------
  // Scene 1: the streaming pipeline, one column per step, sliding left.
  // ---------------------------------------------------------------------------
  const pipe = el('g', { class: 'scene' }, svg);
  const ROW = { inp: 62, enc: 152, lat: 236, dec: 318, out: 398 };
  const COL0 = 640;
  const DX = 180;
  [['input', 'inp'], ['encoder', 'enc'], ['latent', 'lat'], ['decoder', 'dec'], ['output', 'out']]
    .forEach(([s, k]) => label(s, { x: 150, y: ROW[k] + 5, 'text-anchor': 'end', class: 'lbl' }, pipe));

  function stack(g, y, fill, stroke) {
    const parts = [];
    for (const d of [8, 4, 0]) {
      parts.push(el('rect', { x: -32 - d, y: y - 20 - d, width: 64, height: 40, rx: 3, fill, stroke, 'stroke-width': 1.4 }, g));
    }
    return parts;
  }
  function trapezoid(g, y, wide, isEnc) {
    const top = isEnc ? wide : 30;
    const bot = isEnc ? 30 : wide;
    const pts = `${-top},${y - 22} ${top},${y - 22} ${bot},${y + 22} ${-bot},${y + 22}`;
    const shape = el('polygon', { points: pts, 'stroke-width': 1.5 }, g);
    label(isEnc ? 'Enc' : 'Dec', { x: 0, y: y + 6, 'text-anchor': 'middle', class: 'box' }, g);
    return shape;
  }
  function cube(g, y) {
    const s = 30;
    const grp = el('g', {}, g);
    el('polygon', { points: `${-s / 2},${y - s / 2} ${s / 2},${y - s / 2} ${s / 2 + 8},${y - s / 2 - 8} ${-s / 2 + 8},${y - s / 2 - 8}`, fill: '#f6c49a', stroke: C.encLine }, grp);
    el('polygon', { points: `${s / 2},${y - s / 2} ${s / 2 + 8},${y - s / 2 - 8} ${s / 2 + 8},${y + s / 2 - 8} ${s / 2},${y + s / 2}`, fill: '#e08f4f', stroke: C.encLine }, grp);
    el('rect', { x: -s / 2, y: y - s / 2, width: s, height: s, fill: C.lat, stroke: C.encLine }, grp);
    return grp;
  }
  function kvBox(g, y) {
    const grp = el('g', { transform: `translate(72,${y})` }, g);
    const box = el('rect', { x: -12, y: -17, width: 24, height: 34, rx: 2, 'stroke-width': 1.3 }, grp);
    label('K', { x: 0, y: -3, 'text-anchor': 'middle', class: 'kv' }, grp);
    label('V', { x: 0, y: 12, 'text-anchor': 'middle', class: 'kv' }, grp);
    const arrow = el('line', { x1: 86, y1: y, x2: DX - 50, y2: y, stroke: C.winLine, 'stroke-width': 1.8, 'marker-end': 'url(#ex-arrow-y)' }, g);
    return { grp, box, arrow };
  }

  const cols = [];
  for (let i = 0; i < 5; i++) {
    const g = el('g', {}, pipe);
    const ghost = el('g', { class: 'ghost' }, g); // dashed placeholder shown before the step runs
    stack(ghost, ROW.inp, C.ghost, C.ghostLine);
    trapezoid(ghost, ROW.enc, 46, true);
    el('rect', { x: -15, y: ROW.lat - 15, width: 30, height: 30, fill: C.ghost, stroke: C.ghostLine }, ghost);
    trapezoid(ghost, ROW.dec, 46, false);
    stack(ghost, ROW.out, C.ghost, C.ghostLine);
    ghost.querySelectorAll('rect, polygon').forEach((n) => {
      n.setAttribute('fill', C.ghost); n.setAttribute('stroke', C.ghostLine); n.setAttribute('stroke-dasharray', '4 3');
    });

    const inp = el('g', {}, g);
    stack(inp, ROW.inp, C.paper, '#5b6470');
    const a1 = el('line', { x1: 0, y1: ROW.inp + 22, x2: 0, y2: ROW.enc - 26, stroke: C.line, 'stroke-width': 1.4, 'marker-end': 'url(#ex-arrow)' }, g);
    const encG = el('g', {}, g);
    const enc = trapezoid(encG, ROW.enc, 46, true);
    const a2 = el('line', { x1: 0, y1: ROW.enc + 24, x2: 0, y2: ROW.lat - 26, stroke: C.line, 'stroke-width': 1.4, 'marker-end': 'url(#ex-arrow)' }, g);
    const lat = cube(g, ROW.lat);
    const a3 = el('line', { x1: 0, y1: ROW.lat + 18, x2: 0, y2: ROW.dec - 26, stroke: C.line, 'stroke-width': 1.4, 'marker-end': 'url(#ex-arrow)' }, g);
    const decG = el('g', {}, g);
    const dec = trapezoid(decG, ROW.dec, 46, false);
    const a4 = el('line', { x1: 0, y1: ROW.dec + 24, x2: 0, y2: ROW.out - 30, stroke: C.line, 'stroke-width': 1.4, 'marker-end': 'url(#ex-arrow)' }, g);
    const out = el('g', {}, g);
    stack(out, ROW.out, C.out, C.outLine);
    const kvE = kvBox(g, ROW.enc);
    const kvD = kvBox(g, ROW.dec);
    const kvTag = label('KV cache', { x: 72, y: ROW.enc - 28, 'text-anchor': 'middle', class: 'tag' }, g);
    const tLabel = label('t', { x: 0, y: 450, 'text-anchor': 'middle', class: 'tlabel' }, g);
    cols.push({ g, ghost, inp, a1, encG, enc, a2, lat, a3, decG, dec, a4, out, kvE, kvD, kvTag, tLabel });
  }

  const tName = (r) => (r === 0 ? 't' : r > 0 ? `t+${r}` : `t−${-r}`);

  function styleKv(kv, active, pulse) {
    kv.box.setAttribute('fill', mix(C.ghost, C.win, active));
    kv.box.setAttribute('stroke', mix(C.ghostLine, C.winLine, active));
    kv.box.setAttribute('stroke-dasharray', active > 0.5 ? 'none' : '4 3');
    kv.box.setAttribute('stroke-width', 1.3 + 1.4 * pulse);
  }

  function drawPipe(p) {
    const s = 2.8 * p;              // steps processed since the start of this beat
    const f = s - Math.floor(s);    // phase inside the current step
    const shift = ease(seg(f, 0.86, 1));
    const encOn = seg(f, 0.1, 0.18);
    const encBusy = seg(f, 0.14, 0.2) * (1 - seg(f, 0.34, 0.4));
    const latOn = seg(f, 0.38, 0.46);
    const decOn = seg(f, 0.44, 0.5);
    const decBusy = seg(f, 0.48, 0.54) * (1 - seg(f, 0.66, 0.72));
    const outOn = seg(f, 0.72, 0.82);
    const inOn = ease(seg(f, 0, 0.12));

    cols.forEach((c, i) => {
      const r = i - 3;
      const rr = r - shift;
      c.g.setAttribute('transform', `translate(${COL0 + rr * DX},0)`);
      show(c.g, rr < -2 ? clamp((rr + 2.5) / 0.5) : 1);
      c.tLabel.textContent = tName(r);
      c.tLabel.setAttribute('class', r === 0 ? 'tlabel now' : 'tlabel');

      // How far each part of this column has been computed.
      const done = r < 0 ? 1 : 0;
      const vIn = r === 0 ? inOn : done;
      const vEnc = r === 0 ? encOn : done;
      const vLat = r === 0 ? latOn : done;
      const vDec = r === 0 ? decOn : done;
      const vOut = r === 0 ? outOn : done;
      show(c.inp, vIn);
      c.inp.setAttribute('transform', `translate(0,${-26 * (1 - vIn)})`);
      show(c.a1, vEnc); show(c.encG, vEnc); show(c.a2, vLat); show(c.lat, vLat);
      show(c.a3, vDec); show(c.decG, vDec); show(c.a4, vOut); show(c.out, vOut);
      show(c.ghost, r >= 0 ? 1 : 0);

      const busyE = r === 0 ? encBusy : 0;
      const busyD = r === 0 ? decBusy : 0;
      c.enc.setAttribute('fill', C.enc);
      c.enc.setAttribute('stroke', mix(C.encLine, C.query, busyE));
      c.enc.setAttribute('stroke-width', 1.5 + 1.5 * busyE);
      c.dec.setAttribute('fill', C.enc);
      c.dec.setAttribute('stroke', mix(C.encLine, C.query, busyD));
      c.dec.setAttribute('stroke-width', 1.5 + 1.5 * busyD);

      // K/V of this step: written while it runs, read by the next step, then dropped.
      let activeE = 0, activeD = 0, link = 0;
      if (r === 0) { activeE = seg(f, 0.3, 0.38); activeD = seg(f, 0.62, 0.7); link = shift; }
      if (r === -1) { activeE = 1 - shift; activeD = 1 - shift; link = 1 - shift; }
      show(c.kvE.grp, r > 0 ? 0 : r === 0 ? activeE : 1);
      show(c.kvD.grp, r > 0 ? 0 : r === 0 ? activeD : 1);
      const pulseE = r === -1 ? encBusy : 0;
      const pulseD = r === -1 ? decBusy : 0;
      styleKv(c.kvE, activeE, pulseE);
      styleKv(c.kvD, activeD, pulseD);
      show(c.kvE.arrow, link);
      show(c.kvD.arrow, link);
      c.kvE.arrow.setAttribute('stroke-width', 1.8 + 1.6 * pulseE);
      c.kvD.arrow.setAttribute('stroke-width', 1.8 + 1.6 * pulseD);
      show(c.kvTag, r === -1 ? 1 - shift : r === 0 ? shift : 0);
    });
  }

  // ---------------------------------------------------------------------------
  // Scenes 2 to 4: token grids of four latent frames, the causal window,
  // and the two attention passes that are merged into one output.
  // ---------------------------------------------------------------------------
  const grids = el('g', { class: 'scene' }, svg);
  const NU = 13, NV = 9, CS = 15, WIN = 7;
  const SKEW = { a: 0.85, b: -0.32 };
  const GY = 116;
  const frameX = { '-2': 95, '-1': 330, '0': 565, '1': 800 };
  const proj = (r, u, v) => [frameX[r] + SKEW.a * u, GY + SKEW.b * u + v];
  const frames = {};

  for (const r of [-2, -1, 0, 1]) {
    const outer = el('g', {}, grids);
    const g = el('g', { transform: `matrix(${SKEW.a},${SKEW.b},0,1,${frameX[r]},${GY})` }, outer);
    const live = r === 0 || r === -1;
    el('rect', {
      x: 0, y: 0, width: NU * CS, height: NV * CS, fill: live ? C.paper : C.ghost,
      stroke: live ? '#5b6470' : C.ghostLine, 'stroke-width': 1.4, 'stroke-dasharray': live ? 'none' : '5 4',
      'vector-effect': 'non-scaling-stroke',
    }, g);
    let d = '';
    for (let u = 1; u < NU; u++) d += `M${u * CS},0V${NV * CS}`;
    for (let v = 1; v < NV; v++) d += `M0,${v * CS}H${NU * CS}`;
    el('path', { d, stroke: live ? C.grid : '#dde0e4', 'stroke-width': 0.8, fill: 'none', 'vector-effect': 'non-scaling-stroke' }, g);
    const win = el('rect', { width: WIN * CS, height: WIN * CS, fill: C.win, 'fill-opacity': 0.62, stroke: C.winLine, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, g);
    const q = el('rect', { width: CS, height: CS, fill: C.query, stroke: '#4d4a9c', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, g);
    const [lx, ly] = proj(r, 0, NV * CS);
    const name = label(tName(r), { x: lx + 4, y: ly + 24, 'text-anchor': 'start', class: r === 0 ? 'tlabel now' : 'tlabel' }, outer);
    if (!live) { win.remove(); q.remove(); }
    frames[r] = { outer, g, win, q, name };
  }
  const notRead = label('never read', { x: proj(-2, NU * CS / 2, 0)[0], y: 40, 'text-anchor': 'middle', class: 'note' }, grids);
  const notYet = label('not arrived yet', { x: proj(1, NU * CS / 2, 0)[0], y: 40, 'text-anchor': 'middle', class: 'note' }, grids);
  const cacheTag = el('g', {}, grids);
  {
    const [x, y] = proj(-1, 0, 0);
    el('rect', { x: x - 4, y: y - 40, width: 84, height: 24, rx: 12, fill: C.win, stroke: C.winLine }, cacheTag);
    label('from cache', { x: x + 38, y: y - 23, 'text-anchor': 'middle', class: 'tag' }, cacheTag);
  }
  const links = [0, 1, 2, 3].map(() => el('line', { stroke: C.winLine, 'stroke-width': 1.6, 'stroke-dasharray': '6 5' }, grids));

  // Captions under the grids for scenes 2 and 3.
  const cap2 = label('', { x: 500, y: 345, 'text-anchor': 'middle', class: 'big' }, grids);
  const cap3 = el('g', {}, grids);
  label('2 × 7 × 7 = 98 keys per query', { x: 500, y: 345, 'text-anchor': 'middle', class: 'big' }, cap3);
  label('the same count at every resolution', { x: 500, y: 374, 'text-anchor': 'middle', class: 'lbl' }, cap3);

  // Scene 4: two 2D attention passes and their exact merge.
  const merge = el('g', {}, grids);
  const B1 = { x: 413, y: 332 }, B2 = { x: 648, y: 332 }, BM = { x: 530, y: 414 };
  function roundBox(x, y, w, h, fill, stroke, parent) {
    return el('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 8, fill, stroke, 'stroke-width': 1.4 }, parent);
  }
  roundBox(B1.x, B1.y, 150, 40, '#fffaf0', C.winLine, merge);
  mathText([['O', ''], ['prev', 'sub'], [' ,  ', 'plain'], ['L', ''], ['prev', 'sub']], { x: B1.x, y: B1.y + 5, 'text-anchor': 'middle' }, merge);
  roundBox(B2.x, B2.y, 150, 40, '#fffaf0', C.winLine, merge);
  mathText([['O', ''], ['cur', 'sub'], [' ,  ', 'plain'], ['L', ''], ['cur', 'sub']], { x: B2.x, y: B2.y + 5, 'text-anchor': 'middle' }, merge);
  label('pass 1', { x: B1.x - 88, y: B1.y + 5, 'text-anchor': 'end', class: 'lbl' }, merge);
  label('pass 2', { x: B2.x + 88, y: B2.y + 5, 'text-anchor': 'start', class: 'lbl' }, merge);
  const mBox = roundBox(BM.x, BM.y, 300, 52, '#f4f3fb', C.query, merge);
  mathText([['O', ''], [' = ', 'plain'], ['α', ''], ['prev', 'sub'], ['O', ''], ['prev', 'sub'], [' + ', 'plain'], ['α', ''], ['cur', 'sub'], ['O', ''], ['cur', 'sub']], { x: BM.x, y: BM.y - 2, 'text-anchor': 'middle' }, merge);
  label('weights: softmax of the two log normalizers L', { x: BM.x, y: BM.y + 18, 'text-anchor': 'middle', class: 'small' }, merge);
  label('exactly one softmax over both frames', { x: BM.x + 168, y: BM.y + 5, 'text-anchor': 'start', class: 'note strong' }, merge);

  const winBottom = (r) => {
    const [u, v] = [6 * CS - 3 * CS + WIN * CS / 2, 4 * CS - 3 * CS + WIN * CS];
    return proj(r, u, v);
  };
  const paths = {
    w1: el('path', { fill: 'none' }, merge), w2: el('path', { fill: 'none' }, merge),
    m1: el('path', { fill: 'none' }, merge), m2: el('path', { fill: 'none' }, merge),
  };
  {
    const [x1, y1] = winBottom(-1);
    const [x2, y2] = winBottom(0);
    paths.w1.setAttribute('d', `M${x1},${y1 + 4} L${B1.x},${B1.y - 22}`);
    paths.w2.setAttribute('d', `M${x2},${y2 + 4} L${B2.x},${B2.y - 22}`);
    paths.m1.setAttribute('d', `M${B1.x + 30},${B1.y + 21} L${BM.x - 60},${BM.y - 27}`);
    paths.m2.setAttribute('d', `M${B2.x - 30},${B2.y + 21} L${BM.x + 60},${BM.y - 27}`);
    for (const k in paths) {
      paths[k].setAttribute('stroke', k[0] === 'w' ? C.winLine : C.query);
      paths[k].setAttribute('stroke-width', 1.6);
      paths[k].setAttribute('marker-end', k[0] === 'w' ? 'url(#ex-arrow-y)' : 'url(#ex-arrow)');
    }
  }
  const dots = Object.fromEntries(Object.keys(paths).map((k) => [k, el('circle', { r: 5, fill: k[0] === 'w' ? C.winLine : C.query }, merge)]));
  const placeDot = (k, t) => {
    const path = paths[k];
    const pt = path.getPointAtLength(path.getTotalLength() * t);
    dots[k].setAttribute('cx', pt.x);
    dots[k].setAttribute('cy', pt.y);
    show(dots[k], t > 0 && t < 1 ? 1 : 0);
  };

  // Query route for scene 2: along two rows, so the window visibly stops at the borders.
  const route = [];
  for (let u = 0; u < NU; u++) route.push([u, 1]);
  for (let v = 2; v <= 6; v++) route.push([NU - 1, v]);
  for (let u = NU - 2; u >= 0; u--) route.push([u, 6]);
  route.push([1, 5], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]);

  // Legend shared by scenes 2 to 4.
  const legend = el('g', { transform: 'translate(24,442)' }, grids);
  el('rect', { x: 0, y: -11, width: 13, height: 13, fill: C.query }, legend);
  label('query', { x: 19, y: 0, class: 'lbl' }, legend);
  el('rect', { x: 78, y: -11, width: 13, height: 13, fill: C.win, stroke: C.winLine }, legend);
  label('window', { x: 97, y: 0, class: 'lbl' }, legend);

  function placeWindow(fr, qu, qv) {
    const wu = clamp(qu - 3, 0, NU - WIN);
    const wv = clamp(qv - 3, 0, NV - WIN);
    fr.win.setAttribute('x', wu * CS);
    fr.win.setAttribute('y', wv * CS);
    fr.q.setAttribute('x', qu * CS);
    fr.q.setAttribute('y', qv * CS);
    return [wu, wv];
  }

  function drawGrids(beat, p) {
    let qu = 6, qv = 4;
    if (beat === 1) {
      const k = Math.round(seg(p, 0.04, 0.88) * (route.length - 1));
      [qu, qv] = route[k];
    }
    const [wu, wv] = placeWindow(frames[0], qu, qv);
    placeWindow(frames[-1], qu, qv);
    show(frames[-1].q, 0);

    const prevOn = beat === 1 ? 0 : beat === 2 ? ease(seg(p, 0.05, 0.3)) : 1;
    show(frames[-1].win, prevOn);
    show(frames[0].outer, 1);
    show(frames[-1].outer, beat === 1 ? 0.3 : 1);
    show(frames[-2].outer, beat === 1 ? 0.25 : 0.55);
    show(frames[1].outer, beat === 1 ? 0.25 : 0.45);
    show(notRead, beat === 1 ? 0 : beat === 2 ? seg(p, 0.45, 0.6) : 0.8);
    show(notYet, beat === 1 ? 0 : beat === 2 ? seg(p, 0.5, 0.65) : 0.8);
    show(cacheTag, beat === 3 ? seg(p, 0, 0.12) : 0);

    // Dashed links between matching window corners in frames t-1 and t.
    const corners = [[0, 0], [WIN, 0], [0, WIN], [WIN, WIN]];
    const linkOn = beat === 2 ? seg(p, 0.22, 0.45) : beat === 3 ? 1 : 0;
    corners.forEach(([du, dv], i) => {
      const [x1, y1] = proj(-1, (wu + du) * CS, (wv + dv) * CS);
      const [x2, y2] = proj(0, (wu + du) * CS, (wv + dv) * CS);
      const line = links[i];
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x1 + (x2 - x1) * linkOn); line.setAttribute('y2', y1 + (y2 - y1) * linkOn);
      show(line, linkOn > 0 ? (beat === 3 ? 0.45 : 1) : 0);
    });

    cap2.textContent = '7 × 7 = 49 keys in the current frame';
    show(cap2, beat === 1 ? seg(p, 0.1, 0.25) : 0);
    show(cap3, beat === 2 ? seg(p, 0.55, 0.75) : 0);

    show(merge, beat === 3 ? 1 : 0);
    if (beat === 3) {
      const t1 = seg(p, 0.08, 0.32);
      placeDot('w1', t1); placeDot('w2', t1);
      const t2 = seg(p, 0.42, 0.66);
      placeDot('m1', t2); placeDot('m2', t2);
      const glow = seg(p, 0.66, 0.74) * (1 - seg(p, 0.9, 1) * 0.6);
      mBox.setAttribute('stroke-width', 1.4 + 2 * glow);
      frames[0].q.setAttribute('stroke-width', 1 + 3 * glow);
      for (const k in paths) show(paths[k], k[0] === 'w' ? Math.max(0.35, seg(p, 0, 0.1)) : Math.max(0.35, seg(p, 0.36, 0.42)));
    } else {
      frames[0].q.setAttribute('stroke-width', 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Scene 5: the KV cache holds one latent frame however long the stream runs.
  // ---------------------------------------------------------------------------
  const cache = el('g', { class: 'scene' }, svg);
  const NOW_X = 330, TILE = 40, GAP = 62, TILE_Y = 92;
  label('latent frames', { x: 40, y: 72, class: 'lbl' }, cache);
  const tiles = [];
  for (let i = 0; i < 12; i++) {
    const g = el('g', {}, cache);
    const rect = el('rect', { x: -TILE / 2, y: TILE_Y, width: TILE, height: TILE, rx: 3, 'stroke-width': 1.4 }, g);
    tiles.push({ g, rect });
  }
  el('line', { x1: NOW_X, y1: TILE_Y + TILE + 8, x2: NOW_X, y2: 226, stroke: C.line, 'stroke-width': 1.3, 'stroke-dasharray': '3 3' }, cache);
  label('current step', { x: NOW_X, y: TILE_Y - 12, 'text-anchor': 'middle', class: 'tlabel now' }, cache);
  el('rect', { x: NOW_X - 110, y: 236, width: 220, height: 74, rx: 10, fill: '#fffbea', stroke: C.winLine, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }, cache);
  label('KV cache', { x: NOW_X - 104, y: 228, class: 'tag' }, cache);
  function chip(parent) {
    const g = el('g', {}, parent);
    el('rect', { x: -26, y: -17, width: 52, height: 34, rx: 4, fill: C.win, stroke: C.winLine, 'stroke-width': 1.4 }, g);
    label('K  V', { x: 0, y: 5, 'text-anchor': 'middle', class: 'kv' }, g);
    return g;
  }
  const chipOld = chip(cache);
  const chipNew = chip(cache);
  const dropped = label('dropped', { x: NOW_X - 150, y: 304, 'text-anchor': 'middle', class: 'note' }, cache);

  // Schematic chart: cache size against stream length.
  const CH = { x0: 620, x1: 950, y0: 360, yTop: 80, flat: 318 };
  el('line', { x1: CH.x0, y1: CH.yTop, x2: CH.x0, y2: CH.y0, stroke: C.line, 'stroke-width': 1.3 }, cache);
  el('line', { x1: CH.x0, y1: CH.y0, x2: CH.x1 + 10, y2: CH.y0, stroke: C.line, 'stroke-width': 1.3 }, cache);
  label('KV cache size', { x: CH.x0 - 14, y: (CH.yTop + CH.y0) / 2, 'text-anchor': 'middle', class: 'lbl', transform: `rotate(-90 ${CH.x0 - 14} ${(CH.yTop + CH.y0) / 2})` }, cache);
  label('latent frames streamed', { x: (CH.x0 + CH.x1) / 2, y: CH.y0 + 30, 'text-anchor': 'middle', class: 'lbl' }, cache);
  const grow = el('polyline', { fill: 'none', stroke: '#9aa1aa', 'stroke-width': 2.2, 'stroke-dasharray': '7 5' }, cache);
  const flat = el('polyline', { fill: 'none', stroke: C.accent, 'stroke-width': 3 }, cache);
  const growDot = el('circle', { r: 4.5, fill: '#9aa1aa' }, cache);
  const flatDot = el('circle', { r: 5, fill: C.accent }, cache);
  const growLbl = label('caching every past frame', { x: CH.x1 - 6, y: CH.yTop + 8, 'text-anchor': 'end', class: 'lbl' }, cache);
  const flatLbl = label('LiveVAE: one latent frame', { x: CH.x1 - 6, y: CH.flat - 14, 'text-anchor': 'end', class: 'lbl strong' }, cache);

  function drawCache(p) {
    const s = 4.6 * p + 2;          // stream position, in steps
    const k = Math.floor(s);
    const f = s - k;
    const slide = ease(seg(f, 0.8, 1));
    tiles.forEach((t, i) => {
      const idx = k - 5 + i;        // absolute frame index of this tile
      const x = NOW_X + (idx - k - slide) * GAP;
      t.g.setAttribute('transform', `translate(${x},0)`);
      show(t.g, clamp((x - 20) / 50) * clamp((600 - x) / 60));
      const state = idx < k ? 'done' : idx === k ? 'now' : 'next';
      t.rect.setAttribute('fill', state === 'next' ? C.ghost : C.lat);
      t.rect.setAttribute('fill-opacity', state === 'done' ? 0.45 : 1);
      t.rect.setAttribute('stroke', state === 'now' ? C.query : state === 'next' ? C.ghostLine : C.encLine);
      t.rect.setAttribute('stroke-width', state === 'now' ? 3 : 1.4);
      t.rect.setAttribute('stroke-dasharray', state === 'next' ? '4 3' : 'none');
    });

    // The finished step writes its K/V into the cache and pushes the older entry out.
    const fall = ease(seg(f, 0.5, 0.78));
    const out = ease(seg(f, 0.5, 0.78));
    chipNew.setAttribute('transform', `translate(${NOW_X},${TILE_Y + TILE / 2 + (273 - TILE_Y - TILE / 2) * fall})`);
    show(chipNew, seg(f, 0.4, 0.5));
    chipOld.setAttribute('transform', `translate(${NOW_X - 150 * out},273)`);
    show(chipOld, 1 - seg(f, 0.6, 0.85));
    show(dropped, seg(f, 0.58, 0.68) * (1 - seg(f, 0.88, 1)));

    const u = seg(p, 0.04, 0.96);
    const xHead = CH.x0 + (CH.x1 - CH.x0) * u;
    const yGrow = CH.flat - (CH.flat - CH.yTop - 20) * u;
    flat.setAttribute('points', `${CH.x0},${CH.flat} ${xHead},${CH.flat}`);
    grow.setAttribute('points', `${CH.x0},${CH.flat} ${xHead},${yGrow}`);
    flatDot.setAttribute('cx', xHead); flatDot.setAttribute('cy', CH.flat);
    growDot.setAttribute('cx', xHead); growDot.setAttribute('cy', yGrow);
    show(flatLbl, seg(p, 0.55, 0.7));
    show(growLbl, seg(p, 0.75, 0.9));
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
    const p = playing ? clamp(elapsed / durations[beat]) : (elapsed > 0 ? clamp(elapsed / durations[beat]) : 1);
    show(pipe, beat === 0 ? 1 : 0);
    show(grids, beat >= 1 && beat <= 3 ? 1 : 0);
    show(cache, beat === 4 ? 1 : 0);
    if (beat === 0) drawPipe(p);
    if (beat >= 1 && beat <= 3) drawGrids(beat, p);
    if (beat === 4) drawCache(p);
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
    if (elapsed >= durations[beat]) {
      setBeat(beat + 1);
    }
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
