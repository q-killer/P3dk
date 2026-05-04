import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * 1. OVERHANG DETECTION
 * Identifies triangles pointing downward beyond the threshold angle.
 * Normal Y constraint: $N_y < -\cos(\theta)$
 */
export const detectOverhangs = (geometry, angleDeg = 45) => {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  
  const threshold = -Math.cos(angleDeg * (Math.PI / 180));
  const overhangPoints = [];
  
  // We use a simple grid hash to prevent clustering a million pillars
  // in a high-density mesh. One pillar per 10x10mm grid cell.
  const grid = new Set(); 

  for (let i = 0; i < pos.count; i += 3) {
    // Average normal of the triangle
    const ny = (norm.getY(i) + norm.getY(i+1) + norm.getY(i+2)) / 3;
    
    if (ny < threshold) {
      const cx = (pos.getX(i) + pos.getX(i+1) + pos.getX(i+2)) / 3;
      const cy = (pos.getY(i) + pos.getY(i+1) + pos.getY(i+2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i+1) + pos.getZ(i+2)) / 3;
      
      const hash = `${Math.floor(cx/10)},${Math.floor(cz/10)}`;
      if (!grid.has(hash)) {
        grid.add(hash);
        overhangPoints.push(new THREE.Vector3(cx, cy, cz));
      }
    }
  }
  return overhangPoints;
};

/**
 * 2. CLASSICAL ARCHITECTURE: Roman Doric Column
 */
const buildDoricColumn = (x, yTop, z, radius = 2) => {
  const height = yTop - 0.2; // Reserve 0.2mm for pins
  const geos = [];
  const m = new THREE.Matrix4();

  // A. Base (Torus + Cylinder)
  const baseCyl = new THREE.CylinderGeometry(radius * 1.3, radius * 1.5, 1, 32);
  baseCyl.translate(0, 0.5, 0);
  geos.push(baseCyl);
  
  const baseTorus = new THREE.TorusGeometry(radius * 1.2, 0.3, 16, 32);
  baseTorus.rotateX(Math.PI / 2);
  baseTorus.translate(0, 1.15, 0);
  geos.push(baseTorus);

  // B. Fluted Shaft (Extruded Shape)
  const shape = new THREE.Shape();
  const flutes = 20;
  for (let i = 0; i <= flutes; i++) {
    const a = (i / flutes) * Math.PI * 2;
    const aMid = a + (Math.PI / flutes);
    shape.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    // Inward curve for the flute
    if (i < flutes) {
      shape.quadraticCurveTo(
        Math.cos(aMid) * (radius * 0.75), 
        Math.sin(aMid) * (radius * 0.75), 
        Math.cos(aMid + (Math.PI / flutes)) * radius, 
        Math.sin(aMid + (Math.PI / flutes)) * radius
      );
    }
  }
  
  const shaft = new THREE.ExtrudeGeometry(shape, { 
    depth: height - 2.5, 
    bevelEnabled: false,
    curveSegments: 3
  });
  shaft.rotateX(-Math.PI / 2);
  shaft.translate(0, 1.3, 0);
  geos.push(shaft);

  // C. Capital (Abacus & Echinus)
  const capTorus = new THREE.TorusGeometry(radius * 1.1, 0.25, 16, 32);
  capTorus.rotateX(Math.PI / 2);
  capTorus.translate(0, height - 1.2, 0);
  geos.push(capTorus);

  const capBox = new THREE.BoxGeometry(radius * 2.8, 0.5, radius * 2.8);
  capBox.translate(0, height - 0.75, 0);
  geos.push(capBox);

  // Merge and position
  const columnGeo = BGU.mergeGeometries(geos);
  m.makeTranslation(x, 0, z);
  columnGeo.applyMatrix4(m);
  return columnGeo;
};

/**
 * 3. GRAPEVINE L-SYSTEM
 * Generates a 3D branching structure that wraps cylindrically.
 */
const buildVines = (x, yTop, z, colRadius) => {
  const height = yTop - 0.2;
  const axiom = "F";
  const rules = { "F": "F[+F][-F]F" }; // Simple branching
  let state = axiom;
  
  // Evolve L-System (3 iterations)
  for (let i = 0; i < 3; i++) {
    state = state.split('').map(c => rules[c] || c).join('');
  }

  const stack = [];
  let pos = new THREE.Vector3(colRadius, 0, 0);
  let dir = new THREE.Vector3(0, 1, 0); // Pointing up
  const step = height / 20; 
  const angle = Math.PI / 6; // 30 degrees for branches
  const lines = [];

  // Turtle graphics execution
  for (const char of state) {
    if (char === 'F') {
      const next = pos.clone().add(dir.clone().multiplyScalar(step));
      // Cylindrical wrap: Twist the coordinate based on Y height
      const twist = next.y * 0.5; 
      const wrappedStart = new THREE.Vector3(
        pos.x * Math.cos(twist) - pos.z * Math.sin(twist),
        pos.y,
        pos.x * Math.sin(twist) + pos.z * Math.cos(twist)
      );
      const wrappedEnd = new THREE.Vector3(
        next.x * Math.cos(twist) - next.z * Math.sin(twist),
        next.y,
        next.x * Math.sin(twist) + next.z * Math.cos(twist)
      );
      
      lines.push([wrappedStart, wrappedEnd]);
      pos.copy(next);
    } else if (char === '+') {
      dir.applyAxisAngle(new THREE.Vector3(0,0,1), angle);
    } else if (char === '-') {
      dir.applyAxisAngle(new THREE.Vector3(0,0,1), -angle);
    } else if (char === '[') {
      stack.push({ p: pos.clone(), d: dir.clone() });
    } else if (char === ']') {
      const s = stack.pop();
      pos.copy(s.p);
      dir.copy(s.d);
    }
  }

  // Convert lines to TubeGeometries
  const vineGeos = [];
  lines.forEach(([start, end]) => {
    if (start.y > height) return; // Cap at column height
    const curve = new THREE.LineCurve3(start, end);
    const tube = new THREE.TubeGeometry(curve, 2, 0.15, 5, false);
    vineGeos.push(tube);
  });

  const mergedVines = BGU.mergeGeometries(vineGeos);
  const m = new THREE.Matrix4().makeTranslation(x, 0, z);
  mergedVines.applyMatrix4(m);
  return mergedVines;
};

/**
 * 4. BREAKAWAY GAP PINS
 * Bridges the exact final 0.2mm gap.
 */
const buildPins = (x, yTop, z, capRadius = 2.8) => {
  const pinGeos = [];
  // Center pin
  const centerPin = new THREE.ConeGeometry(0.2, 0.2, 8);
  centerPin.translate(0, yTop - 0.1, 0); // Center of 0.2mm height is 0.1
  pinGeos.push(centerPin);

  // 4 Corner pins for stability on the abacus
  const offset = capRadius * 0.4;
  const corners = [
    [offset, offset], [-offset, offset], 
    [offset, -offset], [-offset, -offset]
  ];
  
  corners.forEach(([cx, cz]) => {
    const pin = new THREE.ConeGeometry(0.2, 0.2, 8);
    pin.translate(cx, yTop - 0.1, cz);
    pinGeos.push(pin);
  });

  const mergedPins = BGU.mergeGeometries(pinGeos);
  const m = new THREE.Matrix4().makeTranslation(x, 0, z);
  mergedPins.applyMatrix4(m);
  return mergedPins;
};

/**
 * 5. INSTALL MODULE
 * Wires the module into the host CAD engine UI.
 */
export const install = (engineCore) => {
  const { scene, getActiveMesh, notify } = engineCore;

  const btn = document.createElement('button');
  btn.innerText = '🏛️ Generate Classy Supports';
  btn.style.cssText = 'position:absolute; bottom:20px; right:20px; padding:10px; z-index:100; font-family:monospace; background:#111; color:#0ff; border:1px solid #0ff; cursor:pointer;';
  
  btn.onclick = () => {
    const targetMesh = getActiveMesh();
    if (!targetMesh) return notify('No active mesh to support.');
    
    notify('Detecting overhangs...');
    targetMesh.updateMatrixWorld(true);
    const geometry = targetMesh.geometry.clone();
    geometry.applyMatrix4(targetMesh.matrixWorld);

    const overhangs = detectOverhangs(geometry, 45);
    if (!overhangs.length) return notify('No overhangs detected > 45 deg.');

    notify(`Generating ${overhangs.length} classical supports...`);
    
    const allSupportGeos = [];
    const colRadius = 1.5;

    overhangs.forEach(pt => {
      // Build the 3 components
      const col = buildDoricColumn(pt.x, pt.y, pt.z, colRadius);
      const vines = buildVines(pt.x, pt.y, pt.z, colRadius);
      const pins = buildPins(pt.x, pt.y, pt.z, colRadius * 1.4);
      
      allSupportGeos.push(col, vines, pins);
    });

    const masterSupportGeo = BGU.mergeGeometries(allSupportGeos);
    const supportMat = new THREE.MeshStandardMaterial({ 
      color: 0xcccccc, 
      roughness: 0.8,
      metalness: 0.1
    });
    
    const supportMesh = new THREE.Mesh(masterSupportGeo, supportMat);
    supportMesh.name = "ArtisticSupports";
    scene.add(supportMesh);
    
    notify('Classy supports generated successfully.');
  };

  document.body.appendChild(btn);
};