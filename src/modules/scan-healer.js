import * as THREE from 'three';

/**
 * 1. WASM BRIDGE: SPLAT TO MESH (Marching Cubes)
 * Simulates the memory bridging to a hypothetical WASM Marching Cubes implementation.
 */
const splatToMeshWASM = async (splatData, threshold, wasmCore) => {
  // Allocate memory in the WASM heap
  const bytes = splatData.length * 4;
  const ptr = wasmCore._malloc(bytes);
  wasmCore.HEAPF32.set(splatData, ptr >> 2);

  // Call WASM function: returns a pointer to a struct { vCount, iCount, vPtr, iPtr }
  const resPtr = wasmCore._run_marching_cubes(ptr, splatData.length, threshold);
  
  const vCount = wasmCore.HEAPU32[(resPtr >> 2)];
  const iCount = wasmCore.HEAPU32[(resPtr >> 2) + 1];
  const vPtr   = wasmCore.HEAPU32[(resPtr >> 2) + 2];
  const iPtr   = wasmCore.HEAPU32[(resPtr >> 2) + 3];

  // Copy data back into JS space
  const vertices = new Float32Array(wasmCore.HEAPF32.buffer, vPtr, vCount * 3).slice();
  const indices = new Uint32Array(wasmCore.HEAPU32.buffer, iPtr, iCount).slice();

  // Free WASM memory
  wasmCore._free(ptr);
  wasmCore._free_marching_cubes_result(resPtr);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  
  return geo;
};

/**
 * 2. TAUBIN SMOOTHING (Volume-Preserving)
 * Alternates between expanding ($\lambda > 0$) and shrinking ($\mu < 0$ where $\mu < -\lambda$).
 * Uses a zero-GC umbrella operator by accumulating across faces instead of building a heavy edge-graph.
 */
const applyTaubinSmoothing = (geo, iterations = 10, lambda = 0.5, mu = -0.53) => {
  const pos = geo.attributes.position.array;
  const idx = geo.index ? geo.index.array : null;
  const numVerts = pos.length / 3;
  const numFaces = idx ? idx.length / 3 : numVerts / 3;

  // Pre-allocate flat accumulation buffers
  const laplacian = new Float32Array(pos.length);
  const weights = new Uint32Array(numVerts);

  for (let iter = 0; iter < iterations; iter++) {
    // Pass 1 & 2: Apply lambda, then mu
    const factors = [lambda, mu];
    
    for (let pass = 0; pass < 2; pass++) {
      laplacian.fill(0);
      weights.fill(0);

      // Accumulate neighbor positions via faces
      for (let f = 0; f < numFaces; f++) {
        const a = idx ? idx[f * 3] : f * 3;
        const b = idx ? idx[f * 3 + 1] : f * 3 + 1;
        const c = idx ? idx[f * 3 + 2] : f * 3 + 2;

        const a3 = a * 3, b3 = b * 3, c3 = c * 3;

        // Vert A receives B and C
        laplacian[a3] += pos[b3] + pos[c3]; laplacian[a3+1] += pos[b3+1] + pos[c3+1]; laplacian[a3+2] += pos[b3+2] + pos[c3+2];
        // Vert B receives A and C
        laplacian[b3] += pos[a3] + pos[c3]; laplacian[b3+1] += pos[a3+1] + pos[c3+1]; laplacian[b3+2] += pos[a3+2] + pos[c3+2];
        // Vert C receives A and B
        laplacian[c3] += pos[a3] + pos[b3]; laplacian[c3+1] += pos[a3+1] + pos[b3+1]; laplacian[c3+2] += pos[a3+2] + pos[b3+2];

        weights[a] += 2; weights[b] += 2; weights[c] += 2;
      }

      // Apply displacement: $V_{new} = V_{old} + factor \times (\frac{1}{W} \sum N_{pos} - V_{old})$
      const factor = factors[pass];
      for (let v = 0; v < numVerts; v++) {
        const v3 = v * 3;
        const w = weights[v];
        if (w > 0) {
          pos[v3]   += factor * ((laplacian[v3] / w) - pos[v3]);
          pos[v3+1] += factor * ((laplacian[v3+1] / w) - pos[v3+1]);
          pos[v3+2] += factor * ((laplacian[v3+2] / w) - pos[v3+2]);
        }
      }
    }
  }

  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
};

/**
 * 3. PLANAR SNAP (Decimation via DSU)
 * Snaps co-planar regions into strict mathematical planes. 
 * Uses BigUint64Array to sort edges and build adjacency with Zero GC.
 */
const applyPlanarSnap = (geo, angleThresholdDeg) => {
  if (!geo.index) geo = geo.toNonIndexed(); // Ensure indexed geometry for topological queries
  
  const pos = geo.attributes.position.array;
  const idx = geo.index.array;
  const numFaces = idx.length / 3;
  
  const thresholdDot = Math.cos(angleThresholdDeg * Math.PI / 180);
  
  // 1. Calculate Face Normals & Centroids
  const faceNormals = new Float32Array(numFaces * 3);
  const faceCentroids = new Float32Array(numFaces * 3);
  
  for (let f = 0; f < numFaces; f++) {
    const a3 = idx[f * 3] * 3, b3 = idx[f * 3 + 1] * 3, c3 = idx[f * 3 + 2] * 3;
    
    const ax = pos[a3], ay = pos[a3+1], az = pos[a3+2];
    const ux = pos[b3] - ax, uy = pos[b3+1] - ay, uz = pos[b3+2] - az;
    const vx = pos[c3] - ax, vy = pos[c3+1] - ay, vz = pos[c3+2] - az;
    
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
    
    faceNormals[f*3] = nx/len; faceNormals[f*3+1] = ny/len; faceNormals[f*3+2] = nz/len;
    faceCentroids[f*3] = (ax + pos[b3] + pos[c3]) / 3;
    faceCentroids[f*3+1] = (ay + pos[b3+1] + pos[c3+1]) / 3;
    faceCentroids[f*3+2] = (az + pos[b3+2] + pos[c3+2]) / 3;
  }

  // 2. Build Adjacency using 64-bit Edge Packing: [ minVert (21) | maxVert (21) | faceIdx (21) ]
  const edges = new BigUint64Array(numFaces * 3);
  for (let f = 0; f < numFaces; f++) {
    for (let e = 0; e < 3; e++) {
      const v1 = BigInt(idx[f * 3 + e]);
      const v2 = BigInt(idx[f * 3 + ((e + 1) % 3)]);
      const minV = v1 < v2 ? v1 : v2;
      const maxV = v1 > v2 ? v1 : v2;
      edges[f * 3 + e] = (minV << 42n) | (maxV << 21n) | BigInt(f);
    }
  }
  
  // Sort edges to group shared ones adjacently
  edges.sort();

  // 3. Disjoint Set Union (DSU)
  const dsu = new Int32Array(numFaces);
  for (let i = 0; i < numFaces; i++) dsu[i] = i;
  const find = (i) => dsu[i] === i ? i : (dsu[i] = find(dsu[i]));
  const union = (i, j) => { dsu[find(i)] = find(j); };

  for (let i = 0; i < edges.length - 1; i++) {
    // If the top 42 bits (the two vertices) match, they share an edge
    if ((edges[i] >> 21n) === (edges[i+1] >> 21n)) {
      const faceA = Number(edges[i] & 0x1FFFFFn);
      const faceB = Number(edges[i+1] & 0x1FFFFFn);
      
      const fA3 = faceA * 3, fB3 = faceB * 3;
      const dot = faceNormals[fA3] * faceNormals[fB3] + 
                  faceNormals[fA3+1] * faceNormals[fB3+1] + 
                  faceNormals[fA3+2] * faceNormals[fB3+2];
      
      if (dot > thresholdDot) union(faceA, faceB);
    }
  }

  // 4. Compute Region Planes & Project Vertices
  const regionNormals = new Float32Array(numFaces * 3);
  const regionCentroids = new Float32Array(numFaces * 3);
  const regionCounts = new Uint32Array(numFaces);

  for (let f = 0; f < numFaces; f++) {
    const root = find(f);
    regionNormals[root*3] += faceNormals[f*3];
    regionNormals[root*3+1] += faceNormals[f*3+1];
    regionNormals[root*3+2] += faceNormals[f*3+2];
    
    regionCentroids[root*3] += faceCentroids[f*3];
    regionCentroids[root*3+1] += faceCentroids[f*3+1];
    regionCentroids[root*3+2] += faceCentroids[f*3+2];
    regionCounts[root]++;
  }

  for (let v = 0; v < idx.length; v++) {
    const f = Math.floor(v / 3);
    const root = find(f);
    if (regionCounts[root] > 1) { // Only snap regions with >1 face
      const r3 = root * 3;
      const count = regionCounts[root];
      
      let nx = regionNormals[r3], ny = regionNormals[r3+1], nz = regionNormals[r3+2];
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
      nx /= len; ny /= len; nz /= len;
      
      const cx = regionCentroids[r3] / count;
      const cy = regionCentroids[r3+1] / count;
      const cz = regionCentroids[r3+2] / count;

      const vId = idx[v] * 3;
      const vx = pos[vId], vy = pos[vId+1], vz = pos[vId+2];
      
      // Project $V$ onto Plane: $V' = V - ((V - C) \cdot N)N$
      const dist = (vx - cx) * nx + (vy - cy) * ny + (vz - cz) * nz;
      
      pos[vId] = vx - dist * nx;
      pos[vId+1] = vy - dist * ny;
      pos[vId+2] = vz - dist * nz;
    }
  }

  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
};

/**
 * 4. UI INJECTION & EXPORT
 */
export const install = (engineCore) => {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:absolute; top:20px; right:20px; background:#111; color:#0ff; padding:15px; font-family:monospace; border:1px solid #0ff; z-index:100;';
  panel.innerHTML = `<h3>🛠️ SCAN HEALER</h3>`;

  // SPLAT TO MESH
  const btnSplat = document.createElement('button');
  btnSplat.innerText = 'SPLAT TO MESH (Marching Cubes)';
  btnSplat.onclick = async () => {
    if (!engineCore.splatData || !engineCore.wasm) return alert("Splat data or WASM not loaded.");
    const threshold = 0.5; // Example threshold
    engineCore.selectedMesh.geometry = await splatToMeshWASM(engineCore.splatData, threshold, engineCore.wasm);
  };

  // TAUBIN SMOOTH
  const btnSmooth = document.createElement('button');
  btnSmooth.innerText = 'TAUBIN SMOOTHING';
  btnSmooth.onclick = () => {
    if (!engineCore.selectedMesh) return alert("No mesh selected.");
    applyTaubinSmoothing(engineCore.selectedMesh.geometry, 10, 0.5, -0.53);
  };

  // PLANAR SNAP
  const snapContainer = document.createElement('div');
  snapContainer.style.marginTop = '10px';
  snapContainer.innerHTML = `<label>Planar Angle: <span id="snapVal">5</span>°</label><br>`;
  
  const snapSlider = document.createElement('input');
  snapSlider.type = 'range'; snapSlider.min = '1'; snapSlider.max = '25'; snapSlider.value = '5';
  snapSlider.oninput = (e) => document.getElementById('snapVal').innerText = e.target.value;

  const btnSnap = document.createElement('button');
  btnSnap.innerText = 'PLANAR SNAP';
  btnSnap.onclick = () => {
    if (!engineCore.selectedMesh) return alert("No mesh selected.");
    applyPlanarSnap(engineCore.selectedMesh.geometry, parseFloat(snapSlider.value));
  };

  [btnSplat, btnSmooth, snapSlider, btnSnap].forEach(el => {
    el.style.display = 'block';
    el.style.width = '100%';
    el.style.marginTop = '5px';
    panel.appendChild(el);
  });

  document.body.appendChild(panel);
};