/**
 * P3dK // viewcube.js
 * 80px WebGL orientation cube. Click/dblclick snaps camera.
 * Exports: initViewCube(scene, camera, controls)
 * Size target: <6KB
 */
import * as T from 'three';
const M = Math;

export function initViewCube(sc, cm, ct) {
// ── VIEW CUBE — V39 ──────────────────────────────────────────────────────────
// Fixed position top-right. Mirrors main camera orientation.
// Single-click: snap camera to that face. Double-click: snap camera.
// The cube itself is static in the scene — only its rotation mirrors the camera.
const PX=Math.min(devicePixelRatio,2);
const VC_SIZE=180;
const vcRn=new T.WebGLRenderer({alpha:true,antialias:true});
vcRn.setSize(VC_SIZE*PX,VC_SIZE*PX);
vcRn.domElement.style.width=VC_SIZE+'px';
vcRn.domElement.style.height=VC_SIZE+'px';
vcRn.setPixelRatio(PX);
$('vcCanvasWrap').appendChild(vcRn.domElement);

const vcSc=new T.Scene();
// Camera fixed at distance, looking at origin — cube rotates to match main cam
const vcCm=new T.PerspectiveCamera(40,1,0.1,100);vcCm.position.set(0,0,5.5);

// Lighting
const vcAmb=new T.AmbientLight(0xffffff,0.9);vcSc.add(vcAmb);
const vcDl=new T.DirectionalLight(0xffffff,2.0);vcDl.position.set(3,5,4);vcSc.add(vcDl);
const vcDl2=new T.DirectionalLight(0x8888ff,0.4);vcDl2.position.set(-3,-2,-4);vcSc.add(vcDl2);

// Face name order matches BoxGeometry face order: +X,-X,+Y,-Y,+Z,-Z
const vcFaceNames=['R','L','T','B','F','K'];
const vcFaceLabels=['RIGHT','LEFT','TOP','BOTTOM','FRONT','BACK'];
const vcCtxs=[],vcTexs=[];

// Build crisp face textures — draw at native resolution
function vcBuildTex(i,isLight){
  const SZ=256,cx=vcCtxs[i];
  const bg=isLight?'rgba(220,235,255,0.95)':'rgba(8,12,28,0.97)';
  const acc=isLight?'#6600aa':'#00ffcc';
  const txt=isLight?'#0a0a20':'#ffffff';
  const bord=isLight?'rgba(100,0,200,0.7)':'rgba(0,255,200,0.8)';
  cx.clearRect(0,0,SZ,SZ);
  cx.fillStyle=bg;cx.fillRect(0,0,SZ,SZ);
  // Border
  cx.strokeStyle=bord;cx.lineWidth=6;cx.strokeRect(4,4,SZ-8,SZ-8);
  // Face label — large, centered
  cx.fillStyle=acc;cx.font='bold 52px monospace';cx.textAlign='center';cx.textBaseline='middle';
  cx.fillText(vcFaceLabels[i],SZ/2,SZ/2-20);
  // Stats — smaller below
  const cs=window.cubeStats||{};
  cx.font='bold 20px monospace';cx.fillStyle=txt;
  cx.fillText((cs.t||'—')+' TRI',SZ/2,SZ/2+30);
  cx.fillText((cs.sz||'—'),SZ/2,SZ/2+58);
  cx.fillStyle=cs.mf&&cs.mf[0]==='✓'?'#00ee88':'#ffaa00';
  cx.fillText(cs.mf||'—',SZ/2,SZ/2+86);
  vcTexs[i].needsUpdate=true;
}

const vcMats=vcFaceNames.map((name,i)=>{
  const cvs=document.createElement('canvas');cvs.width=256;cvs.height=256;
  const cx=cvs.getContext('2d');vcCtxs.push(cx);
  const tex=new T.CanvasTexture(cvs);
  tex.minFilter=T.LinearFilter;tex.magFilter=T.LinearFilter;
  vcTexs.push(tex);
  return new T.MeshStandardMaterial({map:tex,roughness:0.15,metalness:0.4,
    envMapIntensity:0.5});
});

window.cubeStats={v:'—',t:'—',mf:'—',sz:'—',fps:'—'};
window.updateCubeFaces=()=>{
  const light=document.documentElement.classList.contains('light-mode');
  vcFaceNames.forEach((_,i)=>vcBuildTex(i,light));
};
window.updateCubeFaces();

// Beveled cube — use a BoxGeometry with extra segments and scale normals for bevel look
// Achieved by merging a slightly smaller box with rounded-corner sphere at edges
const vcCube=new T.Mesh(new T.BoxGeometry(1.8,1.8,1.8,1,1,1),vcMats);
vcSc.add(vcCube);

// Edge highlight wireframe — bevel effect
const vcEdge=new T.LineSegments(
  new T.EdgesGeometry(new T.BoxGeometry(1.82,1.82,1.82)),
  new T.LineBasicMaterial({color:0x00ffcc,transparent:true,opacity:0.6})
);
vcSc.add(vcEdge);

// Camera tween for smooth view snap
let camTween=null;

// Raycaster for click detection
const vcMouse=new T.Vector2(),vcRay=new T.Raycaster();

function vcGetHitNormal(e){
  const r=vcRn.domElement.getBoundingClientRect();
  vcMouse.set(((e.clientX-r.left)/VC_SIZE)*2-1,-((e.clientY-r.top)/VC_SIZE)*2+1);
  vcRay.setFromCamera(vcMouse,vcCm);
  const hits=vcRay.intersectObject(vcCube);
  if(!hits.length)return null;
  // Transform face normal from cube local space to world space
  const localN=hits[0].face.normal.clone();
  const worldN=localN.transformDirection(vcCube.matrixWorld);
  return worldN;
}

// Single click — snap camera
vcRn.domElement.addEventListener('click',e=>{
  const n=vcGetHitNormal(e);
  if(!n)return;
  // n points away from the face — camera should be on that side looking in
  const dist=cm.position.distanceTo(ct.target);
  const newPos=ct.target.clone().addScaledVector(n,dist);
  // Keep some up-vector reference
  camTween={from:cm.position.clone(),to:newPos,prog:0,dur:0.4};
});

// Double click — same but zoom in slightly
vcRn.domElement.addEventListener('dblclick',e=>{
  const n=vcGetHitNormal(e);
  if(!n)return;
  const dist=cm.position.distanceTo(ct.target)*0.75;
  const newPos=ct.target.clone().addScaledVector(n,dist);
  camTween={from:cm.position.clone(),to:newPos,prog:0,dur:0.35};
});

}
