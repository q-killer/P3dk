/**
 * P3dK // sculpt.js — The Occam Cleaver
 * Twist, slice, hollow shell, Laplacian smooth.
 * Exports: install(engineCore) — lazy loaded when panel opens
 * Size target: <6KB
 */
import * as T from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
const M = Math;

export async function install(engineCore) {
  const { msh, sc, mem, wasm, sS, uH, clrAll, geo2manifold, manifold2geo, withManifold } = engineCore;

// ── SCULPT & SLICE ────────────────────────────────────────────────────────────
let slicePrvMesh=null,twistPrvMesh=null;
window.prvTwist=()=>{
  if(twistPrvMesh){sc.remove(twistPrvMesh);twistPrvMesh.geometry.dispose();twistPrvMesh=null;}
  if(!msh)return;const deg=+$('TWT').value;if(deg===0)return;
  const g=msh.geometry.clone();g.applyMatrix4(msh.matrixWorld);
  const pos=g.attributes.position,rad=deg*M.PI/180;
  g.computeBoundingBox();const bb=g.boundingBox,h=bb.max.y-bb.min.y;
  for(let i=0;i<pos.count;i++){
    const t=(pos.getY(i)-bb.min.y)/h,a=t*rad;
    const x=pos.getX(i),z=pos.getZ(i);
    pos.setX(i,x*M.cos(a)-z*M.sin(a));pos.setZ(i,x*M.sin(a)+z*M.cos(a));
  }
  pos.needsUpdate=true;g.computeVertexNormals();
  twistPrvMesh=new T.Mesh(g,new T.MeshBasicMaterial({color:0xffcc00,wireframe:true,transparent:true,opacity:0.5}));
  sc.add(twistPrvMesh);
};
window.applyTwist=async()=>{
  if(!msh)return;const deg=+$('TWT').value;if(deg===0)return;
  sS('> APPLYING TWIST...');await new Promise(r=>setTimeout(r,30));
  if(twistPrvMesh){sc.remove(twistPrvMesh);twistPrvMesh.geometry.dispose();twistPrvMesh=null;}
  const g=msh.geometry.clone();g.applyMatrix4(msh.matrixWorld);
  const pos=g.attributes.position,rad=deg*M.PI/180;
  g.computeBoundingBox();const bb=g.boundingBox,h=bb.max.y-bb.min.y;
  for(let i=0;i<pos.count;i++){
    const t=(pos.getY(i)-bb.min.y)/h,a=t*rad;
    const x=pos.getX(i),z=pos.getZ(i);
    pos.setX(i,x*M.cos(a)-z*M.sin(a));pos.setZ(i,x*M.sin(a)+z*M.cos(a));
  }
  pos.needsUpdate=true;g.computeVertexNormals();
  msh.scale.set(1,1,1);msh.position.set(0,0,0);msh.rotation.set(0,0,0);
  msh.geometry.dispose();msh.geometry=g;mem.sv(g);
  $('TWT').value=0;uS($('TWT'),'twtv');uH();sS('> TWIST APPLIED');
};
window.prvSlice=()=>{
  if(slicePrvMesh){sc.remove(slicePrvMesh);slicePrvMesh.geometry.dispose();slicePrvMesh=null;}
  if(!msh)return;
  const px=+$('SLX').value/100,py=+$('SLY').value/100,pz=+$('SLZ').value/100;
  if(px===1&&py===1&&pz===1)return;
  msh.geometry.computeBoundingBox();const bb=msh.geometry.boundingBox;
  const sw=new T.Vector3((bb.max.x-bb.min.x)*px,(bb.max.y-bb.min.y)*py,(bb.max.z-bb.min.z)*pz);
  const sg=new T.BoxGeometry(sw.x||0.01,sw.y||0.01,sw.z||0.01);
  sg.translate(bb.min.x+sw.x/2,bb.min.y+sw.y/2,bb.min.z+sw.z/2);
  slicePrvMesh=new T.Mesh(sg,new T.MeshBasicMaterial({color:0x00ffff,wireframe:true,transparent:true,opacity:0.4}));
  sc.add(slicePrvMesh);
};
window.applySlice=async()=>{
  if(!msh)return;
  const px=+$('SLX').value/100,py=+$('SLY').value/100,pz=+$('SLZ').value/100;
  if(px===1&&py===1&&pz===1)return;
  sS('> SLICING...');await new Promise(r=>setTimeout(r,30));
  if(slicePrvMesh){sc.remove(slicePrvMesh);slicePrvMesh.geometry.dispose();slicePrvMesh=null;}
  const g=msh.geometry.clone();g.applyMatrix4(msh.matrixWorld);
  g.computeBoundingBox();const bb=g.boundingBox;
  const maxX=bb.min.x+(bb.max.x-bb.min.x)*px,maxY=bb.min.y+(bb.max.y-bb.min.y)*py,maxZ=bb.min.z+(bb.max.z-bb.min.z)*pz;
  const pos=g.attributes.position,verts=[];
  for(let i=0;i<pos.count;i+=3){
    if(pos.getX(i)<=maxX&&pos.getX(i+1)<=maxX&&pos.getX(i+2)<=maxX&&
       pos.getY(i)<=maxY&&pos.getY(i+1)<=maxY&&pos.getY(i+2)<=maxY&&
       pos.getZ(i)<=maxZ&&pos.getZ(i+1)<=maxZ&&pos.getZ(i+2)<=maxZ){
      for(let j=0;j<3;j++)verts.push(pos.getX(i+j),pos.getY(i+j),pos.getZ(i+j));
    }
  }
  if(!verts.length){sS('> NOTHING LEFT AFTER SLICE');return;}
  const ng=new T.BufferGeometry();ng.setAttribute('position',new T.BufferAttribute(new Float32Array(verts),3));
  ng.computeVertexNormals();msh.scale.set(1,1,1);msh.position.set(0,0,0);msh.rotation.set(0,0,0);
  msh.geometry.dispose();msh.geometry=ng;mem.sv(ng);
  $('SLX').value=$('SLY').value=$('SLZ').value=100;
  uS($('SLX'),'slxv');uS($('SLY'),'slyv');uS($('SLZ'),'slzv');
  uH();sS('> SLICE: '+(ng.attributes.position.count/3|0)+' TRIS');
};

  // Expose to window for HTML onclick
  window.applyTwist  = applyTwist;
  window.applySlice  = applySlice;
  window.prvTwist    = prvTwist;
  window.prvSlice    = prvSlice;
  window.hollowMesh  = hollowMesh;
  window.applyRounding = applyRounding;
}
