/**
 * P3dK // patterns.js — The Fibonacci Loom
 * 12 mathematical 2D pattern generators + clip pipeline.
 * Exports: Fnd (pattern foundry object with mk() method)
 * No Three.js dependency — pure math, returns [[x,y]] arrays + THREE.Shape
 * Size target: <16KB
 */
import * as T from 'three';
const M = Math;

// ── 3D SIMPLEX NOISE (Gustavson algorithm — pure math, no texture) ─────────────
const N3=(()=>{
  const pp=[151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  const p=new Uint8Array(512);for(let i=0;i<256;i++)p[i]=p[i+256]=pp[i];
  const g3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  const dot=(g,x,y,z)=>g[0]*x+g[1]*y+g[2]*z,F=1/3,G=1/6;
  return(x,y,z)=>{
    const s=(x+y+z)*F,i=M.floor(x+s),j=M.floor(y+s),k=M.floor(z+s),t=(i+j+k)*G;
    const x0=x-(i-t),y0=y-(j-t),z0=z-(k-t);
    let i1,j1,k1,i2,j2,k2;
    if(x0>=y0){if(y0>=z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0}else if(x0>=z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1}else{i1=0;j1=0;k1=1;i2=1;j2=0;k2=1}}
    else{if(y0<z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1}else if(x0<z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1}else{i1=0;j1=1;k1=0;i2=1;j2=1;k2=0}}
    const x1=x0-i1+G,y1=y0-j1+G,z1=z0-k1+G,x2=x0-i2+2*G,y2=y0-j2+2*G,z2=z0-k2+2*G,x3=x0-1+3*G,y3=y0-1+3*G,z3=z0-1+3*G;
    const ii=i&255,jj=j&255,kk=k&255;
    const gi0=p[ii+p[jj+p[kk]]]%12,gi1=p[ii+i1+p[jj+j1+p[kk+k1]]]%12,gi2=p[ii+i2+p[jj+j2+p[kk+k2]]]%12,gi3=p[ii+1+p[jj+1+p[kk+1]]]%12;
    let n0=0,n1=0,n2=0,n3=0;
    let t0=.6-x0*x0-y0*y0-z0*z0;if(t0>0){t0*=t0;n0=t0*t0*dot(g3[gi0],x0,y0,z0);}
    let t1=.6-x1*x1-y1*y1-z1*z1;if(t1>0){t1*=t1;n1=t1*t1*dot(g3[gi1],x1,y1,z1);}
    let t2=.6-x2*x2-y2*y2-z2*z2;if(t2>0){t2*=t2;n2=t2*t2*dot(g3[gi2],x2,y2,z2);}
    let t3=.6-x3*x3-y3*y3-z3*z3;if(t3>0){t3*=t3;n3=t3*t3*dot(g3[gi3],x3,y3,z3);}
    return 32*(n0+n1+n2+n3);
  };
})();

// ── POLYGON CLIP ──────────────────────────────────────────────────────────────
const clp=(py,x0,x1,y0,y1)=>{
  const I=[p=>p[0]>=x0,p=>p[0]<=x1,p=>p[1]>=y0,p=>p[1]<=y1],
        S=[(a,b)=>[x0,a[1]+(x0-a[0])/(b[0]-a[0])*(b[1]-a[1])],(a,b)=>[x1,a[1]+(x1-a[0])/(b[0]-a[0])*(b[1]-a[1])],(a,b)=>[a[0]+(y0-a[1])/(b[1]-a[1])*(b[0]-a[0]),y0],(a,b)=>[a[0]+(y1-a[1])/(b[1]-a[1])*(b[0]-a[0]),y1]];
  let o=py;for(let i=0;i<4;i++){if(!o.length)return null;const n=o;o=[];for(let j=0;j<n.length;j++){const c=n[j],p=n[(j+n.length-1)%n.length],ci=I[i](c),pi=I[i](p);if(ci){if(!pi)o.push(S[i](p,c));o.push(c);}else if(pi)o.push(S[i](p,c));}}
  return o.length>2?o:null;
};
const tSh=p=>{
  if(!p||p.length<3)return null;
  let a=0;for(let i=0,n=p.length;i<n;i++)a+=p[i][0]*p[(i+1)%n][1]-p[(i+1)%n][0]*p[i][1];
  if(M.abs(a)*.5<.04)return null;
  const s=new T.Shape();s.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)s.lineTo(p[i][0],p[i][1]);return s;
};
function hpClip(poly,mx,my,nx,ny){
  if(!poly||poly.length<3)return null;const out=[];
  for(let i=0;i<poly.length;i++){
    const c=poly[i],p=poly[(i+poly.length-1)%poly.length];
    const dc=(c[0]-mx)*nx+(c[1]-my)*ny,dp=(p[0]-mx)*nx+(p[1]-my)*ny;
    if(dc>=0){if(dp<0){const t=dp/(dp-dc);out.push([p[0]+t*(c[0]-p[0]),p[1]+t*(c[1]-p[1])]);}out.push(c);}
    else if(dp>=0){const t=dp/(dp-dc);out.push([p[0]+t*(c[0]-p[0]),p[1]+t*(c[1]-p[1])]);}
  }
  return out.length>=3?out:null;
}

// ── CORNER ROUNDING (V33) ─────────────────────────────────────────────────────
// Replaces each polygon corner with a quadratic bezier arc.
// rf=0 → sharp corners (original). rf=1 → maximum radius.
// ARC_SEGS=6 balances quality vs polygon count for CSG.
const ARC_SEGS=6;
function cornerRound(poly,rf){
  if(!poly||poly.length<3||rf<=0)return poly;
  const n=poly.length,out=[];
  for(let i=0;i<n;i++){
    const prev=poly[(i+n-1)%n],curr=poly[i],next=poly[(i+1)%n];
    const dx1=prev[0]-curr[0],dy1=prev[1]-curr[1];
    const dx2=next[0]-curr[0],dy2=next[1]-curr[1];
    const len1=M.sqrt(dx1*dx1+dy1*dy1),len2=M.sqrt(dx2*dx2+dy2*dy2);
    if(len1<.001||len2<.001){out.push(curr);continue;}
    const maxOff=M.min(len1,len2)*.49*rf;
    const p1=[curr[0]+dx1/len1*maxOff,curr[1]+dy1/len1*maxOff];
    const p2=[curr[0]+dx2/len2*maxOff,curr[1]+dy2/len2*maxOff];
    for(let s=0;s<=ARC_SEGS;s++){
      const t=s/ARC_SEGS,u=1-t;
      out.push([u*u*p1[0]+2*u*t*curr[0]+t*t*p2[0],u*u*p1[1]+2*u*t*curr[1]+t*t*p2[1]]);
    }
  }
  return out;
}

// ── HYPERBOLIC ARC (V33) ──────────────────────────────────────────────────────
// Creates Poincaré-disk-style inward-bowing arc between two points.
// cx,cy=triangle center. depth=bow amount. Returns array of [x,y] points.
function hypArc(ax,ay,bx,by,cx,cy,depth,segs=8){
  const pts=[],mx=(ax+bx)/2,my=(ay+by)/2;
  const dx=cx-mx,dy=cy-my,len=M.sqrt(dx*dx+dy*dy)||1;
  const edgeLen=M.sqrt((bx-ax)**2+(by-ay)**2);
  const bow=edgeLen*depth*.3,nx=dx/len*bow,ny=dy/len*bow;
  const cpx=mx+nx,cpy=my+ny;
  for(let i=0;i<=segs;i++){
    const t=i/segs,u=1-t;
    pts.push([u*u*ax+2*u*t*cpx+t*t*bx,u*u*ay+2*u*t*cpy+t*t*by]);
  }
  return pts;
}

// ── CHAR PATTERN ──────────────────────────────────────────────────────────────
function mkCharShapes(ch,b,sc,st,mg,an,oX,oY){
  // V34 FIX-C5: 48px canvas (was 14) with bold sans-serif for crisp emoji/text
  const PS=48,u0=b.minU+mg,u1=b.maxU-mg,v0=b.minV+mg,v1=b.maxV-mg;
  if(u1<=u0||v1<=v0)return[];
  const cv=document.createElement('canvas');cv.width=cv.height=PS;
  const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.font=`bold ${M.floor(PS*.78)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ch||'★',PS/2,PS/2);
  const img=ctx.getImageData(0,0,PS,PS).data;
  const ext=.5,eu0=u0-(u1-u0)*ext,eu1=u1+(u1-u0)*ext,ev0=v0-(v1-v0)*ext,ev1=v1+(v1-v0)*ext;
  const ps=sc/PS,hs=M.max(.05,ps*.48-st*.04),rd=an*M.PI/180,cA=M.cos(rd),sA=M.sin(rd),cu=(u0+u1)/2,cv2=(v0+v1)/2;
  const P=[];
  for(let ry=M.floor(ev0/sc)-1;ry*sc<ev1+sc;ry++){for(let rx=M.floor(eu0/sc)-1;rx*sc<eu1+sc;rx++){
    for(let py=0;py<PS;py++){for(let px=0;px<PS;px++){
      if(img[(py*PS+px)*4+3]>100){
        let x=(rx+(px+.5)/PS)*sc+oX,y=(ry+(py+.5)/PS)*sc+oY;
        if(an!==0){const dx=x-cu,dy=y-cv2;x=cu+dx*cA-dy*sA;y=cv2+dx*sA+dy*cA;}
        const sh=tSh(clp([[x-hs,y-hs],[x+hs,y-hs],[x+hs,y+hs],[x-hs,y+hs]],u0,u1,v0,v1));if(sh)P.push(sh);
      }
    }}
  }}
  return P;
}

// ── PATTERN FOUNDRY (V33: +hyperbolic tri, corner rounding) ──────────────────
const Fnd={
  mk(type,b,sc,st,mg,an,oX,oY,stg,stgH,dn,excl=[],crnR=0){
    if(type==='char')return mkCharShapes($('EC').value||'★',b,sc,st,mg,an,oX,oY);
    const effSc=sc/dn;const rf=crnR/100; // corner radius factor 0–1
    const u0=b.minU+mg,u1=b.maxU-mg,v0=b.minV+mg,v1=b.maxV-mg;if(u1<=u0||v1<=v0)return[];
    const cu=(u0+u1)/2,cv=(v0+v1)/2,ext=.6;
    const eu0=u0-(u1-u0)*ext,eu1=u1+(u1-u0)*ext,ev0=v0-(v1-v0)*ext,ev1=v1+(v1-v0)*ext;
    const buf=effSc*.55;
    let P=[];
    if(type==='voronoi'){
      const seeds=[],minD=effSc*(1-M.min(.9,st/effSc));
      let rng=(M.round(effSc*7+mg*3))^0x5f3759df;const lcg=()=>{rng=(rng*1664525+1013904223)|0;return(rng>>>0)/0xFFFFFFFF;};
      for(let i=0;i<2000&&seeds.length<200;i++){const tx=eu0+(eu1-eu0)*lcg(),ty=ev0+(ev1-ev0)*lcg();let ok=true;for(const s of seeds)if((tx-s[0])**2+(ty-s[1])**2<minD*minD){ok=false;break;}if(ok)seeds.push([tx,ty]);}
      const bbox=[[eu0-effSc,ev0-effSc],[eu1+effSc,ev0-effSc],[eu1+effSc,ev1+effSc],[eu0-effSc,ev1+effSc]];
      for(let i=0;i<seeds.length;i++){
        let cell=bbox.slice();const[sx,sy]=seeds[i];
        for(let j=0;j<seeds.length;j++){if(i===j)continue;const[ox,oy]=seeds[j];cell=hpClip(cell,(sx+ox)/2,(sy+oy)/2,sx-ox,sy-oy);if(!cell)break;}
        if(!cell||cell.length<3)continue;
        const cxc=cell.reduce((s,p)=>s+p[0],0)/cell.length,cyc=cell.reduce((s,p)=>s+p[1],0)/cell.length;
        P.push(cell.map(([x,y])=>{const dx=x-cxc,dy=y-cyc,d=M.sqrt(dx*dx+dy*dy),sf=M.max(0,d-st)/M.max(d,.001);return[cxc+dx*sf,cyc+dy*sf];}));
      }
    }
    // ── HYPERBOLIC TRIANGLES (V33): curved inward edges via Poincaré-disk arcs ──
    else if(type==='hypTri'){
      const h=effSc*.866,ri=M.max(.05,effSc*.45-st*.65);
      const bowDepth=M.min(1,st/effSc*2+.3);
      for(let rw=M.floor(ev0/h)-1;rw*h<ev1+h;rw++){
        const isOdd=rw&1,xOff=isOdd?(effSc*.5+stg*effSc*.5):(stgH*effSc*.5);
        for(let cl=M.floor((eu0-xOff)/effSc)-1;cl*effSc+xOff<eu1+effSc;cl++){
          const cx=cl*effSc+xOff,cy=rw*h;
          let verts;
          if(isOdd)verts=[[cx-ri,cy-ri*.577],[cx+ri,cy-ri*.577],[cx,cy+ri*1.155]];
          else verts=[[cx,cy-ri*1.155],[cx-ri,cy+ri*.577],[cx+ri,cy+ri*.577]];
          const curved=[];
          for(let k=0;k<3;k++){
            const a=verts[k],b=verts[(k+1)%3];
            const arc=hypArc(a[0],a[1],b[0],b[1],cx,cy,bowDepth,8);
            for(let s=0;s<arc.length-1;s++)curved.push(arc[s]);
          }
          P.push(curved);
        }
      }
    }
    else if(type==='hex'){const r=effSc*.5,ri=M.max(.05,r-st*1.15),rh=r*1.73;for(let rw=M.floor(ev0/rh)-1;rw*rh<ev1+rh;rw++){const cy=rw*rh,xO=(rw&1)?(r+stg*effSc*.5):(stgH*effSc*.5);for(let cl=M.floor((eu0-xO)/effSc)-1;cl*effSc+xO<eu1+effSc;cl++){const cx=cl*effSc+xO,p=[];for(let k=0;k<6;k++)p.push([cx+ri*M.cos(k*M.PI/3),cy+ri*M.sin(k*M.PI/3)]);P.push(p);}}}
    else if(type==='sq'){const hs=M.max(.01,st*.5);for(let v=M.floor(ev0/effSc);v*effSc<ev1;v++){const off=(v&1?stg*effSc*.5:0)+(stgH*effSc*.5);for(let u=M.floor((eu0-off)/effSc);u*effSc+off<eu1;u++){const cx=u*effSc+off,cy=v*effSc;P.push([[cx+hs,cy+hs],[cx+effSc-hs,cy+hs],[cx+effSc-hs,cy+effSc-hs],[cx+hs,cy+effSc-hs]]);}}}
    else if(type==='brick'){const bh=effSc*.4,hs=M.max(.01,st*.5);for(let rw=M.floor(ev0/bh)-1;rw*bh<ev1+bh;rw++){const xX=(rw&1)*(effSc*.5+stg*effSc*.25)+(stgH*effSc*.25);for(let cl=M.floor((eu0-xX)/effSc)-1;cl*effSc+xX<eu1+effSc;cl++)P.push([[cl*effSc+xX+hs,rw*bh+hs],[(cl+1)*effSc+xX-hs,rw*bh+hs],[(cl+1)*effSc+xX-hs,(rw+1)*bh-hs],[cl*effSc+xX+hs,(rw+1)*bh-hs]]);}}
    else if(type==='diamond'){const rs=M.max(.05,effSc*.7-st);for(let v=M.floor(ev0/effSc)-1;v*effSc<ev1+effSc;v++){const off=(v&1?stg*effSc*.5:0)+(stgH*effSc*.5);for(let u=M.floor((eu0-off)/effSc)-1;u*effSc+off<eu1+effSc;u++){const cx=u*effSc+(v&1?effSc*.5:0)+off,cy=v*effSc*.5;P.push([[cx,cy-rs],[cx+rs,cy],[cx,cy+rs],[cx-rs,cy]]);}}}
    else if(type==='tri'){
      const h=effSc*.866,ri=M.max(.05,effSc*.45-st*.65);
      for(let rw=M.floor(ev0/h)-1;rw*h<ev1+h;rw++){
        const isOdd=rw&1,xOff=isOdd?(effSc*.5+stg*effSc*.5):(stgH*effSc*.5);
        for(let cl=M.floor((eu0-xOff)/effSc)-1;cl*effSc+xOff<eu1+effSc;cl++){
          const cx=cl*effSc+xOff,cy=rw*h;
          if(isOdd)P.push([[cx-ri,cy-ri*.577],[cx+ri,cy-ri*.577],[cx,cy+ri*1.155]]);
          else P.push([[cx,cy-ri*1.155],[cx-ri,cy+ri*.577],[cx+ri,cy+ri*.577]]);
        }
      }
    }
    else if(type==='moroccan'){const r=M.max(.05,effSc*.44-st*.5);for(let v=M.floor(ev0/effSc)-1;v*effSc<ev1+effSc;v++){const off=(v&1?stg*effSc*.5:0)+(stgH*effSc*.5);for(let u=M.floor((eu0-off)/effSc)-1;u*effSc+off<eu1+effSc;u++){const cx=u*effSc+off,cy=v*effSc,p=[];for(let k=0;k<8;k++)p.push([cx+r*M.cos(k*M.PI/4+M.PI/8),cy+r*M.sin(k*M.PI/4+M.PI/8)]);P.push(p);}}}
    else if(type==='herringbone'){const bw=effSc*.5,bh=effSc,hs=M.max(.01,st*.5);for(let rw=M.floor(ev0/bh)-2;rw*bh<ev1+bh;rw++){const off=(rw&1?stg*effSc*.5:0)+(stgH*effSc*.25);for(let cl=M.floor((eu0-off)/bw)-2;cl*bw+off<eu1+bw;cl++){const x0=cl*bw+hs+off,y0=rw*bh+hs;if((rw+cl)&1)P.push([[x0,y0],[x0+bh-st,y0],[x0+bh-st,y0+bw-st],[x0,y0+bw-st]]);else P.push([[x0,y0],[x0+bw-st,y0],[x0+bw-st,y0+bh-st],[x0,y0+bh-st]]);}}}
    else if(type==='circuit'){const tw=M.max(.05,st*.8),pd=effSc*.32;for(let v=M.floor(ev0/effSc)-1;v*effSc<ev1+effSc;v++){const off=(v&1?stg*effSc*.5:0)+(stgH*effSc*.5);for(let u=M.floor((eu0-off)/effSc)-1;u*effSc+off<eu1+effSc;u++){const cx=u*effSc+off,cy=v*effSc;P.push([[cx-pd,cy-pd],[cx+pd,cy-pd],[cx+pd,cy+pd],[cx-pd,cy+pd]]);if((u+v*3)%4!==0)P.push([[cx+pd,cy-tw],[cx+effSc*.5,cy-tw],[cx+effSc*.5,cy+tw],[cx+pd,cy+tw]]);if((u*2+v)%3!==0)P.push([[cx-tw,cy+pd],[cx-tw,cy+effSc*.5],[cx+tw,cy+effSc*.5],[cx+tw,cy+pd]]);}}}
    else if(type==='islamic'){const r=M.max(.05,effSc*.44-st*.5),r2=r*.41;for(let v=M.floor(ev0/effSc)-1;v*effSc<ev1+effSc;v++){const off=(v&1?stg*effSc*.5:0)+(stgH*effSc*.5);for(let u=M.floor((eu0-off)/effSc)-1;u*effSc+off<eu1+effSc;u++){const cx=u*effSc+off,cy=v*effSc,p=[];for(let k=0;k<8;k++){p.push([cx+r*M.cos(k*M.PI/4),cy+r*M.sin(k*M.PI/4)]);p.push([cx+r2*M.cos(k*M.PI/4+M.PI/8),cy+r2*M.sin(k*M.PI/4+M.PI/8)]);}P.push(p);}}}

    const rd=an*M.PI/180,cA=M.cos(rd),sA=M.sin(rd),O=[];
    for(let p of P){
      if(!p||p.length<3)continue;
      // V33: Apply corner rounding (skip for hypTri which has its own curves)
      if(rf>0&&type!=='hypTri')p=cornerRound(p,rf);
      p=p.map(([x,y])=>[x+oX,y+oY]);
      if(an!==0)p=p.map(([x,y])=>{const dx=x-cu,dy=y-cv;return[cu+dx*cA-dy*sA,cv+dx*sA+dy*cA];});
      // FIX-4: check ALL vertices against exclusion zones + half-cell buffer
      if(excl.length){
        const rx=p.reduce((s,q)=>s+q[0],0)/p.length-oX,ry=p.reduce((s,q)=>s+q[1],0)/p.length-oY;
        if(excl.some(z=>rx>=z.u0-buf&&rx<=z.u1+buf&&ry>=z.v0-buf&&ry<=z.v1+buf))continue;
        if(p.some(([px,py])=>excl.some(z=>(px-oX)>=z.u0&&(px-oX)<=z.u1&&(py-oY)>=z.v0&&(py-oY)<=z.v1)))continue;
      }
      const sh=tSh(clp(p,u0,u1,v0,v1));if(sh)O.push(sh);
    }
    return O;
  }
};

export { Fnd };
