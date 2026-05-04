/**
 * P3dK MODULE // WAVE OVERHANG GENERATOR
 * Bakes support-free wave overhangs directly into the mesh geometry.
 */
import * as THREE from 'three';

export const install = (engineCore) => {
    console.log("🔌 Plugin Loaded: Wave Overhang Generator");

    // 1. Inject UI Button
    const modSys = document.getElementById('modSys').querySelector('.pnl-body');
    const waveBtn = document.createElement('button');
    waveBtn.className = 'btn';
    waveBtn.style.cssText = "width: 100%; margin-top: 10px; background: #004455; color: #00e5ff; border: 1px solid #00e5ff;";
    waveBtn.textContent = "🌊 BAKE WAVE OVERHANGS";
    modSys.appendChild(waveBtn);

    const sS = msg => { const e = document.getElementById('sts'); if(e) e.textContent = msg; };

    // 2. The Core Math Logic
    waveBtn.addEventListener('click', () => {
        const targetMesh = engineCore.selectedMesh;
        if (!targetMesh) {
            sS("> ERR: SELECT A PART FIRST");
            return;
        }

        sS("> CALCULATING WAVE OVERHANGS...");
        
        // Ensure we have non-indexed geometry to manipulate individual faces safely
        let geo = targetMesh.geometry;
        if (geo.index) geo = geo.toNonIndexed();
        geo.computeVertexNormals();

        const pos = geo.attributes.position;
        const norms = geo.attributes.normal;
        
        const waveAmplitude = 1.2; // mm of wave depth
        const waveFrequency = 2.0; // tightness of the zig-zag

        // Iterate through all vertices
        for (let i = 0; i < pos.count; i++) {
            // Read Normal Y (Is it pointing down?)
            const ny = norms.getY(i);
            
            // If the face is pointing down more than 45 degrees (ny < -0.5)
            if (ny < -0.5) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);

                // Apply a Sine Wave ripple along the X/Z axis based on the coordinate
                const ripple = Math.sin(x * waveFrequency) * Math.cos(z * waveFrequency) * waveAmplitude;
                
                // Offset the vertex
                pos.setY(i, y + ripple);
            }
        }

        // Recompute to fix lighting and bounds after manipulation
        geo.computeVertexNormals();
        geo.computeBoundingBox();
        targetMesh.geometry = geo;
        
        // Visual feedback
        targetMesh.material.wireframe = true;
        setTimeout(() => { targetMesh.material.wireframe = false; }, 1000);

        sS("> WAVE OVERHANGS BAKED INTO MESH");
    });
};