/**
 * P3dK // main.js — Core Engine Boot
 * =====================================
 * Loads instantly. Provides:
 *   - Three.js scene, camera, renderer
 *   - ViewCube (always loaded — tiny)
 *   - STL/OBJ/PLY/3MF/GLB loader
 *   - Pointer events + keyboard shortcuts
 *   - Lazy-panel loader: window.lazyPanel(panelId, moduleName, hdrEl)
 *   - Session persistence (IDB)
 *   - Manifold WASM boots in background — CSG ready when needed
 *
 * LAZY PANEL SYSTEM:
 *   Each panel calls lazyPanel(id, module, hdr) on first expand.
 *   Module is fetched from ./src/{module}.js, install(engineCore) called.
 *   Module fills panel body with its own HTML, binds its own events.
 *   On collapse, module is NOT unloaded (GC handles it) but heavy state
 *   (CFD particles, flight scene) is explicitly destroyed via module.uninstall().
 *
 * SIZE TARGET: <25KB
 */

import * as T from 'three';
import { OrbitControls as OC } from 'three/addons/controls/OrbitControls.js';
import { STLLoader }    from 'three/addons/loaders/STLLoader.js';
import { OBJLoader }    from 'three/addons/loaders/OBJLoader.js';
import { PLYLoader }    from 'three/addons/loaders/PLYLoader.js';
import { ThreeMFLoader }from 'three/addons/loaders/3MFLoader.js';
import { GLTFLoader }   from 'three/addons/loaders/GLTFLoader.js';
import * as BGU         from 'three/addons/utils/BufferGeometryUtils.js';

const M = Math;
const $ = id => document.getElementById(id);
const sS = m => { const e=$('sts'); if(e) e.textContent=m; };

// ── SCENE ────────────────────────────────────────────────────────────────────
const sc = new T.Scene();
const cm = new T.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 5000);
cm.position.set(0, 60, 180);

const rn = new T.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true, alpha:true });
rn.setSize(innerWidth, innerHeight);
rn.setPixelRatio(M.min(devicePixelRatio, 2));
rn.domElement.style.cssText = 'position:fixed;top:0;left:0;z-index:0;touch-action:none';
document.body.appendChild(rn.domElement);

const ct = new OC(cm, rn.domElement);
ct.enableDamping = true;
ct.dampingFactor = 0.07;
ct.maxPolarAngle = M.PI / 2;
window.ct = ct;

// Lights
sc.add(new T.AmbientLight(0xffffff, 0.6));
const hemi = new T.HemisphereLight(0xffffff, 0x444444, 0.8); sc.add(hemi);
const dl1 = new T.DirectionalLight(0x00ffff, 1.2); dl1.position.set(60,120,90); sc.add(dl1);
const dl2 = new T.DirectionalLight(0xff00ff, 0.5); dl2.position.set(-80,-60,-70); sc.add(dl2);

// Grid + Stars
const grO = new T.GridHelper(800, 80, 0xff1100, 0x330000);
grO.material.transparent = true; grO.material.opacity = 0.5; sc.add(grO);
window.grO = grO; window.gOn = true;

const sfP = new Float32Array(4500);
for(let i=0; i<4500; i++) sfP[i] = (M.random()-.5)*2400;
const sfO = new T.Points(
  new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(sfP,3)),
  new T.PointsMaterial({color:0xaaccff, size:2.5, transparent:true, opacity:.8, blending:T.AdditiveBlending})
);
sfO.visible = false; sc.add(sfO); window.sfO = sfO; window.sOn = false;

// Measurement line
const measLine = new T.Line(
  new T.BufferGeometry(),
  new T.LineDashedMaterial({color:0xff00ff, dashSize:2, gapSize:2, depthTest:false})
);
measLine.visible = false; sc.add(measLine);

// ── STATE ────────────────────────────────────────────────────────────────────
let msh = null;
window.sc = sc; window.cm = cm; window.rn = rn;
const ray = new T.Raycaster(), ms = new T.Vector2();
window.ray = ray; window.ms = ms;

const mem = {
  h:[], s:[], i:-1,
  sv(g){ if(this.i<this.h.length-1){this.h.splice(this.i+1);this.s.splice(this.i+1);}
    this.h.push(g.clone()); this.s.push({x:+$('X').value,y:+$('Y').value,z:+$('Z').value});
    if(this.h.length>10){this.h.shift();this.s.shift();}else this.i++;this._ui(); },
  ud(){ if(this.i>0){this.i--;this._ui();return this.h[this.i].clone();}return null; },
  rd(){ if(this.i<this.h.length-1){this.i++;this._ui();return this.h[this.i].clone();}return null; },
  orig(){ return this.h[0]?this.h[0].clone():null; },
  _ui(){ if($('bU'))$('bU').disabled=this.i<=0; if($('bRd'))$('bRd').disabled=this.i>=this.h.length-1; }
};

// ── ENGINECORE — passed to every lazy module ──────────────────────────────────
// Modules receive this object so they don't need to import Three.js themselves
const engineCore = {
  get msh(){ return window.msh; },
  set msh(v){ window.msh = v; msh = v; },
  sc, cm, rn, ct, mem, ray, ms, BGU, T, M, $, sS,
  get wasm(){ return window.wasm; },
  get selFaces(){ return window.selFaces; },
  geo2manifold: (...a) => window.geo2manifold?.(...a),
  manifold2geo: (...a) => window.manifold2geo?.(...a),
  withManifold:  (...a) => window.withManifold?.(...a),
  csgBool:       (...a) => window.csgBool?.(...a),
  uH:            ()    => window.uH?.(),
  clrAll:        ()    => window.clrAll?.(),
};
window.engineCore = engineCore;

// ── LAZY PANEL LOADER ────────────────────────────────────────────────────────
// Tracks which modules have been installed already
const loadedModules = new Set();

window.lazyPanel = async (panelId, moduleName, hdrEl) => {
  // Toggle panel first (immediate feedback)
  const body = hdrEl.nextElementSibling;
  body.classList.toggle('hidden');
  hdrEl.classList.toggle('closed');
  const isOpening = !body.classList.contains('hidden');

  if (!isOpening) return; // Collapsed — nothing to load

  // Already loaded — just open
  if (loadedModules.has(moduleName)) return;

  // Show loading indicator
  sS(`> \u03a3 LOADING ${moduleName.toUpperCase()}...`);

  try {
    const mod = await import(`./src/${moduleName}.js`);
    if (mod.install) {
      await mod.install(engineCore);
    }
    loadedModules.add(moduleName);
    sS(`> \u2713 ${moduleName.toUpperCase()} READY`);
  } catch(e) {
    console.error(`Failed to load module: ${moduleName}`, e);
    body.innerHTML = `<div class="note" style="color:var(--warn)">&#9651; Failed to load ${moduleName}: ${e.message}</div>`;
    sS(`> ERR: ${moduleName} FAILED`);
  }
};

// ── MANIFOLD boots in background immediately ──────────────────────────────────
// Don't wait for it — STL loading works without it
(async () => {
  try {
    const mod = await import('./src/manifold.js');
    window.wasm = await mod.initManifold();
    window.geo2manifold = mod.geo2manifold;
    window.manifold2geo = mod.manifold2geo;
    window.withManifold = mod.withManifold;
    window.csgBool      = mod.csgBool;
    if(window.wasm) sS('> \u03a3 AWAITING I/O \u2014 ENGINE READY');
    window.dispatchEvent(new Event('engine-ready'));
  } catch(e) { console.warn('Manifold failed to load:', e); }
})();

// ── MATERIAL ──────────────────────────────────────────────────────────────────
window.getMat = () => new T.MeshStandardMaterial({
  color: new T.Color($('MC')?$('MC').value:'#00e5ff'),
  metalness: $('MN')?+$('MN').value:0.6,
  roughness: $('RG')?+$('RG').value:0.4,
  side: T.DoubleSide
});

window.syM = () => {
  if(!msh) return; sessionDirty = true;
  const m = msh.material;
  if($('MC')) m.color.set($('MC').value);
  if($('MN')) m.metalness = +$('MN').value;
  if($('RG')) m.roughness = +$('RG').value;
  m.needsUpdate = true;
};

// ── LOADER ────────────────────────────────────────────────────────────────────
function onMeshLoaded(g) {
  if(!g) return;
  if(msh){ sc.remove(msh); msh.geometry.dispose(); msh.material.dispose(); }
  window.clrAll?.(); window.gHoles=[];
  mem.h=[]; mem.s=[]; mem.i=-1;
  if(g.index) g = g.toNonIndexed();
  g.computeVertexNormals();
  g.applyMatrix4(new T.Matrix4().makeRotationX(-M.PI/2)); // Z-up → Y-up
  g.computeBoundingBox();
  const bb = g.boundingBox;
  g.translate(-(bb.max.x+bb.min.x)/2, -bb.min.y, -(bb.max.z+bb.min.z)/2);
  g.computeBoundingBox();
  if(g.attributes.position.count > 500000){
    g = BGU.mergeVertices(g, 0.0005);
    if(g.index) g = g.toNonIndexed();
    g.computeVertexNormals();
    $('meshWarn')?.classList.remove('hidden');
  } else {
    $('meshWarn')?.classList.add('hidden');
  }
  g.computeBoundingBox();
  msh = new T.Mesh(g, getMat());
  window.msh = msh;
  sc.add(msh); mem.sv(g);
  const sy = g.boundingBox.max.y;
  const md = M.max(g.boundingBox.max.x-g.boundingBox.min.x, sy, g.boundingBox.max.z-g.boundingBox.min.z);
  cm.position.set(0, sy/2+md*0.4, md*1.8);
  ct.target.set(0, sy/2, 0); ct.update();
  ['XCT','bRst','XPT','XPL','X3M','XGLB','bHealMesh','XOBJ'].forEach(id=>{const b=$(id);if(b)b.disabled=0;});
  sessionDirty = false;
  window.uH?.();
  sS('> \u03a3 LOADED: ' + (g.attributes.position.count/3|0).toLocaleString() + ' \u25b2 \u2014 ' + window.srcFileName);
}

if($('F')) $('F').onchange = e => {
  const file = e.target.files[0]; if(!file) return;
  window.srcFileName = file.name.replace(/\.[^.]+$/,'');
  const ext = file.name.split('.').pop().toLowerCase();
  const r = new FileReader();
  sS('> \u03a3 LOADING ' + file.name + '...');
  if(ext==='stl'){ r.onload=ev=>{try{onMeshLoaded(new STLLoader().parse(ev.target.result));}catch(err){sS('> ERR: '+err.message);}}; r.readAsArrayBuffer(file); }
  else if(ext==='ply'){ r.onload=ev=>{try{onMeshLoaded(new PLYLoader().parse(ev.target.result));}catch(err){sS('> ERR: '+err.message);}}; r.readAsArrayBuffer(file); }
  else if(ext==='obj'){ r.onload=ev=>{try{const res=new OBJLoader().parse(ev.target.result);let g=null;res.traverse(c=>{if(c.isMesh&&!g)g=c.geometry.clone();});if(!g)throw new Error('No mesh in OBJ');onMeshLoaded(g);}catch(err){sS('> ERR: '+err.message);}}; r.readAsText(file); }
  else if(ext==='3mf'){ r.onload=ev=>{try{const res=new ThreeMFLoader().parse(ev.target.result);let g=null;res.traverse(c=>{if(c.isMesh&&!g)g=c.geometry.clone();});if(!g)throw new Error('No mesh in 3MF');onMeshLoaded(g);}catch(err){sS('> ERR: '+err.message);}}; r.readAsArrayBuffer(file); }
  else if(ext==='glb'||ext==='gltf'){ r.onload=ev=>{try{new GLTFLoader().parse(ev.target.result,'',gltf=>{let g=null;gltf.scene.traverse(c=>{if(c.isMesh&&!g)g=c.geometry.clone();});if(!g)throw new Error('No mesh in GLB');onMeshLoaded(g);},err=>{sS('> ERR: '+err.message);});}catch(err){sS('> ERR: '+err.message);}}; r.readAsArrayBuffer(file); }
  else { sS('> UNSUPPORTED FORMAT: .' + ext); }
  e.target.value = '';
};

// ── SCALE ─────────────────────────────────────────────────────────────────────
let sessionDirty = false;
window.upS = (v, ax) => {
  if(!msh) return; sessionDirty = true;
  const n = parseFloat(v)/100;
  if(window.scalesLinked){ msh.scale.set(n,n,n); if($('X'))$('X').value=v; if($('Y'))$('Y').value=v; if($('Z'))$('Z').value=v; }
  else if(ax==='x') msh.scale.x=n;
  else if(ax==='y') msh.scale.y=n;
  else if(ax==='z') msh.scale.z=n;
};
window.togLock = () => { window.scalesLinked=!window.scalesLinked; $('bLock').textContent=window.scalesLinked?'\uD83D\uDD12':'\uD83D\uDD13'; };

// ── UNDO/REDO ─────────────────────────────────────────────────────────────────
window.doU = () => { const g=mem.ud(); if(g&&msh){window.clrAll?.();msh.geometry.dispose();msh.geometry=g;window.uH?.();sS('> \u21BA UNDO');} };
window.doD = () => { const g=mem.rd(); if(g&&msh){window.clrAll?.();msh.geometry.dispose();msh.geometry=g;window.uH?.();sS('> \u21BB REDO');} };
window.rstM= () => { const o=mem.orig(); if(!o||!msh)return; window.clrAll?.(); window.gHoles=[]; msh.geometry.dispose(); msh.geometry=o; msh.scale.set(1,1,1); msh.position.set(0,0,0); $('X')&&($('X').value=$('Y').value=$('Z').value=100); mem.h=[o.clone()]; mem.s=[{x:100,y:100,z:100}]; mem.i=0; mem._ui(); window.uH?.(); sS('> \u21BA RESTORED'); };

// ── VISUALS TOGGLES ───────────────────────────────────────────────────────────
window.tog = m => {
  if(m==='w'&&msh){msh.material.wireframe=!msh.material.wireframe;$('bW').classList.toggle('on');}
  if(m==='g'&&msh){msh.material.transparent=!msh.material.transparent;msh.material.opacity=msh.material.transparent?.3:1;$('bG').classList.toggle('on');}
  if(m==='gr'){window.gOn=!window.gOn;grO.visible=window.gOn;$('bGr').classList.toggle('on');}
  if(m==='s'){window.sOn=!window.sOn;sfO.visible=window.sOn;$('bSt').classList.toggle('on');}
};

// ── HUD ───────────────────────────────────────────────────────────────────────
window.uH = () => {
  if(!msh||!msh.geometry?.attributes?.position){
    $('h0')&&($('h0').innerHTML=''); $('h1')&&($('h1').innerHTML=''); $('h2')&&($('h2').innerHTML='');
    window.cubeStats={v:'--',t:'--',mf:'--',sz:'--',fps:window.cubeStats?.fps||'--'};
    window.updateCubeFaces?.(); return;
  }
  msh.geometry.computeBoundingBox();
  const s = msh.geometry.boundingBox.getSize(new T.Vector3());
  const t = (msh.geometry.attributes.position.count/3|0);
  $('h0')&&($('h0').innerHTML=`\u25b2 <span>${t.toLocaleString()}</span><br>`);
  $('h1')&&($('h1').innerHTML=`\u03a3 <span>${s.x.toFixed(1)}\u00d7${s.y.toFixed(1)}\u00d7${s.z.toFixed(1)}mm</span><br>`);
  window.cubeStats = { v:msh.geometry.attributes.position.count.toLocaleString(), t:t.toLocaleString(), sz:`${s.x.toFixed(0)}\u00d7${s.y.toFixed(0)}\u00d7${s.z.toFixed(0)}`, fps:window.cubeStats?.fps||'--', mf:'--' };
  window.updateCubeFaces?.();
};

// ── VIEWCUBE boot (always loaded — tiny) ──────────────────────────────────────
(async () => {
  try {
    const vc = await import('./src/viewcube.js');
    vc.initViewCube(sc, cm, ct);
  } catch(e) { console.warn('ViewCube failed:', e); }
})();

// ── POINTER EVENTS ────────────────────────────────────────────────────────────
window.addEventListener('pointerdown', e => {
  $('ctxMenu')&&($('ctxMenu').style.display='none');
  if(e.target.closest('#ui')||e.target.closest('#hudContainer')||e.target.closest('#aboutModal')||e.target.closest('#floatHistory')||e.button!==0) return;
  if(window.flt||!msh) return;
  if(window.isPartRotMode){ window.isDraggingMesh=true; window.meshDragLast.x=e.clientX; window.meshDragLast.y=e.clientY; return; }
  ms.x=(e.clientX/innerWidth)*2-1; ms.y=-(e.clientY/innerHeight)*2+1;
  ray.setFromCamera(ms,cm);
  // Delegate to face-select module if loaded
  window._onPointerDown?.(e);
});

window.addEventListener('pointermove', e => {
  if(window.isDraggingMesh&&msh){
    const dx=e.clientX-window.meshDragLast.x, dy=e.clientY-window.meshDragLast.y;
    msh.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),dx*.01));
    msh.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0).applyQuaternion(cm.quaternion),dy*.01));
    window.meshDragLast.x=e.clientX; window.meshDragLast.y=e.clientY; return;
  }
  window._onPointerMove?.(e);
});

window.addEventListener('pointerup', e => { window.isDraggingMesh=false; window._onPointerUp?.(e); });

window.addEventListener('contextmenu', e => {
  if(!msh||e.target.closest('#ui')) return; e.preventDefault();
  const ctx=$('ctxMenu'); if(!ctx) return;
  ctx.style.left=e.clientX+'px'; ctx.style.top=e.clientY+'px'; ctx.style.display='flex';
});

document.addEventListener('click', () => { $('ctxMenu')&&($('ctxMenu').style.display='none'); });

// Keyboard
window.fKeys = {};
window.addEventListener('keydown', e => {
  window.fKeys[e.key]=true;
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
  if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')){ e.preventDefault(); window.doU(); return; }
  if((e.ctrlKey||e.metaKey)&&(e.key==='y'||e.key==='Y')){ e.preventDefault(); window.doD(); return; }
  if(e.key===' '){ e.preventDefault(); window.exeC?.(); return; }
  window._onKeyDown?.(e);
});
window.addEventListener('keyup', e => { window.fKeys[e.key]=false; });

// Wheel: plain = scroll pattern, Ctrl = zoom
rn.domElement.addEventListener('wheel', e => {
  if(e.ctrlKey||e.metaKey){
    e.preventDefault();
    const fac=e.deltaY>0?1.1:0.91, dir=cm.position.clone().sub(ct.target), nl=dir.length()*fac;
    if(nl>5&&nl<3000) cm.position.copy(ct.target).addScaledVector(dir.normalize(),nl); ct.update();
  } else {
    e.preventDefault();
    const sel=$('PT'); if(!sel) return;
    let idx=sel.selectedIndex+(e.deltaY>0?1:-1);
    idx=M.max(0,M.min(sel.options.length-1,idx)); sel.selectedIndex=idx;
    $('charRow')?.classList.toggle('hidden',sel.value!=='char');
    window.uPrv?.();
  }
},{passive:false,capture:true});

window.addEventListener('mouseup', e => { if(e.button===3)window.doU(); if(e.button===4)window.doD(); });
window.onresize = () => { cm.aspect=innerWidth/innerHeight; cm.updateProjectionMatrix(); rn.setSize(innerWidth,innerHeight); };

// ── SESSION PERSISTENCE ───────────────────────────────────────────────────────
const idb=(mode,data)=>new Promise((res,rej)=>{
  const q=indexedDB.open('P3dK_DB',1);
  q.onupgradeneeded=()=>q.result.createObjectStore('workspace');
  q.onsuccess=()=>{const s=q.result.transaction('workspace',mode).objectStore('workspace');const o=mode==='readwrite'?s.put(data,'P3dK_S'):s.get('P3dK_S');o.onsuccess=()=>res(o.result);o.onerror=()=>rej(o.error);};
  q.onerror=()=>rej(q.error);
});
async function saveSession(){
  try{if(!msh?.geometry?.attributes?.position)return;const g=msh.geometry,mat=msh.material,pos=g.attributes.position;
  await idb('readwrite',{v:1,p:new Float32Array(pos.array),i:g.index?new Uint32Array(g.index.array):null,sx:+$('X').value,sy:+$('Y').value,sz:+$('Z').value,c:mat.color?.getHex()??0x00e5ff,mt:mat.metalness??0.6,ro:mat.roughness??0.4,h:JSON.stringify(window.nbHistory||[])});
  sS('> \u2713 SESSION SAVED');}catch(e){console.warn('save:',e);}
}
async function restoreSession(){
  try{const d=await idb('readonly');if(!d?.p||!msh)return;
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(d.p,3));if(d.i)g.setIndex(new T.BufferAttribute(d.i,1));g.computeVertexNormals();g.computeBoundingBox();
  if(msh.geometry)msh.geometry.dispose();msh.geometry=g;const mat=msh.material;
  if(mat){if(d.c!==undefined)mat.color.setHex(d.c);if(d.mt!==undefined)mat.metalness=d.mt;if(d.ro!==undefined)mat.roughness=d.ro;mat.needsUpdate=true;}
  if($('X'))$('X').value=d.sx??100;if($('Y'))$('Y').value=d.sy??100;if($('Z'))$('Z').value=d.sz??100;
  if($('MC')&&d.c!==undefined)$('MC').value='#'+d.c.toString(16).padStart(6,'0');
  if($('MN')&&d.mt!==undefined)$('MN').value=d.mt;if($('RG')&&d.ro!==undefined)$('RG').value=d.ro;
  if(d.h){try{window.nbHistory=JSON.parse(d.h);}catch(e){}}
  ['XCT','bRst','XPT','XPL','X3M','XGLB','bHealMesh','XOBJ'].forEach(id=>{const b=$(id);if(b)b.disabled=0;});
  uH();sS('> \u2713 SESSION RESTORED');}catch(e){console.warn('restore:',e);}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&sessionDirty){saveSession();sessionDirty=false;}});
setInterval(()=>{if(sessionDirty){saveSession();sessionDirty=false;}},10000);
window.addEventListener('engine-ready',()=>restoreSession(),{once:true});

// ── RENDER LOOP ───────────────────────────────────────────────────────────────
let t0=performance.now(), fF=0;
rn.setAnimationLoop(t => {
  ct.update();
  if(window.camTween){
    window.camTween.prog=M.min(1,window.camTween.prog+0.016/(window.camTween.dur||0.4));
    const ease=1-M.pow(1-window.camTween.prog,3);
    cm.position.lerpVectors(window.camTween.from,window.camTween.to,ease);
    if(window.camTween.prog>=1) window.camTween=null;
  }
  if(window.flt&&window.fCam) rn.render(sc,window.fCam);
  else rn.render(sc,cm);
  // ViewCube render (provided by viewcube module)
  window._vcRender?.();
  fF++;if(t-t0>=500){window.cubeStats.fps=M.round(fF*1000/(t-t0));window.updateCubeFaces?.();fF=0;t0=t;}
});

sS('\u03a3 AWAITING I/O \u2014 DROP MESH TO BEGIN');
