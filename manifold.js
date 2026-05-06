/**
 * P3dK // manifold.js
 * WASM boolean geometry kernel — manifold-3d (Blender "Exact" equivalent).
 * Exports: initManifold(), geo2manifold(), manifold2geo(), withManifold(), csgBool()
 * Dependencies: three, three/addons/utils/BufferGeometryUtils.js
 * Size target: <12KB
 */
import * as T from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
const M = Math;

export let wasm = null;

export async function initManifold() {
  const CDNS = [
    'https://unpkg.com/manifold-3d@2.5.1/',
    'https://cdn.jsdelivr.net/npm/manifold-3d@2.5.1/'
  ];
  for (const cdn of CDNS) {
    try {
      const mod = await import(cdn + 'manifold.js');
      const instance = mod.default({ locateFile: f => cdn + f });
      wasm = await Promise.race([
        instance.then ? instance : instance.ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))
      ]);
      wasm.setup();
      console.log('manifold-3d ready:', cdn);
      return wasm;
    } catch(e) { console.warn('manifold CDN failed:', cdn); }
  }
  console.error('manifold-3d unavailable — CSG disabled');
  return null;
}

// ── MESH REPAIR HELPERS — V43 ────────────────────────────────────────────────
// Quantize vertices to fixed precision to merge near-coincident points
const quantizeGeo=(g,p=1000)=>{
  const a=g.attributes.position.array;
  for(let i=0;i<a.length;i++)a[i]=M.round(a[i]*p)/p;
};
// Cull co-planar degenerate triangles that confuse manifold
const cullCollinear=g=>{
  if(!g.index)return;
  const p=g.attributes.position.array,I=g.index.array;
  const V=(i,j)=>p[I[i]*3+j];
  const S=(a,b,c)=>{
    const x=V(b,0)-V(a,0),y=V(b,1)-V(a,1),z=V(b,2)-V(a,2);
    const u=V(c,0)-V(a,0),v=V(c,1)-V(a,1),w=V(c,2)-V(a,2);
    const X=y*w-z*v,Y=z*u-x*w,Z=x*v-y*u,L=M.hypot(X,Y,Z);
    return L<1e-10?[0,0,1]:[X/L,Y/L,Z/L];
  };
  const D=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const F=[];
  for(let i=0;i<I.length;i+=3)F.push({i,n:S(i,i+1,i+2)});
  for(let i=0;i<F.length;i++)for(let j=i+1;j<F.length;j++){
    if(D(F[i].n,F[j].n)>0.999){
      const a=F[i].i,b=F[j].i,Mp=new Map();
      for(let k=0;k<3;k++){Mp.set(I[a+k],(Mp.get(I[a+k])||0)+1);Mp.set(I[b+k],(Mp.get(I[b+k])||0)+1);}
      const s=[...Mp.keys()].filter(k=>Mp.get(k)>1),u=[...Mp.keys()].filter(k=>Mp.get(k)===1);
      if(s.length===2){I[a]=u[0];I[a+1]=u[1];I[a+2]=s[0];I[b]=I[b+1]=I[b+2]=0;}
    }
  }
  const R=[];
  for(let i=0;i<I.length;i+=3)if(I[i]!==I[i+1]&&I[i]!==I[i+2]&&I[i+1]!==I[i+2])R.push(I[i],I[i+1],I[i+2]);
  g.setIndex(R);
};

// ── MANIFOLD RAII TRACKER — V47 pattern ──────────────────────────────────────
// Tracks all Manifold objects created in a block, deletes them on exit.
// Prevents WASM heap leaks from abandoned CSG intermediates.
function withManifold(fn){
  const tracked=[];
  const m={track(obj){tracked.push(obj);return obj;},wasm};
  try{return fn(m);}finally{for(const obj of tracked){try{obj.delete();}catch(e){}}}
}
window.withManifold=(...a)=>withManifold(...a);

// ── csgBool — unified CSG helper used by kinetic builder + constructor ────────
// op: 'sub'|'union'|'intersect', tool: THREE.Mesh in world space
function csgBool(op,tool){
  if(!wasm){sS('> MANIFOLD NOT LOADED');throw new Error('manifold-3d not loaded');}
  msh.updateMatrixWorld(true);
  const srcGeo=msh.geometry.clone();srcGeo.applyMatrix4(msh.matrixWorld);
  try{
    const ng=withManifold(m=>{
      const mA=m.track(geo2manifold(srcGeo));
      const mB=m.track(geo2manifold(tool.geometry));
      let mR;
      if(op==='sub')mR=m.track(mA.subtract(mB));
      else if(op==='intersect')mR=m.track(mA.intersect(mB));
      else mR=m.track(mA.add(mB));
      return manifold2geo(mR);
    });
    msh.scale.set(1,1,1);msh.position.set(0,0,0);msh.rotation.set(0,0,0);
    $('X').value=$('Y').value=$('Z').value=100;
    msh.updateMatrixWorld();msh.geometry.dispose();msh.geometry=ng;mem.sv(ng);
  }finally{srcGeo.dispose();}
}
window.csgBool=(...a)=>csgBool(...a);

function geo2manifold(geo){
  if(!wasm)throw new Error('manifold-3d not loaded');
  // Ensure indexed — mergeVertices deduplicates vertices and creates index buffer
  let g=BGU.mergeVertices(geo.index?geo:geo,0.0005);
  quantizeGeo(g);if(g.index)cullCollinear(g);
  if(!g.index) throw new Error('mergeVertices failed to create index');
  const pos=g.attributes.position;
  const idx=g.index;
  const nv=pos.count;
  const vp=new Float32Array(nv*3);
  for(let i=0;i<nv;i++){vp[i*3]=pos.getX(i);vp[i*3+1]=pos.getY(i);vp[i*3+2]=pos.getZ(i);}
  const tv=new Uint32Array(idx.count);
  for(let i=0;i<idx.count;i++) tv[i]=idx.array[i];
  
  console.log('  geo2manifold: verts='+nv+' tris='+idx.count/3+' indexed='+!!geo.index);
  
  const mesh=new wasm.Mesh({numProp:3, vertProperties:vp, triVerts:tv});
  
  // Try merge() first — it fixes non-manifold topology by welding duplicate verts
  const mergeResult=mesh.merge();
  console.log('  merge() changed:', mergeResult);
  
  try{
    return wasm.Manifold.ofMesh(mesh);
  }catch(e){
    console.error('  ofMesh failed:', e.message||e);
    throw e;
  }
}

// Convert Manifold back to Three.js BufferGeometry
function manifold2geo(manifold){
  // v2.5.1: getMesh() takes optional normalIdx array, default [0,0,0]
  const mesh=manifold.getMesh();
  const numProp=mesh.numProp||3;
  const vp=mesh.vertProperties;
  const tv=mesh.triVerts;
  const geo=new T.BufferGeometry();
  // vertProperties may have more than 3 props per vert (normals etc.)
  // Extract just xyz (first 3 of each numProp stride)
  if(numProp===3){
    geo.setAttribute('position',new T.BufferAttribute(new Float32Array(vp),3));
  }else{
    const nv=vp.length/numProp;
    const pos=new Float32Array(nv*3);
    for(let i=0;i<nv;i++){pos[i*3]=vp[i*numProp];pos[i*3+1]=vp[i*numProp+1];pos[i*3+2]=vp[i*numProp+2];}
    geo.setAttribute('position',new T.BufferAttribute(pos,3));
  }
  geo.setIndex(new T.BufferAttribute(new Uint32Array(tv),1));
  const ng=geo.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
}

const $=id=>document.getElementById(id), M=Math;
window.uS=(e,v)=>{$(v).textContent=parseFloat(e.value).toFixed(e.step<1?2:0);};
const sS=m=>$('sts').textContent=m;

window.togUI=()=>{$('ui').classList.toggle('collapsed');$('uiToggle').classList.toggle('collapsed');$('uiToggle').textContent=$('uiToggle').classList.contains('collapsed')?'▶':'◀';};
window.tP=hdr=>{hdr.nextElementSibling.classList.toggle('hidden');hdr.classList.toggle('closed');};

export { geo2manifold, manifold2geo, withManifold, csgBool, quantizeGeo, cullCollinear };
