/**
 * P3dK // kinetic.js — The Hephaestus Pin
 * Drag-and-drop hole/boss/heal/box/oval placement on mesh faces.
 * Exports: install(engineCore) — lazy loaded when panel opens
 * Size target: <8KB
 */
import * as T from 'three';
const M = Math;

export async function install(engineCore) {
  // All kinetic state is on window.* already from scope manager
  // This module just ensures the implementations are live
// ── KINETIC BUILDER + HEAL TOOL (V34: FIX-C2) ───────────────────────────────
// Shared state machine: hole/boss use cylinder, heal uses rectangular plate.
// HEAL: drag onto face → auto-detects face bounds → shows plate preview →
// mouse X = width, Enter → mouse Y = height, Enter → applies thin CSG union.
let healW=0,healH=0; // heal plate dimensions
window.startDrag=(e,mode)=>{if(!msh)return;clrAll();cylState=1;cMode=mode;cOD=6;cLen=10;healW=0;healH=0;kbBuf='';
  $('codv').textContent=mode==='heal'?'—':'6.0';$('clnv').textContent=mode==='heal'?'—':'10.0';
  sS('> DRAG '+mode.toUpperCase()+' ONTO FACE');};
function updateCylPrv(){
  if(cMesh){sc.remove(cMesh);cMesh.geometry.dispose();cMesh=null;}
  if(!cWn||!cWp)return;
  if(cMode==='heal'){
    // Heal mode: show rectangular plate preview matching face area
    if(!cylFd)return;
    const{b,xAx,yAx,wn,wp}=cylFd;
    const w=healW||M.round(b.maxU-b.minU); // auto-detect from face if not set
    const h=healH||M.round(b.maxV-b.minV);
    healW=w;healH=h;
    const thick=getThickness(wp,wn);
    $('codv').textContent=w.toFixed(0)+'×'+h.toFixed(0);
    $('clnv').textContent=(thick+1).toFixed(1);
    // Plate centered on face, thick enough to overlap wall
    const shape=new T.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
    const geo=new T.ExtrudeGeometry(shape,{depth:thick+1,bevelEnabled:false,curveSegments:1});
    const bs=new T.Matrix4().makeBasis(xAx,yAx,wn);
    bs.setPosition(wp.clone().addScaledVector(wn,-(thick+.5)));
    geo.applyMatrix4(bs);
    cMesh=new T.Mesh(geo,new T.MeshBasicMaterial({color:0x00ffff,transparent:true,opacity:.4,depthTest:false}));
    sc.add(cMesh);
  }else{
    // Hole/Boss: cylinder preview (unchanged)
    const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),cWn.clone().normalize());
    const g=new T.CylinderGeometry(cOD/2,cOD/2,cMode==='hole'?cLen+1:cLen,32,1);
    g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(q));
    const ctr=cMode==='hole'?cWp.clone().addScaledVector(cWn,.3-(cLen+1)/2):cWp.clone().addScaledVector(cWn,cLen/2);
    g.applyMatrix4(new T.Matrix4().setPosition(ctr));
    cMesh=new T.Mesh(g,new T.MeshBasicMaterial({color:cMode==='hole'?0xff00ff:0x00ff88,transparent:true,opacity:.6,depthTest:false}));sc.add(cMesh);
  }
}
async function runCylCut(){
  if(!cMesh)return;sS('> EXECUTING '+cMode.toUpperCase()+'...');cylState=0;$('meas').classList.add('hidden');
  await new Promise(r=>setTimeout(r,30));
  try{
    const pch=new T.Mesh(cMesh.geometry.clone(),new T.MeshBasicMaterial());
    pch.matrixAutoUpdate=false;pch.matrix.identity();pch.matrixWorld.identity();
    // Heal = union (add material), Hole = subtract, Boss = union
    csgBool(cMode==='hole'?'sub':'union',pch);
    gHoles.push(cWp.clone());pch.geometry.dispose();sc.remove(cMesh);cMesh.geometry.dispose();cMesh=null;uH();
    sS('> '+(cMode==='heal'?'HEALED':'BOOLEAN COMPLETE'));
  }catch(err){sS('> ERR: '+err.message?.slice(0,40));}
}

  window.startDrag = startDrag;
  window.updateCylPrv = updateCylPrv;
  window.runCylCut = runCylCut;
}
