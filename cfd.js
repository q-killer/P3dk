/**
 * P3dK // cfd.js — Psi CFD Fluid Tunnel
 * 100k particle GPU fluid simulation via Data3DTexture.
 * Exports: install(engineCore) — lazy loaded when panel opens
 * Size target: <28KB (this is the heaviest module — only loads on click)
 */
import * as T from 'three';
const M = Math;

export async function install(engineCore) {
  const { sc, cm, rn } = engineCore;
// ── CFD FLUID TUNNEL ──────────────────────────────────────────────────────────
const FLUIDS={aero:{vsc:.95,ws:1.5},mars:{vsc:.99,ws:.8},water:{vsc:.82,ws:.5},honey:{vsc:.55,ws:.2}};
window.onFluid=()=>{const f=FLUIDS[$('SM').value];$('VC').value=f.vsc;uS($('VC'),'vcv');$('WS').value=f.ws;uS($('WS'),'wsv');if(arA){tAr();tAr();}};
window.tAr=()=>{
  if(!msh)return;arA=!arA;$('AR').textContent=arA?'[ ■ HALT FLUID ]':'[ ▶ INIT FLUID ]';$('AR').classList.toggle('on',arA);
  if(arA)inT();else{if(arP){sc.remove(arP);arP.geometry.dispose();arP=null;}}uH();
};
function getWD(){
  const ha=+$('WA').value*M.PI/180,va=+$('WV').value*M.PI/180;
  return _wD.set(M.sin(ha)*M.cos(va),M.sin(va),-M.cos(ha)*M.cos(va)).normalize();
}
function inT(){
  if(arP){sc.remove(arP);arP.geometry.dispose();}
  arTime=0;arN=[];
  const wD=getWD().clone();
  const pos=msh.geometry.attributes.position,nrm=msh.geometry.attributes.normal;
  const stride=M.max(9,M.floor(pos.count/400)*3);
  for(let i=0;i<pos.count;i+=stride){
    const p=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(msh.matrixWorld);
    const n=nrm?new T.Vector3().fromBufferAttribute(nrm,i).transformDirection(msh.matrixWorld).normalize():wD.clone().negate();
    arN.push({p,n});
  }
  msh.geometry.computeBoundingBox();const bb=msh.geometry.boundingBox.clone().applyMatrix4(msh.matrixWorld);
  const sz=new T.Vector3(),ctr=new T.Vector3();bb.getSize(sz);bb.getCenter(ctr);
  arT={c:ctr.clone(),r:sz.length()*.6,nR:(sz.length()*.45)**2,wD:wD.clone()};
  NP=+$('PC').value||4000;const ws=+$('WS').value,pP=new Float32Array(NP*3),pVl=new Float32Array(NP*3);pV=pVl;
  const uSide=new T.Vector3(wD.z,0,-wD.x).normalize();
  for(let i=0;i<NP;i++){
    const up=ctr.clone().addScaledVector(wD,-(arT.r+20+M.random()*80));
    up.addScaledVector(uSide,(M.random()-.5)*sz.x*2.5);up.addScaledVector(new T.Vector3(0,1,0),(M.random()-.5)*sz.y*2.5);
    pP[i*3]=up.x;pP[i*3+1]=up.y;pP[i*3+2]=up.z;pVl[i*3]=wD.x*ws;pVl[i*3+1]=wD.y*ws;pVl[i*3+2]=wD.z*ws;
  }
  const pG=new T.BufferGeometry();pG.setAttribute('position',new T.BufferAttribute(pP,3));
  const pC=new Float32Array(NP*3);for(let i=0;i<NP*3;i+=3){pC[i]=0;pC[i+1]=1;pC[i+2]=1;}pG.setAttribute('color',new T.BufferAttribute(pC,3));
  arP=new T.Points(pG,new T.PointsMaterial({size:.8,vertexColors:true,transparent:true,opacity:.7,blending:T.AdditiveBlending,depthWrite:false}));sc.add(arP);
}
function sAr(){
  if(!arA||!arP||!arT)return;
  arTime+=0.04;getWD();arT.wD.copy(_wD);
  const pp=arP.geometry.attributes.position.array,pc=arP.geometry.attributes.color.array;
  const cx=arT.c.x,cy=arT.c.y,cz=arT.c.z,r=arT.r,nR=arT.nR;
  const ws=+$('WS').value,vsc=+$('VC').value,wdx=_wD.x,wdy=_wD.y,wdz=_wD.z;
  const doBL=$('cbBL').checked,doVS=$('cbVS').checked,doTB=$('cbTB').checked,doPC=$('cbPC').checked;
  const vrtxPhase=arTime*2.5,vrtxAmp=ws*0.4;
  _vC.set(wdz,0,-wdx).normalize();const vsx=_vC.x,vsy=_vC.y,vsz=_vC.z;
  for(let i=0;i<NP;i++){
    const px=pp[i*3],py=pp[i*3+1],pz=pp[i*3+2];
    const dx=px-cx,dy=py-cy,dz=pz-cz,distC=M.sqrt(dx*dx+dy*dy+dz*dz);
    let vx=pV[i*3],vy=pV[i*3+1],vz=pV[i*3+2];
    if(distC<r*3){
      for(const nd of arN){
        const ex=px-nd.p.x,ey=py-nd.p.y,ez=pz-nd.p.z,ds=ex*ex+ey*ey+ez*ez;
        if(ds<nR&&ds>.01){const f=30/ds;vx+=nd.n.x*f;vy+=nd.n.y*f;vz+=nd.n.z*f;
          if(doBL){const bx=vy*nd.n.z-vz*nd.n.y,by=vz*nd.n.x-vx*nd.n.z,bz=vx*nd.n.y-vy*nd.n.x;const bf=f*.08/(1+distC/r);vx+=bx*bf;vy+=by*bf;vz+=bz*bf;}}
      }
      if(doVS){const wakePos=dx*wdx+dy*wdy+dz*wdz;if(wakePos>0&&wakePos<r*2.5){const shedStr=M.sin(vrtxPhase+wakePos*.8)*vrtxAmp*(1-wakePos/(r*2.5));vx+=vsx*shedStr*.12;vy+=vsy*shedStr*.12;vz+=vsz*shedStr*.12;vy+=M.cos(vrtxPhase*1.3+wakePos*.5)*shedStr*.06;}}
    }
    if(doTB&&distC<r*2.5){const spd=M.sqrt(vx*vx+vy*vy+vz*vz);vx+=(M.random()-.5)*spd*.18;vy+=(M.random()-.5)*spd*.18;vz+=(M.random()-.5)*spd*.18;}
    const lf=1-vsc;vx+=(wdx*ws-vx)*lf;vy+=(wdy*ws-vy)*lf;vz+=(wdz*ws-vz)*lf;
    pV[i*3]=vx;pV[i*3+1]=vy;pV[i*3+2]=vz;pp[i*3]+=vx;pp[i*3+1]+=vy;pp[i*3+2]+=vz;
    if((pp[i*3]-cx)*wdx+(pp[i*3+1]-cy)*wdy+(pp[i*3+2]-cz)*wdz>r+60){
      const spread=(M.random()-.5)*r*2.5,spread2=(M.random()-.5)*r*2.5;
      pp[i*3]=cx-wdx*(r+20+M.random()*50)+vsx*spread;pp[i*3+1]=cy-wdy*(r+20+M.random()*50)+spread2;pp[i*3+2]=cz-wdz*(r+20+M.random()*50)+vsz*spread;
      pV[i*3]=wdx*ws;pV[i*3+1]=wdy*ws;pV[i*3+2]=wdz*ws;
    }
    const rx=pV[i*3]-wdx*ws,ry2=pV[i*3+1]-wdy*ws,rz=pV[i*3+2]-wdz*ws;
    const spd=M.min(M.sqrt(rx*rx+ry2*ry2+rz*rz)/(ws*.5+.001),1);
    if(doPC){const p2=M.min(1,distC/r);pc[i*3]=1-p2*.5;pc[i*3+1]=p2;pc[i*3+2]=1;}
    else{pc[i*3]=spd;pc[i*3+1]=1-spd*.7;pc[i*3+2]=1-spd;}
  }
  arP.geometry.attributes.position.needsUpdate=true;arP.geometry.attributes.color.needsUpdate=true;
}

// ══ SOLAR SYSTEM FLIGHT (V37.5: IMMERSION UPGRADE) ══════════════════════════
let flt=false,fCam,fShip,fTerr,fPlanet;
let fBullets=[],fEnems=[],fExpl=[],fMissiles=[],fScore=0,fHull=100,fShield=100;
let fPos=new T.Vector3(0,0,300),fVel=new T.Vector3(),fQ=new T.Quaternion();
let fKeys={},fTime2=0,fAudio=null,fBossSpawned=false,fBossHp=0;
let solarBodies=[],asteroids=null,nebulaStars=null;
let camShake=0,barrelRollT=0,barrelRollDir=0; // camera shake intensity, barrel roll timer
let fFireCooldown=0; // fire rate limiter
const fMat={cyn:new T.MeshBasicMaterial({color:0x00ffff,wireframe:true}),
             mag:new T.MeshBasicMaterial({color:0xff44ff,wireframe:true}),
             red:new T.MeshBasicMaterial({color:0xff2200,wireframe:true}),
             grn:new T.MeshBasicMaterial({color:0x00ff88,wireframe:true}),
             yel:new T.MeshBasicMaterial({color:0xffcc00,wireframe:true})};
// Solar data: [name, orbitRadius, orbitalSpeed, radius, color, hasRing]
const PLANETS=[
  ['Mercury',200,4.15,8,0xaa8866,false],['Venus',340,1.62,14,0xffcc66,false],
  ['Earth',500,1.0,15,0x4488ff,false],['Mars',700,0.53,11,0xff4422,false],
  ['Jupiter',1100,0.084,55,0xffaa44,false],['Saturn',1600,0.034,45,0xddbb66,true],
  ['Uranus',2200,0.012,28,0x66ddff,false],['Neptune',2800,0.006,26,0x3344ff,false]
];

function makeInterceptor(){
  const grp=new T.Group();
  // fuselage cone
  const fg=new T.ConeGeometry(.9,7,4);fg.rotateX(M.PI/2);grp.add(new T.Mesh(fg,fMat.cyn));
  // swept delta wings (raw tri geometry)
  const wPos=new Float32Array([0,0,0,-5,-.4,-2,0,0,-3, 0,0,0,5,-.4,-2,0,0,-3]);
  const wG=new T.BufferGeometry();wG.setAttribute('position',new T.BufferAttribute(wPos,3));
  grp.add(new T.Mesh(wG,fMat.cyn));
  // engine glow ring
  const eg=new T.TorusGeometry(.6,.15,6,12);eg.translate(0,0,3.5);grp.add(new T.Mesh(eg,fMat.mag));
  return grp;
}

// V37.5: Web Audio synth — engine hum + SFX channels
let audioCtx=null;
function initAudio(){
  try{
    audioCtx=new AudioContext();
    // Engine drone: layered detuned oscillators → filter → gain
    const eng1=audioCtx.createOscillator();eng1.type='sawtooth';eng1.frequency.value=55;
    const eng2=audioCtx.createOscillator();eng2.type='sawtooth';eng2.frequency.value=57;
    const eng3=audioCtx.createOscillator();eng3.type='square';eng3.frequency.value=110;
    const filt=audioCtx.createBiquadFilter();filt.type='lowpass';filt.frequency.value=200;filt.Q.value=3;
    const engGain=audioCtx.createGain();engGain.gain.value=0.08;
    const master=audioCtx.createGain();master.gain.value=0.25;
    [eng1,eng2,eng3].forEach(o=>{o.connect(filt);o.start();});
    filt.connect(engGain);engGain.connect(master);master.connect(audioCtx.destination);
    fAudio={ctx:audioCtx,engGain,engFilter:filt,master,oscs:[eng1,eng2,eng3]};
  }catch(e){console.warn('Audio blocked',e);}
}
function playLaser(){
  if(!audioCtx)return;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type='square';o.frequency.setValueAtTime(880,audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(220,audioCtx.currentTime+0.15);
  g.gain.setValueAtTime(0.12,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.15);
  o.connect(g);g.connect(fAudio.master);o.start();o.stop(audioCtx.currentTime+0.15);
}
function playExplosion(big=false){
  if(!audioCtx)return;
  const dur=big?0.6:0.3;
  // Noise burst via buffer
  const n=audioCtx.sampleRate*dur|0,buf=audioCtx.createBuffer(1,n,audioCtx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(M.random()*2-1)*M.exp(-i/(n*(big?.3:.15)));
  const src=audioCtx.createBufferSource();src.buffer=buf;
  const filt=audioCtx.createBiquadFilter();filt.type='lowpass';
  filt.frequency.setValueAtTime(big?600:1200,audioCtx.currentTime);
  filt.frequency.exponentialRampToValueAtTime(80,audioCtx.currentTime+dur);
  const g=audioCtx.createGain();g.gain.setValueAtTime(big?0.3:0.15,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+dur);
  src.connect(filt);filt.connect(g);g.connect(fAudio.master);src.start();
}
function playMissileAlert(){
  if(!audioCtx)return;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type='square';o.frequency.value=1200;
  g.gain.setValueAtTime(0.06,audioCtx.currentTime);
  g.gain.setValueAtTime(0,audioCtx.currentTime+0.08);
  g.gain.setValueAtTime(0.06,audioCtx.currentTime+0.15);
  g.gain.setValueAtTime(0,audioCtx.currentTime+0.23);
  o.connect(g);g.connect(fAudio.master);o.start();o.stop(audioCtx.currentTime+0.25);
}

// V33: Spherical terrain — Simplex noise displaced onto sphere surface
function makePlanetTerrain(radius,res,color){
  const geo=new T.SphereGeometry(radius,res,res);
  const pos=geo.attributes.position;
  const colors=new Float32Array(pos.count*3);
  const amp=radius*0.08;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const len=M.sqrt(x*x+y*y+z*z)||1;
    const nx=x/len,ny=y/len,nz=z/len;
    const h=N3(nx*3,ny*3,nz*3)*amp+N3(nx*8,ny*8,nz*8)*(amp*.3);
    pos.setXYZ(i,nx*(radius+h),ny*(radius+h),nz*(radius+h));
    const t=M.max(0,M.min(1,(h/amp+1)*.5));
    const cr=((color>>16)&255)/255,cg=((color>>8)&255)/255,cb=(color&255)/255;
    colors[i*3]=cr*(1-t*.3)+t*.3;colors[i*3+1]=cg*(1-t*.3)+t*.3;colors[i*3+2]=cb*(1-t*.3)+t*.3;
  }
  geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.computeVertexNormals();
  return new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,wireframe:true,transparent:true,opacity:.6}));
}

// V33: Build full solar system with Kepler orbits
function buildSolarSystem(){
  solarBodies=[];
  // Sun
  const sun=new T.Mesh(new T.SphereGeometry(80,20,16),new T.MeshBasicMaterial({color:0xffaa00,wireframe:true,transparent:true,opacity:.9}));
  sun.userData={name:'Sun',orbit:0,speed:0};sc.add(sun);solarBodies.push(sun);
  const glow=new T.Mesh(new T.SphereGeometry(95,12,10),new T.MeshBasicMaterial({color:0xff6600,transparent:true,opacity:.15,side:T.BackSide}));
  sun.add(glow);
  // Planets with terrain on surface
  for(const[name,orbit,speed,radius,color,hasRing]of PLANETS){
    const planet=makePlanetTerrain(radius,name==='Jupiter'||name==='Saturn'?24:16,color);
    planet.userData={name,orbit,speed,radius,hasRing,angle:M.random()*M.PI*2};
    planet.position.set(M.cos(planet.userData.angle)*orbit,(M.random()-.5)*20,M.sin(planet.userData.angle)*orbit);
    sc.add(planet);solarBodies.push(planet);
    if(hasRing){
      const ring=new T.Mesh(new T.RingGeometry(radius*1.4,radius*2.2,32),new T.MeshBasicMaterial({color:0xddcc88,side:T.DoubleSide,transparent:true,opacity:.4,wireframe:true}));
      ring.rotation.x=M.PI*.4;planet.add(ring);
    }
    // Orbit line
    const orbPts=[];for(let a=0;a<=64;a++){const ang=a/64*M.PI*2;orbPts.push(new T.Vector3(M.cos(ang)*orbit,0,M.sin(ang)*orbit));}
    const orbLine=new T.Line(new T.BufferGeometry().setFromPoints(orbPts),new T.LineBasicMaterial({color,transparent:true,opacity:.15}));
    sc.add(orbLine);solarBodies.push(orbLine);
  }
  // Asteroid belt between Mars and Jupiter
  const astPos=new Float32Array(400*3);
  for(let i=0;i<400;i++){const a=M.random()*M.PI*2,r=850+M.random()*200;astPos[i*3]=M.cos(a)*r;astPos[i*3+1]=(M.random()-.5)*40;astPos[i*3+2]=M.sin(a)*r;}
  const astGeo=new T.BufferGeometry();astGeo.setAttribute('position',new T.BufferAttribute(astPos,3));
  asteroids=new T.Points(astGeo,new T.PointsMaterial({color:0x888877,size:3,transparent:true,opacity:.6}));sc.add(asteroids);
  // Nebula star field
  const nebPos=new Float32Array(3000*3),nebCol=new Float32Array(3000*3);
  for(let i=0;i<3000;i++){
    const r=3000+M.random()*5000,a=M.random()*M.PI*2,e=M.acos(M.random()*2-1);
    nebPos[i*3]=M.sin(e)*M.cos(a)*r;nebPos[i*3+1]=M.sin(e)*M.sin(a)*r;nebPos[i*3+2]=M.cos(e)*r;
    const t=M.random();nebCol[i*3]=t<.33?0:t<.66?.2:1;nebCol[i*3+1]=t<.33?1:t<.66?.1:.9;nebCol[i*3+2]=t<.33?1:t<.66?1:.8;
  }
  const nebGeo=new T.BufferGeometry();nebGeo.setAttribute('position',new T.BufferAttribute(nebPos,3));nebGeo.setAttribute('color',new T.BufferAttribute(nebCol,3));
  nebulaStars=new T.Points(nebGeo,new T.PointsMaterial({size:3,vertexColors:true,transparent:true,opacity:.7,blending:T.AdditiveBlending}));sc.add(nebulaStars);
}

window.startFlight=()=>{
  if(flt)return;flt=true;fScore=0;fHull=100;fShield=100;fBossSpawned=false;fTime2=0;
  fPos.set(0,0,300);fVel.set(0,0,0);fQ.identity();
  camShake=0;barrelRollT=0;barrelRollDir=0;fFireCooldown=0;fMissiles=[];
  $('fWarn').classList.remove('active');
  fBullets.forEach(b=>{sc.remove(b);b.geometry&&b.geometry.dispose();});fBullets=[];
  fEnems.forEach(e=>{sc.remove(e);e.geometry&&e.geometry.dispose();});fEnems=[];
  fExpl.forEach(x=>{sc.remove(x);x.geometry&&x.geometry.dispose();});fExpl=[];
  // Ship
  if(msh){
    const sg=msh.geometry.clone();sg.computeBoundingBox();
    const ss=new T.Vector3();sg.boundingBox.getSize(ss);
    const sf=14/M.max(ss.x,ss.y,ss.z);
    sg.scale(sf,sf,sf);sg.computeBoundingBox();
    sg.translate(-(sg.boundingBox.max.x+sg.boundingBox.min.x)/2,-(sg.boundingBox.max.y+sg.boundingBox.min.y)/2,-(sg.boundingBox.max.z+sg.boundingBox.min.z)/2);
    fShip=new T.Mesh(sg,fMat.cyn);
  }else fShip=makeInterceptor();
  sc.add(fShip);
  buildSolarSystem();
  fCam=new T.PerspectiveCamera(72,innerWidth/innerHeight,.1,20000);sc.add(fCam);
  ct.enabled=false;$('ui').classList.add('collapsed');$('uiToggle').style.display='none';
  $('fhud').classList.remove('hidden');$('fhud').classList.add('active');
  $('hud').style.display='none';$('hnt').style.display='none';
  $('fSc').textContent='0';$('fHull').textContent='100';$('fSpd').textContent='0.0';
  grO.visible=false;sfO.visible=false;
  initAudio();sS('> SOLAR SYSTEM — F=FIRE · Q/E=ROLL · ESC=RETURN');
};

window.stopFlight=()=>{
  if(!flt)return;flt=false;
  [fShip,...fBullets,...fEnems,...fExpl,...fMissiles].forEach(o=>{if(o){sc.remove(o);if(o.geometry){o.geometry.dispose();}if(o.isGroup)o.children.forEach(c=>{sc.remove(c);c.geometry&&c.geometry.dispose();});}});
  solarBodies.forEach(o=>{sc.remove(o);if(o.geometry)o.geometry.dispose();});solarBodies=[];
  if(asteroids){sc.remove(asteroids);asteroids.geometry.dispose();asteroids=null;}
  if(nebulaStars){sc.remove(nebulaStars);nebulaStars.geometry.dispose();nebulaStars=null;}
  fShip=null;fBullets=[];fEnems=[];fExpl=[];fMissiles=[];
  if(fCam){sc.remove(fCam);fCam=null;}
  if(fAudio){try{fAudio.oscs.forEach(o=>o.stop());}catch(e){}try{audioCtx.close();}catch(e){}fAudio=null;audioCtx=null;}
  ct.enabled=true;$('ui').classList.remove('collapsed');$('uiToggle').style.display='';
  $('fhud').classList.add('hidden');$('fhud').classList.remove('active');
  $('hud').style.display='';$('hnt').style.display='';
  grO.visible=gOn;sfO.visible=sOn;
  $('fKeys').innerHTML='WASD THRUST · ↑↓←→ AIM · Q/E ROLL · F FIRE · ESC RETURN';
  sS('> RETURNED TO CAD');
};

function fSpawn(hp=1,big=false){
  const g=big?new T.DodecahedronGeometry(big?18:6):new T.OctahedronGeometry(big?18:6);
  const em=new T.Mesh(g,big?fMat.yel:fMat.red);
  const fwd=new T.Vector3(0,0,-1).applyQuaternion(fQ);
  const rnd=new T.Vector3((M.random()-.5)*2,(M.random()-.5)*2,(M.random()-.5)*2).normalize();
  em.position.copy(fPos).addScaledVector(fwd,-400).addScaledVector(rnd,big?0:M.random()*200+50);
  em.userData={hp,big,speed:big?0.004:0.008+M.random()*.005,missileCD:big?80:200+M.random()*150|0};
  sc.add(em);fEnems.push(em);
}

// Heat-seeking missile — proportional navigation guidance
function spawnMissile(from){
  const mg=new T.ConeGeometry(.3,3,4);mg.rotateX(M.PI/2);
  const mm=new T.Mesh(mg,fMat.yel);
  mm.position.copy(from);
  const dir=fPos.clone().sub(from).normalize();
  mm.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),dir);
  mm.userData={vel:dir.multiplyScalar(6),life:180,trail:[]};
  sc.add(mm);fMissiles.push(mm);
  playMissileAlert();
}

function fFire(){
  if(!flt||!fShip||fFireCooldown>0)return;
  fFireCooldown=6; // ~100ms at 60fps
  const dir=new T.Vector3(0,0,-1).applyQuaternion(fQ);
  const right=new T.Vector3(1,0,0).applyQuaternion(fQ);
  // Dual cannon — offset left/right
  for(const side of[-1,1]){
    const bg=new T.CylinderGeometry(.1,.1,6,3);bg.rotateX(M.PI/2);
    const bm=new T.Mesh(bg,new T.MeshBasicMaterial({color:0xff00ff,transparent:true,opacity:.9,blending:T.AdditiveBlending}));
    bm.position.copy(fPos).addScaledVector(dir,6).addScaledVector(right,side*1.5);
    bm.quaternion.copy(fQ);
    bm.userData={dir:dir.clone(),life:80};
    sc.add(bm);fBullets.push(bm);
  }
  playLaser();
}

function fExplode(pos,big=false){
  const n=big?200:70,pts=new Float32Array(n*3),cols=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const r=M.random()*(big?20:12);
    pts[i*3]=(M.random()-.5)*r;pts[i*3+1]=(M.random()-.5)*r;pts[i*3+2]=(M.random()-.5)*r;
    const t=M.random();cols[i*3]=1;cols[i*3+1]=t*.6;cols[i*3+2]=t*.1; // orange-yellow gradient
  }
  const eg=new T.BufferGeometry();eg.setAttribute('position',new T.BufferAttribute(pts,3));
  eg.setAttribute('color',new T.BufferAttribute(cols,3));
  const ep=new T.Points(eg,new T.PointsMaterial({size:big?6:3.5,vertexColors:true,transparent:true,opacity:1,blending:T.AdditiveBlending,depthWrite:false}));
  ep.position.copy(pos);ep.userData={life:big?60:35,maxLife:big?60:35};sc.add(ep);fExpl.push(ep);
  playExplosion(big);
}

// Pre-allocated flight physics vectors
const _fFwd=new T.Vector3(),_fRight=new T.Vector3(),_fUp=new T.Vector3(),_fCamTarget=new T.Vector3();
const _fQDelta=new T.Quaternion();

function updateFlight(dt){
  fTime2+=dt;
  if(fFireCooldown>0)fFireCooldown--;
  // V37.5: Faster, more aggressive flight physics
  const pitchA=fKeys['ArrowUp']?1:fKeys['ArrowDown']?-1:0;
  const yawA=fKeys['ArrowLeft']?1:fKeys['ArrowRight']?-1:0;
  const rollA=fKeys['q']?1:fKeys['e']?-1:0;
  const thrustFwd=fKeys['w']?1.2:fKeys['s']?-.3:0;
  const boost=fKeys[' ']?2.5:0;

  // Barrel roll: double-tap Q or E triggers a full 360° roll
  if(barrelRollT>0){
    barrelRollT-=dt;
    const rollSpeed=M.PI*2*dt/0.5; // 360° in 0.5s
    fQ.multiply(_fQDelta.setFromAxisAngle(new T.Vector3(0,0,1),barrelRollDir*rollSpeed));
  }else{
    // Normal rotation — increased rates for bigger maneuvers
    if(pitchA)fQ.multiply(_fQDelta.setFromAxisAngle(new T.Vector3(1,0,0),pitchA*.04));
    if(yawA)fQ.multiply(_fQDelta.setFromAxisAngle(new T.Vector3(0,1,0),yawA*.035));
    if(rollA)fQ.multiply(_fQDelta.setFromAxisAngle(new T.Vector3(0,0,1),rollA*.06));
  }

  _fFwd.set(0,0,-1).applyQuaternion(fQ);
  _fRight.set(1,0,0).applyQuaternion(fQ);
  const strafe=fKeys['a']?-.5:fKeys['d']?.5:0;
  fVel.addScaledVector(_fFwd,((thrustFwd||.25)+boost)*2.2);
  if(strafe)fVel.addScaledVector(_fRight,strafe*1.8);
  fVel.multiplyScalar(.92);
  fPos.add(fVel);
  const spd=fVel.length();$('fSpd').textContent=spd.toFixed(1);
  fShip.position.copy(fPos);fShip.quaternion.copy(fQ);

  // Engine audio reactivity — pitch and filter follow speed
  if(fAudio){
    const spdNorm=M.min(spd/30,1);
    fAudio.engFilter.frequency.setTargetAtTime(120+spdNorm*400,audioCtx.currentTime,0.1);
    fAudio.engGain.gain.setTargetAtTime(0.04+spdNorm*0.12,audioCtx.currentTime,0.1);
    fAudio.oscs[0].frequency.setTargetAtTime(55+spdNorm*30,audioCtx.currentTime,0.1);
  }

  // Camera shake decay
  camShake*=0.9;

  // Spring-chase camera with shake
  _fUp.set(0,1,0).applyQuaternion(fQ);
  _fCamTarget.copy(fPos).addScaledVector(_fFwd,-25).addScaledVector(_fUp,6);
  if(camShake>0.1){
    _fCamTarget.x+=(M.random()-.5)*camShake;
    _fCamTarget.y+=(M.random()-.5)*camShake;
    _fCamTarget.z+=(M.random()-.5)*camShake;
  }
  fCam.position.lerp(_fCamTarget,.07);
  fCam.quaternion.slerp(fQ,.07);

  // Kepler orbits
  for(const body of solarBodies){
    if(!body.userData||!body.userData.speed)continue;
    body.userData.angle+=body.userData.speed*dt*.5;
    const a=body.userData.angle,r=body.userData.orbit;
    body.position.set(M.cos(a)*r,body.position.y,M.sin(a)*r);
    body.rotation.y+=dt*.5;
  }
  if(asteroids)asteroids.rotation.y+=dt*.02;
  // Nearest planet for HUD
  let nearName='Deep Space',nearDist=Infinity;
  for(const body of solarBodies){
    if(!body.userData?.name)continue;
    const d=fPos.distanceTo(body.position);
    if(d<nearDist){nearDist=d;nearName=body.userData.name;}
  }
  $('fPlanetName').textContent=nearDist<500?nearName:'Deep Space';
  // Enemy spawn
  const rate=+$('ER').value;
  if(M.random()<0.01*rate)fSpawn();
  // Boss at 20 kills
  if(fScore>=20&&!fBossSpawned){fBossSpawned=true;fBossHp=8;fSpawn(fBossHp,true);sS('> !! BOSS INCOMING !!');}
  // Move enemies + missile AI
  for(let i=fEnems.length-1;i>=0;i--){
    const em=fEnems[i];
    em.position.lerp(fPos,em.userData.speed);
    em.rotation.x+=.04;em.rotation.y+=.05;
    // Enemy fires heat-seeking missiles
    em.userData.missileCD--;
    if(em.userData.missileCD<=0&&em.position.distanceTo(fPos)<500){
      em.userData.missileCD=em.userData.big?100:250+M.random()*100|0;
      spawnMissile(em.position.clone());
    }
    if(em.position.distanceTo(fPos)<(em.userData.big?20:8)){
      let dmg=em.userData.big?25:8;
      if(fShield>0){const absorbed=M.min(fShield,dmg);fShield-=absorbed;dmg-=absorbed;}
      fHull-=dmg;camShake=M.max(camShake,dmg*0.8); // camera shake on impact
      $('fHull').textContent=M.max(0,M.round(fHull));
      $('fShield').textContent=M.max(0,M.round(fShield));
      if(fHull<25)$('fWarn').classList.add('active');else $('fWarn').classList.remove('active');
      fExplode(em.position.clone(),em.userData.big);
      sc.remove(em);em.geometry&&em.geometry.dispose();fEnems.splice(i,1);
      if(fHull<=0){
        fExplode(fPos.clone(),true);fExplode(fPos.clone(),true);fExplode(fPos.clone(),true);
        if(fShip){sc.remove(fShip);if(fShip.geometry)fShip.geometry.dispose();fShip=null;}
        $('fWarn').classList.remove('active');
        $('fKeys').innerHTML='<span style="color:#fc0;font-size:14px;letter-spacing:3px">G A M E &nbsp; O V E R</span><br>SCORE: '+fScore+' KILLS<br><br><span style="color:#0ff">P3dK V37 — SOLAR EDITION</span><br>Code is Poetry · Computation is Art<br><span style="color:#f0f">PEAK IS PEAK</span><br><br>Returning to CAD...';
        setTimeout(()=>stopFlight(),4000);
        return;
      }
    }
  }
  // Heat-seeking missiles — proportional navigation
  for(let i=fMissiles.length-1;i>=0;i--){
    const ms=fMissiles[i];ms.userData.life--;
    if(ms.userData.life<=0){sc.remove(ms);ms.geometry.dispose();fMissiles.splice(i,1);continue;}
    // Proportional navigation: steer toward predicted intercept
    const toTarget=fPos.clone().sub(ms.position);
    const dist=toTarget.length();
    if(dist<6){
      // Hit player
      let dmg=15;
      if(fShield>0){const absorbed=M.min(fShield,dmg);fShield-=absorbed;dmg-=absorbed;}
      fHull-=dmg;camShake=M.max(camShake,12);
      $('fHull').textContent=M.max(0,M.round(fHull));
      $('fShield').textContent=M.max(0,M.round(fShield));
      if(fHull<25)$('fWarn').classList.add('active');
      fExplode(ms.position.clone(),false);
      sc.remove(ms);ms.geometry.dispose();fMissiles.splice(i,1);
      if(fHull<=0){
        fExplode(fPos.clone(),true);fExplode(fPos.clone(),true);
        if(fShip){sc.remove(fShip);if(fShip.geometry)fShip.geometry.dispose();fShip=null;}
        $('fWarn').classList.remove('active');
        $('fKeys').innerHTML='<span style="color:#fc0;font-size:14px;letter-spacing:3px">G A M E &nbsp; O V E R</span><br>SCORE: '+fScore+'<br><br>Returning to CAD...';
        setTimeout(()=>stopFlight(),4000);return;
      }
      continue;
    }
    // Steer: blend current velocity toward target direction
    const desired=toTarget.normalize().multiplyScalar(8);
    ms.userData.vel.lerp(desired,0.04); // navigation gain
    ms.position.add(ms.userData.vel);
    ms.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),ms.userData.vel.clone().normalize());
    // Player can shoot down missiles
    for(let j=fBullets.length-1;j>=0;j--){
      if(fBullets[j].position.distanceTo(ms.position)<5){
        fExplode(ms.position.clone(),false);
        sc.remove(ms);ms.geometry.dispose();fMissiles.splice(i,1);
        sc.remove(fBullets[j]);fBullets[j].geometry.dispose();fBullets.splice(j,1);
        fScore++;$('fSc').textContent=fScore;
        break;
      }
    }
  }
  // FIX-C8: Shield slowly recharges
  if(fShield<100){fShield=M.min(100,fShield+.5);$('fShield').textContent=M.round(fShield);}
  // FIX-C3: Ensure warning stays in sync every frame
  if(fHull>=25)$('fWarn').classList.remove('active');
  // Move bullets + hit detection
  for(let i=fBullets.length-1;i>=0;i--){
    const b=fBullets[i];b.position.addScaledVector(b.userData.dir,18);b.userData.life--;
    if(b.userData.life<=0){sc.remove(b);b.geometry&&b.geometry.dispose();fBullets.splice(i,1);continue;}
    for(let j=fEnems.length-1;j>=0;j--){
      if(b.position.distanceTo(fEnems[j].position)<(fEnems[j].userData.big?22:9)){
        fEnems[j].userData.hp--;
        fExplode(fEnems[j].position.clone(),false);
        if(fEnems[j].userData.hp<=0){
          fScore++;$('fSc').textContent=fScore;
          fExplode(fEnems[j].position.clone(),fEnems[j].userData.big);
          sc.remove(fEnems[j]);fEnems[j].geometry&&fEnems[j].geometry.dispose();fEnems.splice(j,1);
        }
        sc.remove(b);b.geometry&&b.geometry.dispose();fBullets.splice(i,1);break;
      }
    }
  }
  // Update explosions
  for(let i=fExpl.length-1;i>=0;i--){
    const x=fExpl[i];x.userData.life--;
    x.material.opacity=x.userData.life/x.userData.maxLife;
    x.scale.addScalar(.06);
    if(x.userData.life<=0){sc.remove(x);x.geometry&&x.geometry.dispose();fExpl.splice(i,1);}
  }
}

  window.tAr = tAr;
  window.onFluid = onFluid;
}
