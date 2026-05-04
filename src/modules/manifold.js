import * as THREE from 'three';

// Local binding for the initialized WASM instance
let wasm = null;

/**
 * Dynamically injects and initializes the manifold-3d WASM engine.
 * Uses dynamic import (the ES Module equivalent of script injection) to 
 * load the module safely without polluting the global namespace.
 */
export async function initManifold() {
    if (wasm) return wasm;

    const cdn = 'https://unpkg.com/manifold-3d@2.5.1/';

    try {
        // Dynamically load the ES Module from the CDN
        const mod = await import(cdn + 'manifold.js');
        
        // Initialize the WASM instance, mapping the locateFile to the CDN path
        const instance = mod.default({ locateFile: f => cdn + f });

        // Await WASM compilation with a timeout fallback
        wasm = await Promise.race([
            instance.then ? instance : instance.ready,
            new Promise((_, rej) => setTimeout(() => rej(new Error('WASM load timeout')), 12000))
        ]);

        wasm.setup();
        console.log("✓ manifold-3d WASM engine initialized");
        return wasm;

    } catch (error) {
        console.error("Failed to load manifold-3d:", error);
        throw error;
    }
}

/**
 * Converts a Three.js BufferGeometry to a Manifold object.
 * Uses raw TypedArray access to minimize memory overhead.
 * * @param {THREE.BufferGeometry} geometry - Must be indexed (use mergeVertices if needed).
 * @returns {Manifold} The initialized Manifold object.
 */
export function geo2manifold(geometry) {
    if (!wasm) throw new Error("manifold-3d WASM not initialized. Call initManifold() first.");
    if (!geometry.index) throw new Error("Geometry must be indexed to create a Manifold.");

    // Direct TypedArray access
    const pos = geometry.attributes.position.array;
    const idx = geometry.index.array;

    // WASM boundary strictly requires Float32Array and Uint32Array.
    // If Three.js already uses these types, we pass the references directly.
    const vertProperties = pos instanceof Float32Array ? pos : new Float32Array(pos);
    const triVerts = idx instanceof Uint32Array ? idx : new Uint32Array(idx);

    const mesh = new wasm.Mesh({
        numProp: 3, // x, y, z
        vertProperties: vertProperties,
        triVerts: triVerts
    });

    // Merge automatically welds duplicate vertices within tolerance, 
    // guaranteeing clean half-edge topology before pushing to the boolean engine.
    mesh.merge();

    return wasm.Manifold.ofMesh(mesh);
}

/**
 * Converts a Manifold object back to a Three.js BufferGeometry.
 * * @param {Manifold} manifoldObj - The Manifold object to convert.
 * @returns {THREE.BufferGeometry} 
 */
export function manifold2geo(manifoldObj) {
    if (!wasm) throw new Error("manifold-3d WASM not initialized.");

    const mesh = manifoldObj.getMesh();
    const geo = new THREE.BufferGeometry();

    const numProp = mesh.numProp || 3;
    const vp = mesh.vertProperties; // Float32Array populated directly by WASM
    const tv = mesh.triVerts;       // Uint32Array populated directly by WASM

    // If the stride is exactly 3 (xyz), we can map the WASM array instantly.
    if (numProp === 3) {
        geo.setAttribute('position', new THREE.BufferAttribute(vp, 3));
    } else {
        // If properties include normals/UVs, we manually strip just the XYZ data.
        const nv = vp.length / numProp;
        const pos = new Float32Array(nv * 3);
        for (let i = 0; i < nv; i++) {
            pos[i * 3]     = vp[i * numProp];
            pos[i * 3 + 1] = vp[i * numProp + 1];
            pos[i * 3 + 2] = vp[i * numProp + 2];
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    }

    geo.setIndex(new THREE.BufferAttribute(tv, 1));

    // Convert to flat-shaded non-indexed topology standard for STL/CAD engines
    const nonIndexedGeo = geo.toNonIndexed();
    nonIndexedGeo.computeVertexNormals();

    return nonIndexedGeo;
}

/**
 * WASM Memory Manager / RAII Tracker
 * Wraps manifold operations and strictly guarantees that intermediate C++ objects
 * are deleted from the WASM heap, preventing memory leaks during CSG execution.
 * * @example
 * const resultGeo = withManifold(m => {
 * const box = m.track(geo2manifold(boxGeo));
 * const cyl = m.track(geo2manifold(cylGeo));
 * return manifold2geo(m.track(box.subtract(cyl)));
 * });
 */
export function withManifold(callback) {
    const tracked = [];
    const memoryManager = {
        track(obj) {
            tracked.push(obj);
            return obj;
        },
        wasm
    };

    try {
        return callback(memoryManager);
    } finally {
        // Guarantee cleanup of C++ heap objects regardless of JS errors
        for (const obj of tracked) {
            try { 
                obj.delete(); 
            } catch (e) { 
                // Object already consumed/deleted, safe to ignore
            }
        }
    }
}