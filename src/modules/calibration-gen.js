/**
 * P3dK Plugin: Parametric Calibration STL Generator
 * Procedurally generates accurate 3D printing calibration tests (Temp Tower, Flow Cube, VFA).
 */

import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';

// ── PARAMETER CONFIGURATION ──────────────────────────────────────────────────
const CALIB_CONFIGS = {
    tempTower: [
        { id: 'tStart', label: 'START TEMP °C', val: 230, min: 180, max: 300, step: 5 },
        { id: 'tEnd', label: 'END TEMP °C', val: 190, min: 180, max: 300, step: 5 },
        { id: 'tStep', label: 'STEP/DECREMENT', val: 5, min: 1, max: 20, step: 1 }
    ],
    flowCube: [
        { id: 'fSize', label: 'CUBE SIZE mm', val: 20, min: 10, max: 100, step: 1 },
        { id: 'fWall', label: 'WALL THICK mm', val: 0.4, min: 0.1, max: 2.0, step: 0.1 },
        { id: 'fBot', label: 'BOTTOM THICK mm', val: 1.0, min: 0.0, max: 5.0, step: 0.2 }
    ],
    vfa: [
        { id: 'vDiam', label: 'DIAMETER mm', val: 30, min: 10, max: 100, step: 1 },
        { id: 'vHeight', label: 'HEIGHT mm', val: 40, min: 10, max: 200, step: 1 },
        { id: 'vFacets', label: 'FACETS (Motor Res)', val: 128, min: 16, max: 512, step: 8 }
    ]
};

// ── 1. PROCEDURAL GEOMETRY GENERATORS ────────────────────────────────────────

/**
 * Generates a hollow cube for measuring flow rate / extrusion multiplier.
 */
function generateFlowCube(size, wall, bot) {
    // Outer shape
    const shape = new THREE.Shape();
    shape.moveTo(-size/2, -size/2);
    shape.lineTo(size/2, -size/2);
    shape.lineTo(size/2, size/2);
    shape.lineTo(-size/2, size/2);
    shape.closePath();

    // Inner hollow (Hole)
    const hole = new THREE.Path();
    hole.moveTo(-size/2 + wall, -size/2 + wall);
    hole.lineTo(size/2 - wall, -size/2 + wall);
    hole.lineTo(size/2 - wall, size/2 - wall);
    hole.lineTo(-size/2 + wall, size/2 - wall);
    hole.closePath();
    shape.holes.push(hole);

    // Extrude the walls
    const wallsGeo = new THREE.ExtrudeGeometry(shape, {
        depth: size - bot,
        bevelEnabled: false
    });
    // Extrude builds along Z by default. Rotate so it builds along Y.
    wallsGeo.rotateX(-Math.PI / 2);
    wallsGeo.translate(0, bot, 0); // Shift up by bottom thickness

    // Base floor
    const botGeo = new THREE.BoxGeometry(size, bot, size);
    botGeo.translate(0, bot / 2, 0);

    return BGU.mergeGeometries([botGeo, wallsGeo]);
}

/**
 * Generates a faceted cylinder for measuring Vertical Fine Artifacts (VFA).
 */
function generateVFACyl(diam, height, facets) {
    const geo = new THREE.CylinderGeometry(diam/2, diam/2, height, facets);
    geo.translate(0, height/2, 0); // Flush to Y=0
    return geo;
}

/**
 * Procedural Voxel Text Rasterizer
 * Draws text to canvas, reads pixels, converts solid pixels to BoxGeometries.
 */
function createTextVoxels(text, voxelSize, offsetX, offsetY, offsetZ) {
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    const fontSize = 16;
    
    ctx.font = `bold ${fontSize}px sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width);
    const h = fontSize;
    
    cv.width = w; 
    cv.height = h;
    
    // Reapply after resize
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';
    ctx.fillText(text, 0, 0);
    
    const data = ctx.getImageData(0, 0, w, h).data;
    const boxGeo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
    const geos = [];
    
    for(let y = 0; y < h; y++) {
        for(let x = 0; x < w; x++) {
            if(data[(y * w + x) * 4 + 3] > 128) {
                const clone = boxGeo.clone();
                // Invert Y so text reads top-to-bottom
                clone.translate(offsetX + x * voxelSize, offsetY + (h - y) * voxelSize, offsetZ);
                geos.push(clone);
            }
        }
    }
    return geos;
}

/**
 * Generates a classic Temperature Tower with bridging, overhangs, and embossed temps.
 */
function generateTempTower(tStart, tEnd, tStep) {
    const geos = [];
    const stepDir = tStart > tEnd ? -1 : 1;
    const steps = Math.abs(Math.floor((tEnd - tStart) / tStep)) + 1;
    
    // Tower Dimensions
    const w = 30, d = 12, hLyr = 10, hBase = 2;
    const pW = 10; // Pillar width
    
    // Base Plate (Flush at Y=0)
    const base = new THREE.BoxGeometry(w + 4, hBase, d + 4);
    base.translate(0, hBase / 2, 0);
    geos.push(base);

    // Iterative Generation per Temp Layer
    for (let i = 0; i < steps; i++) {
        const temp = tStart + (i * tStep * stepDir);
        const yOff = hBase + i * hLyr;
        
        // Left Pillar
        const pLeft = new THREE.BoxGeometry(pW, hLyr, d);
        pLeft.translate(-w/2 + pW/2, yOff + hLyr/2, 0);
        geos.push(pLeft);
        
        // Right Pillar
        const pRight = new THREE.BoxGeometry(pW, hLyr, d);
        pRight.translate(w/2 - pW/2, yOff + hLyr/2, 0);
        geos.push(pRight);
        
        // Bridge (Top 2mm connecting pillars)
        const gap = w - 2*pW; // 10mm gap
        const bridge = new THREE.BoxGeometry(gap, 2, d);
        bridge.translate(0, yOff + hLyr - 1, 0);
        geos.push(bridge);

        // Overhang Test (Inverted Pyramid under bridge)
        const overhang = new THREE.CylinderGeometry(0, gap/2, 4, 4);
        overhang.rotateY(Math.PI / 4); // Make it square aligned
        overhang.rotateX(Math.PI); // Point down
        overhang.translate(0, yOff + hLyr - 2 - 2, 0);
        geos.push(overhang);

        // Embossed Number (Front of left pillar)
        const voxelSize = 0.3;
        const textGeos = createTextVoxels(
            `${temp}`, 
            voxelSize, 
            (-w/2 + pW/2) - 3.5, // Center text on pillar
            yOff + 2.5,          // Bottom padding
            d/2 + voxelSize/2    // Push out of front face
        );
        geos.push(...textGeos);
    }

    return BGU.mergeGeometries(geos);
}

// ── 2. UI & ENGINE INJECTION ──────────────────────────────────────────────────

function renderInputs(container, configArray) {
    container.innerHTML = '';
    configArray.forEach(cfg => {
        container.innerHTML += `
            <div class="r" style="margin-top: 4px;">
                <span class="lbl">${cfg.label}</span>
                <input type="number" id="calib_${cfg.id}" value="${cfg.val}" min="${cfg.min}" max="${cfg.max}" step="${cfg.step}">
            </div>
        `;
    });
}

/**
 * Main Plugin Installation Entry Point
 * @param {Object} engineCore - The host application context
 */
export function install(engineCore) {
    const uiSidebar = document.getElementById('ui');
    if (!uiSidebar) {
        console.error('Calibration Plugin: Could not find #ui element.');
        return;
    }

    // 1. Build & Inject UI Panel
    const pnl = document.createElement('div');
    pnl.className = 'pnl';
    pnl.innerHTML = `
        <div class="pnl-hdr closed" onclick="window.tP(this)">
            <span style="color: #0f9;">⚙️ CALIBRATION TOOLS</span><span class="arr">▶</span>
        </div>
        <div class="pnl-body hidden">
            <div class="note">Procedural tests for tuning slicer profiles.</div>
            <select id="calibType" style="margin-bottom: 6px;">
                <option value="tempTower">Temperature Tower</option>
                <option value="flowCube">Flow Rate Cube</option>
                <option value="vfa">VFA Cylinder</option>
            </select>
            <div id="calibParams"></div>
            <hr class="divider">
            <button class="btn y" id="btnGenCalib">[ 🚀 GENERATE MESH ]</button>
        </div>
    `;
    uiSidebar.appendChild(pnl);

    const typeSelect = document.getElementById('calibType');
    const paramContainer = document.getElementById('calibParams');
    const btnGen = document.getElementById('btnGenCalib');

    // 2. Bind Events
    typeSelect.addEventListener('change', () => renderInputs(paramContainer, CALIB_CONFIGS[typeSelect.value]));
    renderInputs(paramContainer, CALIB_CONFIGS['tempTower']); // Init default

    btnGen.addEventListener('click', () => {
        const type = typeSelect.value;
        const val = (id) => parseFloat(document.getElementById(`calib_${id}`).value);
        let geo = null;

        document.getElementById('sts').textContent = '> GENERATING CALIBRATION STL...';

        try {
            if (type === 'tempTower') geo = generateTempTower(val('tStart'), val('tEnd'), val('tStep'));
            if (type === 'flowCube')  geo = generateFlowCube(val('fSize'), val('fWall'), val('fBot'));
            if (type === 'vfa')       geo = generateVFACyl(val('vDiam'), val('vHeight'), parseInt(val('vFacets')));

            if (geo) {
                geo.computeVertexNormals();
                geo.computeBoundingBox();

                // 3. Inject into Engine
                if (engineCore && typeof engineCore.setMesh === 'function') {
                    engineCore.setMesh(geo);
                } else if (window.msh) {
                    // Fallback to direct global mutation if engineCore is missing
                    window.msh.geometry.dispose();
                    window.msh.geometry = geo;
                    window.msh.scale.set(1, 1, 1);
                    window.msh.position.set(0, 0, 0);
                    window.msh.rotation.set(0, 0, 0);
                    if (window.mem) window.mem.sv(geo);
                    if (window.uH) window.uH();
                }

                document.getElementById('sts').textContent = '> CALIBRATION GENERATED ✓';
            }
        } catch (err) {
            console.error(err);
            document.getElementById('sts').textContent = '> ERR: ' + err.message;
        }
    });
}