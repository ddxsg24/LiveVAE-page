(() => {
  const demo = document.querySelector('.method-demo');
  if (!demo) return;
  const get = id => document.getElementById(id);
  const tabs = [...demo.querySelectorAll('[role=tab]')];
  const panels = [...demo.querySelectorAll('[role=tabpanel]')];
  const svgNS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const periods = [6200, 6900, 5500, 18000];
  const play = get('method-play'), progress = get('method-progress');
  let step = 0, elapsed = 0, handle = 0, last = 0, visible = false, wantsPlay = !reduced;

  function svg(parent, name, attrs) {
    const node = document.createElementNS(svgNS, name);
    Object.entries(attrs).forEach(([k,v]) => node.setAttribute(k,v));
    parent.append(node);
    return node;
  }
  function caption(parent, x, y, text, cls = '') {
    const t = svg(parent, 'text', {x,y,'text-anchor':'middle',class:cls});
    t.textContent = text;
    return t;
  }
  function grid(parent, size, cells, windowSize) {
    const pitch = size / cells;
    svg(parent, 'rect', {width:size, height:size, rx:2, fill:'#fff',stroke:'#b9bec7'});
    const segments = [];
    for (let k=1; k<cells; k++) segments.push('M'+k*pitch+' 0v'+size,'M0 '+k*pitch+'h'+size);
    svg(parent,'path',{d:segments.join(' '),fill:'none',stroke:'#dbe0e4','stroke-width':.75});
    return svg(parent,'rect',{x:pitch,y:pitch,width:windowSize*pitch,height:windowSize*pitch,
      fill:'#f2be59','fill-opacity':.42,stroke:'#c1943e','stroke-width':1.4});
  }
  const frames = Array.from({length:4},(_,i) => {
    const x=53+178*i, y=25, g=svg(get('window-diagram'),'g',{transform:'translate('+x+' '+y+')'});
    const plane=svg(g,'g',{transform:'translate(0 23) matrix(1,-0.13,0,1,0,0)'});
    const window=grid(plane,124,11,7);
    const query=svg(plane,'rect',{x:56,y:56,width:11,height:11,fill:'#6056a6'});
    const label=caption(g,62,171,['t − 1','t','t + 1','t + 2'][i]);
    return {g,window,query,label};
  });
  const cache=get('cache-diagram');
  const cacheBlocks=[['Cached','K, V'],['Current','q, K, V'],['Output','o']];
  const cacheLabels=cacheBlocks.map(([title,value],i)=>{
    const x=56+i*242;
    svg(cache,'rect',{x,y:44,width:166,height:112,rx:13,fill:['#fcf1d9','#eef1fa','#e8f2ed'][i]});
    caption(cache,x+83,78,title,'small');
    return caption(cache,x+83,124,value,'symbol');
  });
  caption(cache,258,105,'+','symbol');
  caption(cache,497,105,'→','symbol');
  const cacheTime=caption(cache,380,193,'','small');
  demo.querySelectorAll('.pass-grid').forEach((diagram,i)=>{
    const w=grid(diagram,110,11,7);
    w.setAttribute('x',20);w.setAttribute('y',20);
    if(i===1) svg(diagram,'rect',{x:50,y:50,width:10,height:10,fill:'#6056a6'});
  });
  const sprites = ['input','output'].map(name => {
    const img=new Image();
    img.onload=()=>{if(step===3) draw();};
    img.src='static/explainer/walk_'+name+'.jpg';
    return img;
  });
  const inputs=get('stream-input'), outputs=get('stream-output');
  function showFrame(canvas,image,k) {
    if (canvas.dataset.frame===String(k) || !image.naturalWidth) return;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(k>=0) ctx.drawImage(image,(k%7)*200+1,Math.floor(k/7)*117+1,194,111,0,0,194,111);
    canvas.dataset.frame=k;
  }
  const digits='₀₁₂₃₄₅₆₇₈';
  const latent=n=>n<0?'—':'z'+digits[n];
  const first=k=>k===0?0:k*4-3;
  const range=k=>k===0?'Frame 0':'Frames '+first(k)+'–'+k*4;
  function drawStream(p) {
    const clock=Math.min(9.99999,p*10);
    const tick=Math.floor(clock), phase=clock-tick;
    const emit=phase>=.58;
    const activeEncoder=tick<9, activeDecoder=tick>0;
    const sample=Math.min(1,phase/.56);
    const input=activeEncoder?first(tick)+Math.floor((4*tick-first(tick))*sample):32;
    const delivered=tick-2+Number(emit);
    const output=delivered<0 ? -1 : (emit
      ? first(delivered)+Math.floor((4*delivered-first(delivered))*Math.min(1,(phase-.58)/.30))
      : 4*delivered);
    showFrame(inputs,sprites[0],input);
    showFrame(outputs,sprites[1],output);
    get('input-range').textContent=activeEncoder?range(tick):'Input complete';
    get('new-latent').textContent=latent(activeEncoder ? tick-1+Number(emit) : 8);
    get('decode-latent').textContent=latent(activeDecoder?tick-1:(emit?0:-1));
    get('encode-state').textContent=!activeEncoder?'Complete':emit?'Emitted':'Encoding';
    get('decode-state').textContent=activeDecoder?(emit?'Emitted':'Decoding'):(emit?'Decoding':'Waiting');
    get('output-range').textContent=delivered<0?'Waiting':range(delivered);
    const flow=demo.querySelector('.stream-flow');
    flow.classList.toggle('emitted',emit);
    flow.classList.toggle('decoder-ready',activeDecoder||emit);
    get('chunk-index').textContent=(tick+1)+' / 10';
  }
  function draw() {
    const p=Math.min(1,elapsed/periods[step]);
    progress.value=Math.round(1000*p);
    if(step===0) {
      const current=Math.min(3,1+Math.floor(p*3));
      frames.forEach((f,i)=>{
        f.g.style.opacity=i > current ? .23 : i < current - 1 ? .38 : 1;
        f.window.style.opacity=i===current||i===current-1?1:0;
        f.query.style.opacity=i===current?1:0;
        f.label.style.fontWeight=i===current?700:450;
      });
    } else if(step===1) {
      const next=p>=.53;
      cacheLabels[0].textContent=next?'Kₜ, Vₜ':'Kₜ₋₁, Vₜ₋₁';
      cacheLabels[1].textContent=next?'qₜ₊₁, Kₜ₊₁, Vₜ₊₁':'qₜ, Kₜ, Vₜ';
      cacheLabels[2].textContent=next?'oₜ₊₁':'oₜ';
      cacheTime.textContent=next?'Frame t + 1':'Frame t';
    } else if(step===3) drawStream(p);
  }
  function select(n,focus=false) {
    step=(n+4)%4; elapsed=0;
    tabs.forEach((t,i)=>{
      t.setAttribute('aria-selected',String(i===step));t.tabIndex=i===step?0:-1;panels[i].hidden=i!==step;
    });
    if(focus) tabs[step].focus();
    draw();
  }
  function frame(now) {
    elapsed+=Math.min(now-last,100);
    last=now;
    if(elapsed>=periods[step])select(step+1);
    draw();handle=requestAnimationFrame(frame);
  }
  function sync() {
    const on=wantsPlay&&visible&&!document.hidden;
    if(on&&!handle){last=performance.now();handle=requestAnimationFrame(frame);}
    if(!on&&handle){cancelAnimationFrame(handle);handle=0;}
    play.textContent=on?'Pause':'Play';
    play.setAttribute('aria-label',on?'Pause method animation':'Play method animation');
  }
  tabs.forEach((t,i)=>{
    t.addEventListener('click',()=>select(i));
    t.addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();select(i+(e.key==='ArrowLeft'?-1:1),true);}
    });
  });
  get('method-prev').onclick=()=>select(step-1);
  get('method-next').onclick=()=>select(step+1);
  play.onclick=()=>{wantsPlay=!handle;sync();};
  progress.oninput=()=>{wantsPlay=false;sync();elapsed=periods[step]*progress.value/1000;draw();};
  function jumpTick(delta) {
    wantsPlay=false;sync();
    const current=Math.min(9,Math.floor(10*elapsed/periods[3]));
    const tick=Math.max(0,Math.min(9,current+delta));
    elapsed=(tick+.7)*periods[3]/10;
    draw();
  }
  get('chunk-next').onclick=()=>jumpTick(1);
  get('chunk-prev').onclick=()=>jumpTick(-1);
  document.addEventListener('visibilitychange',sync);
  if('IntersectionObserver' in window) new IntersectionObserver(([e])=>{visible=e.isIntersecting;sync();},{threshold:.1}).observe(demo);
  else{visible=true;sync();}
  select(0);sync();
})();
