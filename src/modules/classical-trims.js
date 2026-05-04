/**
 * src/modules/classical-trim.js
 * Artistic Fillets & Trim Module
 * Sweeps classical architectural profiles along selected mesh edges and fuses via CSG.
 */
import * as THREE from 'three';

// --- 1. CLASSICAL PROFILE DICTIONARY (Pure Math) ---
const getProfileShape = (type, size) => {
    const s = new THREE.Shape();
    const r = size / 2; // Radius / Extents
    
    // Profiles are drawn relative to the center (0,0) of the edge
    // to properly bite into the mesh and protrude.
    switch (type) {
        case 'fillet': 
            // Standard rounded convex fillet
            s.moveTo(-r, r);
            s.quadraticCurveTo(r, r, r, -r);
            s.lineTo(-r, -r);
            s.lineTo(-r, r);
            break;
            
        case 'ovolo': 
            // Greek Ovolo (flattened convex curve)
            s.moveTo(-r, r);
            s.quadraticCurveTo(r, r * 0.5, r, -r);
            s.lineTo(-r, -r);
            s.lineTo(-r, r);
            break;
            
        case 'ogee': 
            // Roman Ogee / Cyma Reversa (S-Curve: Convex top, concave bottom)
            s.moveTo(-r, r);
            s.bezierCurveTo(0, r, 0, -r, r, -r);
            s.lineTo(-r, -r);
            s.lineTo(-r, r);
            break;
            
        case 'cavetto': 
            // Cavetto (Concave quarter circle)
            s.moveTo(-r, r);
            s.quadraticCurveTo(-r, -r, r, -r);
            s.lineTo(-r, -r);
            s.lineTo(-r, r);
            break;
    }
    return s;
};

// --- 2. MODULE CORE ---
export function install(engineCore) {
    let isSelectMode = false;
    let selectedEdge = null;
    let edgeHighlightLine = null;
    
    // --- UI INJECTION ---
    const panel = document.createElement('div');
    panel.className = 'pnl';
    panel.innerHTML = `
        <div class="pnl-hdr"><span>🏛️ CLASSICAL TRIM</span></div>
        <div class="pnl-body">
            <div class="r">
                <span class="lbl">PROFILE</span>
                <select id="trimType">
                    <option value="fillet">Standard Fillet</option>
                    <option value="ovolo">Greek Ovolo</option>
                    <option value="ogee">Roman Ogee (Cyma Reversa)</option>
                    <option value="cavetto">Cavetto</option>
                </select>
            </div>
            <div class="r">
                <span class="lbl">SIZE (mm)</span>
                <input type="number" id="trimSize" value="5.0" step="0.5" min="0.5">
            </div>
            <button class="btn" id="btnTrimEdge">📍 SELECT EDGE</button>
            <button class="btn g" id="btnApplyTrim" disabled>✨ APPLY TRIM</button>
        </div>
    `;
    engineCore.ui.appendChild(panel);

    const btnSelect = panel.querySelector('#btnTrimEdge');
    const btnApply = panel.querySelector('#btnApplyTrim');
    const selType = panel.querySelector('#trimType');
    const inpSize = panel.querySelector('#trimSize');

    // --- EDGE SELECTION LOGIC ---
    btnSelect.onclick = () => {
        isSelectMode = !isSelectMode;
        btnSelect.textContent = isSelectMode ? "🛑 CANCEL SELECT" : "📍 SELECT EDGE";
        btnSelect.classList.toggle('on', isSelectMode);
        
        // Optional: Notify user in status bar
        if (engineCore.setStatus) {
            engineCore.setStatus(isSelectMode ? "> CLICK A MESH EDGE" : "> EDGE SELECTION CANCELLED");
        }
    };

    const clearHighlight = () => {
        if (edgeHighlightLine) {
            engineCore.scene.remove(edgeHighlightLine);
            edgeHighlightLine.geometry.dispose();
            edgeHighlightLine.material.dispose();
            edgeHighlightLine = null;
        }
    };

    // Global click listener for the raycaster
    window.addEventListener('pointerdown', (e) => {
        if (!isSelectMode || !engineCore.selectedMesh || e.button !== 0 || e.target.closest('.pnl')) return;

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );

        raycaster.setFromCamera(mouse, engineCore.camera);
        const intersects = raycaster.intersectObject(engineCore.selectedMesh);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const mesh = hit.object;
            const face = hit.face;
            const pos = mesh.geometry.attributes.position;

            // Extract vertices of the clicked face
            const vA = new THREE.Vector3().fromBufferAttribute(pos, face.a).applyMatrix4(mesh.matrixWorld);
            const vB = new THREE.Vector3().fromBufferAttribute(pos, face.b).applyMatrix4(mesh.matrixWorld);
            const vC = new THREE.Vector3().fromBufferAttribute(pos, face.c).applyMatrix4(mesh.matrixWorld);

            // Determine the closest edge to the click point
            const edges = [
                { start: vA, end: vB },
                { start: vB, end: vC },
                { start: vC, end: vA }
            ];

            let minDist = Infinity;
            edges.forEach(edge => {
                const line = new THREE.Line3(edge.start, edge.end);
                const closestPt = new THREE.Vector3();
                line.closestPointToPoint(hit.point, true, closestPt);
                const dist = hit.point.distanceTo(closestPt);
                if (dist < minDist) {
                    minDist = dist;
                    selectedEdge = edge;
                }
            });

            // Highlight chosen edge
            clearHighlight();
            const hlGeo = new THREE.BufferGeometry().setFromPoints([selectedEdge.start, selectedEdge.end]);
            const hlMat = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 3, depthTest: false });
            edgeHighlightLine = new THREE.Line(hlGeo, hlMat);
            engineCore.scene.add(edgeHighlightLine);

            btnApply.disabled = false;
            if (engineCore.setStatus) engineCore.setStatus("> EDGE SELECTED");
        }
    });

    // --- APPLY TRIM & CSG UNION ---
    btnApply.onclick = async () => {
        if (!selectedEdge || !engineCore.selectedMesh) return;
        btnApply.disabled = true;

        if (engineCore.setStatus) engineCore.setStatus("> GENERATING TRIM...");

        try {
            // 1. Generate Sweep Path
            // Convert world space edge points back to mesh local space for boolean
            const invWorld = engineCore.selectedMesh.matrixWorld.clone().invert();
            const localStart = selectedEdge.start.clone().applyMatrix4(invWorld);
            const localEnd = selectedEdge.end.clone().applyMatrix4(invWorld);
            
            const edgePath = new THREE.LineCurve3(localStart, localEnd);
            
            // 2. Generate Profile Shape
            const size = parseFloat(inpSize.value) || 5.0;
            const shape = getProfileShape(selType.value, size);

            // 3. Extrude
            const extrudeSettings = {
                steps: 2, // Low poly along straight edge; increase if edge is a curve
                bevelEnabled: false,
                extrudePath: edgePath
            };
            
            const trimGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            const trimMesh = new THREE.Mesh(trimGeo);

            // 4. WASM CSG Union
            // This maps to your engine's internal CSG logic (e.g. manifold-3d)
            if (typeof engineCore.csgUnion === 'function') {
                const resultGeo = await engineCore.csgUnion(engineCore.selectedMesh.geometry, trimMesh.geometry);
                
                // Recompute topological limits
                resultGeo.computeVertexNormals();
                resultGeo.computeBoundingBox();

                // Swap geometry
                engineCore.selectedMesh.geometry.dispose();
                engineCore.selectedMesh.geometry = resultGeo;
                
                if (engineCore.setStatus) engineCore.setStatus("> TRIM APPLIED SAFELY");
            } else {
                console.warn("engineCore.csgUnion is not defined. Falling back to simple additive grouping.");
                engineCore.scene.add(trimMesh); // Fallback if WASM CSG wrapper isn't exposed
            }

            // Cleanup
            trimGeo.dispose();
            clearHighlight();
            selectedEdge = null;
            isSelectMode = false;
            btnSelect.textContent = "📍 SELECT EDGE";
            btnSelect.classList.remove('on');

        } catch (error) {
            console.error(error);
            if (engineCore.setStatus) engineCore.setStatus("> ERR: TRIM FAILED");
        } finally {
            btnApply.disabled = true;
        }
    };
}