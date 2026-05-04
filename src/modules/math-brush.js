import * as THREE from 'three';

let isActive = false;
let isPainting = false;
let brushSize = 5.0;
let targetMesh = null;
let cursorMesh = null;

// Spatial Hash for O(K) proximity queries instead of O(N) vertex looping
const spatialGrid = new Map();
const CELL_SIZE = 10.0; 

/**
 * Builds a local-space spatial index of mesh vertices.
 */
const buildSpatialGrid = (geo) => {
  spatialGrid.clear();
  const pos = geo.attributes.position.array;
  
  for (let i = 0; i < pos.length; i += 3) {
    const cx = Math.floor(pos[i] / CELL_SIZE);
    const cy = Math.floor(pos[i + 1] / CELL_SIZE);
    const cz = Math.floor(pos[i + 2] / CELL_SIZE);
    const key = `${cx},${cy},${cz}`;
    
    if (!spatialGrid.has(key)) spatialGrid.set(key, []);
    spatialGrid.get(key).push(i);
  }
  console.log(`[Math Brush] Spatial grid built: ${spatialGrid.size} active cells.`);
};

/**
 * Applies the mathematical knurling displacement locally.
 */
const paintMathPattern = (hit) => {
  if (!targetMesh || !targetMesh.geometry.attributes.position) return;
  
  const geo = targetMesh.geometry;
  const pos = geo.attributes.position.array;
  const norm = geo.attributes.normal.array;
  
  // Convert brush center and radius to mesh local space
  const localCenter = targetMesh.worldToLocal(hit.point.clone());
  const localRadius = brushSize / targetMesh.scale.x; 
  const rSq = localRadius * localRadius;
  
  // Calculate grid bounds
  const minC = localCenter.clone().subScalar(localRadius).divideScalar(CELL_SIZE).floor();
  const maxC = localCenter.clone().addScalar(localRadius).divideScalar(CELL_SIZE).floor();
  
  const freq = 1.5;   // Pattern frequency
  const power = 0.25; // Extrusion power per frame

  // Iterate ONLY over the spatial cells touched by the brush AABB
  for (let x = minC.x; x <= maxC.x; x++) {
    for (let y = minC.y; y <= maxC.y; y++) {
      for (let z = minC.z; z <= maxC.z; z++) {
        const cell = spatialGrid.get(`${x},${y},${z}`);
        if (!cell) continue;
        
        for (let i = 0; i < cell.length; i++) {
          const idx = cell[i];
          const dx = pos[idx] - localCenter.x;
          const dy = pos[idx + 1] - localCenter.y;
          const dz = pos[idx + 2] - localCenter.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          
          if (distSq < rSq) {
            // Smooth bell-curve falloff to prevent harsh edges
            const falloff = Math.pow(1.0 - Math.sqrt(distSq) / localRadius, 2.0);
            
            // 3D Procedural Knurling function: sin(x) * cos(y) * sin(z)
            const pattern = Math.sin(pos[idx] * freq) * Math.cos(pos[idx + 1] * freq) * Math.sin(pos[idx + 2] * freq);
            
            const displacement = pattern * falloff * power;
            
            // Move vertex along its normal
            pos[idx] += norm[idx] * displacement;
            pos[idx + 1] += norm[idx + 1] * displacement;
            pos[idx + 2] += norm[idx + 2] * displacement;
          }
        }
      }
    }
  }
  
  geo.attributes.position.needsUpdate = true;
};

/**
 * Installs the Brush module into the CAD core.
 */
export const install = (engineCore) => {
  const { scene, camera, renderer, controls } = engineCore;
  
  // 1. UI Setup
  const ui = document.createElement('div');
  ui.style.cssText = 'position:absolute; top:20px; left:20px; padding:15px; background:rgba(10,15,30,0.85); color:#0ff; border:1px solid #0ff; border-radius:6px; font-family:monospace; z-index:100;';
  
  const btnToggle = document.createElement('button');
  btnToggle.innerHTML = '🖌️ MATH BRUSH [OFF]';
  btnToggle.style.cssText = 'background:transparent; color:#0ff; border:1px solid #0ff; padding:8px; cursor:pointer; width:100%; margin-bottom:10px;';
  
  const sliderLabel = document.createElement('label');
  sliderLabel.innerText = `Size: ${brushSize}mm`;
  sliderLabel.style.display = 'block';
  
  const sizeSlider = document.createElement('input');
  sizeSlider.type = 'range';
  sizeSlider.min = '1'; sizeSlider.max = '30'; sizeSlider.step = '0.5';
  sizeSlider.value = brushSize;
  sizeSlider.style.width = '100%';
  
  ui.appendChild(btnToggle);
  ui.appendChild(sliderLabel);
  ui.appendChild(sizeSlider);
  document.body.appendChild(ui);
  
  // 2. Brush Cursor Setup
  const ringGeo = new THREE.RingGeometry(0.8, 1.0, 32);
  const ringMat = new THREE.MeshBasicMaterial({ 
    color: 0x00ffff, 
    transparent: true, 
    opacity: 0.6, 
    depthTest: false,
    side: THREE.DoubleSide
  });
  cursorMesh = new THREE.Mesh(ringGeo, ringMat);
  cursorMesh.visible = false;
  scene.add(cursorMesh);
  
  // 3. Events & Interactivity
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  const updateRaycast = (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    // Ignore the cursor ring itself
    return raycaster.intersectObjects(scene.children.filter(c => c.isMesh && c !== cursorMesh), false);
  };

  sizeSlider.oninput = (e) => {
    brushSize = parseFloat(e.target.value);
    sliderLabel.innerText = `Size: ${brushSize}mm`;
    cursorMesh.scale.setScalar(brushSize);
  };

  btnToggle.onclick = () => {
    isActive = !isActive;
    btnToggle.innerHTML = isActive ? '🖌️ MATH BRUSH [ON]' : '🖌️ MATH BRUSH [OFF]';
    btnToggle.style.background = isActive ? 'rgba(0, 255, 255, 0.2)' : 'transparent';
    cursorMesh.visible = isActive;
    targetMesh = null; // Force grid rebuild on next hit
  };

  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!isActive) return;
    
    const hits = updateRaycast(e);
    if (hits.length > 0) {
      const hit = hits[0];
      
      // Update cursor visuals (hug the surface normal)
      cursorMesh.visible = true;
      cursorMesh.position.copy(hit.point).addScaledVector(hit.face.normal, 0.05); // slight Z-bias
      cursorMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.face.normal);
      
      // Rebuild Spatial Grid if we moved to a new mesh
      if (hit.object !== targetMesh) {
        targetMesh = hit.object;
        buildSpatialGrid(targetMesh.geometry);
      }
      
      if (isPainting) paintMathPattern(hit);
    } else {
      cursorMesh.visible = false;
    }
  });

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!isActive || e.button !== 0) return;
    const hits = updateRaycast(e);
    if (hits.length > 0) {
      isPainting = true;
      controls.enabled = false; // Lock camera while painting
      paintMathPattern(hits[0]);
    }
  });

  window.addEventListener('pointerup', () => {
    if (isPainting && targetMesh) {
      // Recompute normals entirely once the brush stroke is finished
      // for accurate shading on the newly generated geometry
      targetMesh.geometry.computeVertexNormals();
    }
    isPainting = false;
    if (controls) controls.enabled = true; // Unlock camera
  });
};