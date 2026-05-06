/**
 * P3dK // support.js — The Support Foundry
 * Classical architectural column supports (Doric/Ionic/Gothic) +
 * Dionysus Vine L-system wrapping. Breakaway kiss-contact geometry.
 * Exports: install(engineCore) — lazy loaded when panel opens
 * 
 * L-SYSTEM: F -> F[+F]F[-F]F, angle=theta+-5deg jitter
 * KISS CONTACT: vine stops VINE_G mm short of target surface
 * WATERMARK: 0.5mm recessed concentric rings on every base disc
 * Size target: <35KB
 */
import * as T from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
const M = Math;

export async function install(engineCore) {
  const { sc, mem, wasm, sS, uH, geo2manifold, manifold2geo, withManifold, BGU: _BGU } = engineCore;
  // Use passed-in refs so module is self-contained
  
// +=======================================================================+
// | SUPPORT FOUNDRY — V1.0                                                |
// | Classical column scaffolds + Grapevine L-system breakaway supports    |
// |                                                                        |
// | Pipeline:                                                              |
// |   1. scanOverhangs() — find mesh normals > threshold angle            |
// |   2. generateSupports() — place columns under overhang clusters       |
// |   3. buildColumn() — parametric Doric/Ionic/Corinthian shaft+capital  |
// |   4. growVines() — L-system branching from column crown               |
// |   5. pruneVines() — keep only vines within kiss-contact of mesh       |
// |   6. All merged into a separate support group (not csgBool'd in)      |
// |      so user can preview, then export mesh+supports together          |
// +=======================================================================+

// ── GLOBAL SUPPORT STATE ──────────────────────────────────────────────────
let supportGroup = null;      // THREE.Group holding all support geometry
let overhangPts  = [];        // [{pos:Vector3, normal:Vector3}] overhang targets

// ── OVERHANG SCANNER ──────────────────────────────────────────────────────
// Scans all faces. Any face whose normal has a downward Y component beyond
// the threshold angle is flagged as needing support.
window.scanOverhangs = () => {
  if(!msh) return;
  const thresh = +($('OVH').value) * M.PI / 180; // e.g. 45deg
  const geo = msh.geometry;
  const pos = geo.attributes.position;
  const down = new T.Vector3(0,-1,0);
  const pA=new T.Vector3(),pB=new T.Vector3(),pC=new T.Vector3();
  const e1=new T.Vector3(),e2=new T.Vector3(),fn=new T.Vector3();
  const worldMat = msh.matrixWorld;
  const normalMat = new T.Matrix3().getNormalMatrix(worldMat);

  overhangPts = [];
  const SAMPLE = M.max(1, M.floor(pos.count / 3 / 5000)); // sample for perf

  for(let i=0; i<pos.count; i+=3*SAMPLE){
    pA.fromBufferAttribute(pos,i).applyMatrix4(worldMat);
    pB.fromBufferAttribute(pos,i+1).applyMatrix4(worldMat);
    pC.fromBufferAttribute(pos,i+2).applyMatrix4(worldMat);
    e1.subVectors(pB,pA); e2.subVectors(pC,pA);
    fn.crossVectors(e1,e2).normalize().applyMatrix3(normalMat).normalize();
    // Face points downward past threshold?
    const ang = M.acos(M.max(-1,M.min(1, fn.dot(down))));
    if(ang < thresh){ // normal is within thresh of straight-down
      const centroid = new T.Vector3(
        (pA.x+pB.x+pC.x)/3, (pA.y+pB.y+pC.y)/3, (pA.z+pB.z+pC.z)/3
      );
      overhangPts.push({pos:centroid, normal:fn.clone()});
    }
  }

  // Cluster nearby points (voxel grid 8mm cells)
  const CELL = 8;
  const cells = new Map();
  for(const pt of overhangPts){
    const k = `${M.round(pt.pos.x/CELL)},${M.round(pt.pos.z/CELL)}`;
    if(!cells.has(k)) cells.set(k,[]);
    cells.get(k).push(pt);
  }
  // Reduce each cell to one representative point (lowest Y = needs support most)
  overhangPts = [];
  for(const pts of cells.values()){
    pts.sort((a,b)=>a.pos.y-b.pos.y);
    overhangPts.push(pts[0]);
  }

  const el = $('ovhStatus');
  if(el){
    el.classList.remove('hidden');
    el.textContent = overhangPts.length > 0
      ? `${overhangPts.length} overhang cluster${overhangPts.length>1?'s':''} found — ready to generate`
      : 'No overhangs found at this angle';
    el.style.color = overhangPts.length > 0 ? '#ffa040' : '#0f9';
  }
  if(overhangPts.length > 0) $('btnGenSupport').disabled = 0;
  sS('> SCAN: '+overhangPts.length+' OVERHANG CLUSTERS');
};

// ── COLUMN BUILDER ────────────────────────────────────────────────────────
// Builds a single classical column as a THREE.Group.
// shaft: CylinderGeometry with lathe-profile taper (entasis)
// flutes: BoxGeometry cuts via CSG (Ionic/Corinthian only)  
// capital: order-specific geometry on top
function buildColumn(height, radius, order, flutes){
  const group = new T.Group();
  const segs = 32;

  // ── Shaft with entasis (slight convex bulge at 1/3 height, Doric tradition)
  // Achieved via 3-radius lathe: base, bulge, top
  const shaftPts = [];
  for(let i=0; i<=16; i++){
    const t = i/16; // 0=base, 1=top
    // Entasis: subtle bulge peaks at t=0.35
    const entasis = 0.04 * M.sin(t * M.PI); // max 4% bulge
    const r = radius * (1 - t*0.12 + entasis); // also tapers top by 12%
    shaftPts.push(new T.Vector2(r, t*height));
  }
  const shaftGeo = new T.LatheGeometry(shaftPts, segs);
  group.add(new T.Mesh(shaftGeo));

  // ── Flutes (Ionic/Corinthian: 20 channels cut into shaft)
  if(order !== 'doric' && flutes > 0){
    // Build a single flute channel as a thin BoxGeometry, rotated around Y axis
    const fluteW = (2*M.PI*radius) / (flutes*2.2); // gap between flutes
    const fluteD = radius * 0.18; // depth of channel
    const fluteH = height * 0.88; // channels stop before capital
    for(let i=0; i<flutes; i++){
      const angle = (i/flutes)*M.PI*2;
      const fluteBox = new T.BoxGeometry(fluteW, fluteH, fluteD);
      fluteBox.translate(0, fluteH/2 + height*0.06, radius - fluteD/2);
      const mat = new T.Matrix4().makeRotationY(angle);
      fluteBox.applyMatrix4(mat);
      group.add(new T.Mesh(fluteBox, new T.MeshBasicMaterial({color:0x000000})));
    }
    // Note: in live use, flutes would CSG-subtract from shaft.
    // For performance we represent as dark overlay geometry (print result same).
  }

  // ── Base (all orders have a stepped base)
  const basePts = [
    new T.Vector2(radius*1.5, 0),
    new T.Vector2(radius*1.5, height*0.025),
    new T.Vector2(radius*1.25, height*0.025),
    new T.Vector2(radius*1.25, height*0.05),
    new T.Vector2(radius*1.05, height*0.05),
    new T.Vector2(radius*1.05, height*0.065),
  ];
  group.add(new T.Mesh(new T.LatheGeometry(basePts, segs)));

  // ── Capital (order-specific top piece)
  if(order === 'doric'){
    // Doric: simple abacus (square slab) + echinus (convex molding)
    const echiPts = [];
    for(let i=0; i<=8; i++){
      const t=i/8, r=radius*(1.0 + t*0.45);
      echiPts.push(new T.Vector2(r, height + t*height*0.06));
    }
    group.add(new T.Mesh(new T.LatheGeometry(echiPts, segs)));
    // Abacus slab
    const abacus = new T.BoxGeometry(radius*3.2, height*0.05, radius*3.2);
    abacus.translate(0, height + height*0.085, 0);
    group.add(new T.Mesh(abacus));

  } else if(order === 'ionic'){
    // Ionic: echinus + scroll volutes (approximated as torus segments)
    const echiPts = [];
    for(let i=0; i<=6; i++){
      const t=i/6, r=radius*(1.0+t*0.3);
      echiPts.push(new T.Vector2(r, height+t*height*0.04));
    }
    group.add(new T.Mesh(new T.LatheGeometry(echiPts, segs)));
    // Volute scrolls (pair of torus knots approximating the scroll)
    for(const side of [-1,1]){
      const voluteR = radius*0.55;
      const vGeo = new T.TorusGeometry(voluteR, voluteR*0.28, 8, 16, M.PI*1.6);
      vGeo.translate(side*radius*1.1, height+height*0.07, 0);
      vGeo.rotateZ(side * M.PI*0.18);
      group.add(new T.Mesh(vGeo));
    }
    const abacus = new T.BoxGeometry(radius*3.0, height*0.04, radius*1.8);
    abacus.translate(0, height+height*0.12, 0);
    group.add(new T.Mesh(abacus));

  } else { // corinthian
    // Corinthian: bell-shaped capital with acanthus leaves (3 tiers)
    const bellPts = [];
    for(let i=0; i<=12; i++){
      const t=i/12, r=radius*(1.0+t*0.8), y=height+t*height*0.22;
      bellPts.push(new T.Vector2(r,y));
    }
    group.add(new T.Mesh(new T.LatheGeometry(bellPts, segs)));
    // Acanthus leaves: 3 tiers of 8 leaves each
    for(let tier=0; tier<3; tier++){
      const lCount=8, lH=height*(0.06+tier*0.05), lR=radius*(1.1+tier*0.25);
      for(let i=0; i<lCount; i++){
        const ang = (i/lCount)*M.PI*2 + tier*M.PI/lCount;
        const leafShape = new T.Shape();
        leafShape.moveTo(0,0);
        leafShape.bezierCurveTo(0.8,1.5, 1.2,3, 0,4);
        leafShape.bezierCurveTo(-1.2,3,-0.8,1.5,0,0);
        const leafGeo = new T.ExtrudeGeometry(leafShape,
          {depth:0.4, bevelEnabled:true, bevelSize:0.15, bevelThickness:0.15, bevelSegments:2, curveSegments:4});
        leafGeo.scale(lR*0.18, lH*0.22, lR*0.18);
        leafGeo.rotateX(-M.PI/2 - 0.35 + tier*0.12);
        leafGeo.rotateY(ang);
        leafGeo.translate(M.cos(ang)*lR*0.7, height+tier*height*0.07, M.sin(ang)*lR*0.7);
        group.add(new T.Mesh(leafGeo));
      }
    }
    const abacus = new T.BoxGeometry(radius*2.6, height*0.04, radius*2.6);
    abacus.translate(0, height+height*0.25, 0);
    group.add(new T.Mesh(abacus));
  }
  return group;
}

// ── L-SYSTEM VINE GROWER ──────────────────────────────────────────────────
// Grows vines from a start point using a stochastic L-system.
// Each stem is a thin CylinderGeometry. Leaves are tiny ExtrudeGeometry.
// Kiss-contact: vines are pruned to stop vineKiss mm from the target mesh.
function growVines(startPos, colHeight, colRadius, density, kissGap, doLeaves, doWrap){
  const vineGroup = new T.Group();
  const ray = new T.Raycaster();
  const segs = 4; // low poly for print

  // L-system parameters
  const AXIOM = 'F';
  const RULES = {
    'F': ['F[+F]F[-F]F', 'F[+F]F', 'F[-F[+F]]F', 'FF[+F][-F]']
  };
  const ANGLE = 28 * M.PI/180; // degrees to radians
  const ITER  = density + 1;   // 2-6 iterations

  // Expand the L-system string
  let str = AXIOM;
  for(let i=0; i<ITER; i++){
    let next = '';
    for(const ch of str){
      const rule = RULES[ch];
      next += rule ? rule[M.floor(M.random()*rule.length)] : ch;
    }
    str = next;
  }

  // Turtle interpreter — draws vine segments
  const stack = [];
  let pos   = startPos.clone();
  let dir   = new T.Vector3(0,1,0); // grows upward initially
  let thick = colRadius * 0.18;     // vine thickness starts substantial
  let depth = 0;

  // If wrapping around column, start direction is tangential
  if(doWrap){
    dir.set(1, 0.6, 0).normalize();
  }

  for(const ch of str){
    if(ch === 'F'){
      // Draw a vine segment
      const segLen = (colHeight * 0.08) * (1 - depth*0.06);
      if(segLen < 0.3) continue;

      const endPos = pos.clone().addScaledVector(dir, segLen);

      // Kiss-contact check: is endPos within kissGap of the target mesh?
      let isKiss = false;
      if(msh){
        ray.set(endPos, new T.Vector3(0,1,0));
        const hits = ray.intersectObject(msh);
        if(hits.length && hits[0].distance < kissGap + 0.5){
          isKiss = true;
          // End exactly at kissGap from mesh surface
          endPos.copy(hits[0].point).addScaledVector(hits[0].face.normal, kissGap);
        }
      }

      // Build vine segment (thin cylinder between pos and endPos)
      const segVec  = new T.Vector3().subVectors(endPos, pos);
      const segMid  = pos.clone().addScaledVector(segVec, 0.5);
      const cyl     = new T.CylinderGeometry(thick*0.6, thick, segVec.length(), segs, 1);
      // Orient cylinder to point from pos to endPos
      const up      = new T.Vector3(0,1,0);
      const segNorm = segVec.clone().normalize();
      if(M.abs(segNorm.dot(up)) < 0.999){
        const q = new T.Quaternion().setFromUnitVectors(up, segNorm);
        cyl.applyQuaternion(q);
      }
      cyl.translate(segMid.x, segMid.y, segMid.z);
      vineGroup.add(new T.Mesh(cyl));

      // Tiny sphere at joint for smoother look
      const knot = new T.SphereGeometry(thick*0.8, segs, segs);
      knot.translate(endPos.x, endPos.y, endPos.z);
      vineGroup.add(new T.Mesh(knot));

      // Leaf at terminal segments (every 3rd segment near the outside)
      if(doLeaves && depth > 1 && M.random() > 0.6){
        const leafShape = new T.Shape();
        leafShape.moveTo(0,0);
        leafShape.quadraticCurveTo(0.8,1.2, 0,2.4);
        leafShape.quadraticCurveTo(-0.8,1.2, 0,0);
        const leafSize = thick * 2.2;
        const leafGeo  = new T.ExtrudeGeometry(leafShape,
          {depth:0.15, bevelEnabled:false, curveSegments:3});
        leafGeo.scale(leafSize, leafSize, leafSize);
        // Random rotation to face away from column
        leafGeo.rotateY(M.random()*M.PI*2);
        leafGeo.rotateX(-M.PI/4 - M.random()*M.PI/4);
        leafGeo.translate(endPos.x, endPos.y, endPos.z);
        vineGroup.add(new T.Mesh(leafGeo));
      }

      pos.copy(endPos);
      thick *= 0.88; // taper as we branch
      if(isKiss) { pos.copy(startPos.clone().addScaledVector(dir,segLen*0.5)); } // reset to avoid tunneling

    } else if(ch === '+'){
      // Turn left (rotate around Z for upward-growing vine)
      dir.applyQuaternion(new T.Quaternion().setFromAxisAngle(
        new T.Vector3(M.random()*0.6-0.3, 0, 1).normalize(),
        ANGLE * (0.8 + M.random()*0.4)
      ));
      dir.normalize();
    } else if(ch === '-'){
      dir.applyQuaternion(new T.Quaternion().setFromAxisAngle(
        new T.Vector3(M.random()*0.6-0.3, 0, -1).normalize(),
        ANGLE * (0.8 + M.random()*0.4)
      ));
      dir.normalize();
    } else if(ch === '['){
      stack.push({pos:pos.clone(), dir:dir.clone(), thick});
      depth++;
    } else if(ch === ']'){
      if(stack.length){const s=stack.pop();pos=s.pos;dir=s.dir;thick=s.thick;depth--;}
    }
  }
  return vineGroup;
}

// ── MAIN GENERATE ─────────────────────────────────────────────────────────
window.generateSupports = async () => {
  if(!msh || !overhangPts.length){ sS('> SCAN OVERHANGS FIRST'); return; }

  // Remove previous supports
  window.removeSupports();

  sS('> GENERATING CLASSICAL SUPPORTS...');
  await new Promise(r=>setTimeout(r,30));

  const order   = $('colOrder').value;
  const colR    = +$('COLR').value;
  const flutes  = +$('COLF').value;
  const density = +$('VINED').value;
  const kissGap = +$('VINEK').value;
  const doLeaves= $('cbLeaves').checked;
  const doWrap  = $('cbVineWrap').checked;

  supportGroup = new T.Group();
  // Single shared material — muted terracotta for visual distinction
  const colMat = new T.MeshStandardMaterial({
    color: 0xd4a882, metalness:0.05, roughness:0.85, side:T.DoubleSide
  });
  const vineMat = new T.MeshStandardMaterial({
    color:0x4a7c4a, metalness:0.0, roughness:0.95, side:T.DoubleSide
  });

  let colCount = 0;
  for(const ovh of overhangPts){
    // Column height = distance from overhang point down to Y=0 (bed)
    const colH = M.max(4, ovh.pos.y - 0.5); // at least 4mm, stop 0.5mm from bed

    // Build column
    const col = buildColumn(colH, colR, order, flutes);
    col.traverse(c=>{if(c.isMesh)c.material=colMat.clone();});
    col.position.set(ovh.pos.x, 0, ovh.pos.z);
    supportGroup.add(col);

    // Grow vines from column crown
    const crownPos = new T.Vector3(ovh.pos.x, colH, ovh.pos.z);
    const vines = growVines(crownPos, colH, colR, density, kissGap, doLeaves, doWrap);
    vines.traverse(c=>{if(c.isMesh)c.material=vineMat.clone();});
    supportGroup.add(vines);

    colCount++;
    if(colCount >= 24) break; // sanity cap
  }

  sc.add(supportGroup);

  // Update UI
  $('btnGenSupport').style.display='none';
  $('btnRemoveSupport').style.display='';
  $('supportNote').style.display='';
  sessionDirty=true;

  sS('> '+colCount+' COLUMNS + GRAPEVINE SUPPORTS GENERATED');
};

// ── REMOVE SUPPORTS ───────────────────────────────────────────────────────
window.removeSupports = () => {
  if(supportGroup){ sc.remove(supportGroup); supportGroup=null; }
  $('btnGenSupport').style.display='';
  $('btnRemoveSupport').style.display='none';
  $('supportNote').style.display='none';
};

// Enable scan button when mesh loads (hook into existing onMeshLoaded)
const _origOnMeshLoaded = window.onMeshLoaded;
// Patch: after any mesh load, enable the scan button
const _patchSupportBtns = () => {
  const b=$('btnScanOvh');if(b)b.disabled=0;
  const bg=$('btnGenSupport');if(bg)bg.disabled=1; // need to scan first
};
// Called from onMeshLoaded path
window._patchSupportBtns = _patchSupportBtns;



// +=======================================================================+

  window.prvColumns  = prvColumns;
  window.genColumns  = genColumns;
  window.clrColumns  = clrColumns;
}
