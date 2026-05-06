/**
 * P3dK // exporter.js
 * STL / PLY / 3MF / OBJ / GLB export with CRC32-valid ZIP for 3MF.
 * Exports: install(engineCore) — called once on first export click
 * Size target: <10KB
 */
import * as T from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
const M = Math;

export async function install(engineCore) {
  const { msh, sS } = engineCore;
// ── EXPORT — STL + PLY + 3MF + GLB ───────────────────────────────────────────
// Minimal ZIP (stored, no compression) — demoscene-style minimal implementation.
// 3MF = ZIP containing XML mesh description. Native to most modern slicers.
// CRC32 is REQUIRED — without it PrusaSlicer/Cura/Bambu report "no 3D data".
const crc32Tab=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[i]=c;}return t;})();
function crc32(data){let c=0xFFFFFFFF;for(let i=0;i<data.length;i++)c=crc32Tab[(c^data[i])&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}

function mkZip(files){
  // files: [{name:string, data:Uint8Array}]
  const enc=new TextEncoder();
  const parts=[],cd=[];let off=0;
  for(const f of files){
    const nm=enc.encode(f.name),d=f.data;
    // Local file header (30+name)
    const lh=new Uint8Array(30+nm.length);const lv=new DataView(lh.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);// ver needed
    lv.setUint16(8,0,true);// method=stored
    lv.setUint32(14,crc32(d),true);// crc32 — required for 3MF slicers
    lv.setUint32(18,d.length,true);lv.setUint32(22,d.length,true);
    lv.setUint16(26,nm.length,true);lh.set(nm,30);
    parts.push(lh,d);
    // Central dir entry
    const ce=new Uint8Array(46+nm.length);const cv=new DataView(ce.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
    cv.setUint32(16,crc32(d),true);cv.setUint32(20,d.length,true);cv.setUint32(24,d.length,true);
    cv.setUint16(28,nm.length,true);cv.setUint32(42,off,true);ce.set(nm,46);
    cd.push(ce);off+=lh.length+d.length;
  }
  const cdOff=off;let cdSize=0;cd.forEach(c=>{parts.push(c);cdSize+=c.length;});
  // End of central directory
  const eocd=new Uint8Array(22);const ev=new DataView(eocd.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);
  ev.setUint32(12,cdSize,true);ev.setUint32(16,cdOff,true);parts.push(eocd);
  const total=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(total);
  let w=0;for(const p of parts){out.set(p,w);w+=p.length;}
  return out;
}

window.doX=(fmt)=>{
  if(!msh)return;
  // Pre-export manifold check + auto-repair
  let geo=msh.geometry;
  let be=manifoldCheck(geo);
  if(be>0){
    sS('> CLEANING '+be+' boundary edges...');
    let cg=BGU.mergeVertices(geo.clone(),0.0005);if(cg.index)cg=cg.toNonIndexed();cg.computeVertexNormals();
    msh.geometry.dispose();msh.geometry=cg;geo=cg;
    be=manifoldCheck(geo);
  }
  $('mfStatus').textContent=be>0?'⚠ '+be+' non-manifold edges remain':'✓ WATERTIGHT — ready for slicer';
  $('mfStatus').style.color=be>0?'#ffa040':'#0f9';$('mfStatus').classList.remove('hidden');
  const eG=msh.geometry.clone();eG.applyMatrix4(msh.matrixWorld);

  // GLB: async export via GLTFExporter (binary glTF — Blender, web viewers, game engines)
  if(fmt==='glb'){
    const exportScene=new T.Scene();
    const exportMesh=new T.Mesh(eG,new T.MeshStandardMaterial({
      color:new T.Color($('MC').value),metalness:+$('MN').value,roughness:+$('RG').value
    }));
    exportScene.add(exportMesh);
    new GLTFExporter().parse(exportScene,(glb)=>{
      const a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([glb],{type:'application/octet-stream'}));
      a.download=srcFileName+'-modded-by-P3dK.glb';a.click();
      exportMesh.geometry.dispose();exportMesh.material.dispose();
      sS('> EXPORTED GLB');
    },err=>{console.error('GLB export error:',err);sS('> GLB EXPORT FAILED');},{binary:true});
    return;
  }

  const a=document.createElement('a');
  if(fmt==='obj'){const exp=new T.Mesh(eG,msh.material);const lines=['# P3dK OBJ export'];const pos2=eG.attributes.position;for(let i=0;i<pos2.count;i++)lines.push(`v ${pos2.getX(i).toFixed(4)} ${pos2.getY(i).toFixed(4)} ${pos2.getZ(i).toFixed(4)}`);for(let i=0;i<pos2.count;i+=3)lines.push(`f ${i+1} ${i+2} ${i+3}`);const blob=new Blob([lines.join('\n')],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=srcFileName+'-modded-by-P3dK.obj';a.click();return;}
  if(fmt==='ply'){
    const pos=eG.attributes.position,nrm=eG.attributes.normal;
    const vc=pos.count,fc=vc/3;
    let out=`ply\nformat ascii 1.0\ncomment P3dK V37\nelement vertex ${vc}\nproperty float x\nproperty float y\nproperty float z\n`;
    if(nrm)out+=`property float nx\nproperty float ny\nproperty float nz\n`;
    out+=`element face ${fc}\nproperty list uchar int vertex_indices\nend_header\n`;
    for(let i=0;i<vc;i++){
      out+=`${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}`;
      if(nrm)out+=` ${nrm.getX(i).toFixed(4)} ${nrm.getY(i).toFixed(4)} ${nrm.getZ(i).toFixed(4)}`;
      out+='\n';
    }
    for(let i=0;i<fc;i++)out+=`3 ${i*3} ${i*3+1} ${i*3+2}\n`;
    a.href=URL.createObjectURL(new Blob([out],{type:'text/plain'}));a.download=srcFileName+'-modded-by-P3dK.ply';
  }else if(fmt==='3mf'){
    const pos=eG.attributes.position,vc=pos.count;
    const vMap=new Map(),verts=[],tris=[];
    const vk=(x,y,z)=>`${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    for(let i=0;i<vc;i+=3){
      const idx=[];
      for(let j=0;j<3;j++){
        const x=pos.getX(i+j),y=pos.getY(i+j),z=pos.getZ(i+j),k=vk(x,y,z);
        if(!vMap.has(k)){vMap.set(k,verts.length);verts.push([x,y,z]);}
        idx.push(vMap.get(k));
      }
      tris.push(idx);
    }
    let xml='<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n<resources><object id="1" type="model"><mesh>\n<vertices>\n';
    for(const[x,y,z]of verts)xml+=`<vertex x="${x.toFixed(4)}" y="${y.toFixed(4)}" z="${z.toFixed(4)}"/>\n`;
    xml+='</vertices>\n<triangles>\n';
    for(const[v1,v2,v3]of tris)xml+=`<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>\n`;
    xml+='</triangles>\n</mesh></object></resources>\n<build><item objectid="1"/></build>\n</model>';
    const enc=new TextEncoder();
    const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
    const ct='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
    const zip=mkZip([
      {name:'[Content_Types].xml',data:enc.encode(ct)},
      {name:'_rels/.rels',data:enc.encode(rels)},
      {name:'3D/3dmodel.model',data:enc.encode(xml)}
    ]);
    a.href=URL.createObjectURL(new Blob([zip],{type:'application/vnd.ms-package.3dmanufacturing-3dmodel+xml'}));
    a.download=srcFileName+'-modded-by-P3dK.3mf';
  }else{
    // Default: STL
    a.href=URL.createObjectURL(new Blob([new STLExporter().parse(new T.Mesh(eG,msh.material))],{type:'text/plain'}));
    a.download=srcFileName+'-modded-by-P3dK.stl';
  }
  a.click();eG.dispose();
};

  window.doX = doX;
}
