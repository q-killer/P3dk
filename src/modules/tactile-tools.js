/**
 * P3dK Plugin: Tactile Tools
 * Provides a framework for physical tool metaphors (Knife, Rasp, etc.)
 * Handles surface-normal snapping, orientation toggling, and gesture detection.
 */

import * as THREE from 'three';

// ── MODULE STATE ─────────────────────────────────────────────────────────────
let core = null;           // Reference to engineCore
let activeTool = null;     // 'knife', 'rasp', 'pen', 'tape', or null
let toolCursor = null;     // THREE.Mesh indicator
let toolOrientation = 0;   // 0 or Math.PI / 2
let isDragging = false;
let lastMouse = { x: 0, y: 0 };

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ── UI INJECTION ─────────────────────────────────────────────────────────────
function injectToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'tactile-toolbar';
    toolbar.style.cssText = `
        position: fixed;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 100;
        background: rgba(2, 4, 20, 0.8);
        padding: 8px;
        border: 1px solid rgba(0, 255, 255, 0.4);
        border-radius: 8px;
        backdrop-filter: blur(8px);
    `;

    const tools = [
        { id: 'knife', icon: '🔪', name: 'Butter Knife' },
        { id: 'rasp', icon: '🗜️', name: 'Rasp' },
        { id: 'pen', icon: '🖊️', name: '3D Pen' },
        { id: 'tape', icon: '📏', name: 'Tape' }
    ];

    tools.forEach(t => {
        const btn = document.createElement('button');
        btn.innerHTML = `<span style="font-size: 20px;">${t.icon}</span>`;
        btn.title = t.name;
        btn.style.cssText = `
            background: transparent;
            border: 1px solid transparent;
            color: #0ff;
            width: 44px;
            height: 44px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        `;
        
        btn.onmouseover = () => { if(activeTool !== t.id) btn.style.background = 'rgba(0, 255, 255, 0.1)'; };
        btn.onmouseout = () => { if(activeTool !== t.id) btn.style.background = 'transparent'; };
        
        btn.onclick = () => selectTool(t.id, btn);
        toolbar.appendChild(btn);
    });

    document.body.appendChild(toolbar);
}

function updateToolbarUI() {
    const buttons = document.getElementById('tactile-toolbar').children;
    const toolIds = ['knife', 'rasp', 'pen', 'tape'];
    
    Array.from(buttons).forEach((btn, idx) => {
        if (activeTool === toolIds[idx]) {
            btn.style.background = 'rgba(255, 0, 255, 0.3)';
            btn.style.borderColor = '#f0f';
            btn.style.boxShadow = '0 0 10px rgba(255,0,255,0.4)';
        } else {
            btn.style.background = 'transparent';
            btn.style.borderColor = 'transparent';
            btn.style.boxShadow = 'none';
        }
    });
}

// ── TOOL STATE MANAGEMENT ────────────────────────────────────────────────────
function selectTool(toolId) {
    activeTool = activeTool === toolId ? null : toolId; // Toggle off if clicked again
    updateToolbarUI();

    if (activeTool) {
        // Disable orbit controls
        if (core.controls) core.controls.enabled = false;
        createCursor();
        
        // Log status to main engine UI if available
        if (typeof window.sS === 'function') window.sS(`> EQUIPPED: ${toolId.toUpperCase()} (Right-Click to rotate)`);
    } else {
        dropTool();
    }
}

function dropTool() {
    activeTool = null;
    toolOrientation = 0;
    isDragging = false;
    updateToolbarUI();
    
    if (toolCursor) {
        toolCursor.visible = false;
    }
    
    // Re-enable orbit controls
    if (core.controls) core.controls.enabled = true;
    if (typeof window.sS === 'function') window.sS('> TOOL DROPPED. Camera restored.');
}

function createCursor() {
    if (toolCursor) {
        core.scene.remove(toolCursor);
        toolCursor.geometry.dispose();
        toolCursor.material.dispose();
    }

    // Geometry changes based on tool, defaulting to Knife (Thin Blade)
    let geo;
    if (activeTool === 'knife') geo = new THREE.BoxGeometry(0.2, 4, 10);
    else if (activeTool === 'rasp') geo = new THREE.BoxGeometry(4, 1, 8);
    else if (activeTool === 'pen') geo = new THREE.CylinderGeometry(0.5, 0.1, 4, 16);
    else geo = new THREE.BoxGeometry(1, 1, 1);

    // Shift geometry so the bottom sits exactly on the surface, not intersecting it
    geo.translate(0, geo.parameters.height / 2 || 2, 0);

    const mat = new THREE.MeshBasicMaterial({ 
        color: 0xff00ff, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.8,
        depthTest: false // Render over the mesh
    });

    toolCursor = new THREE.Mesh(geo, mat);
    toolCursor.visible = false;
    core.scene.add(toolCursor);
}

// ── RAYCASTING & SNAPPING LOGIC ──────────────────────────────────────────────
function updateCursorPosition(clientX, clientY) {
    if (!activeTool || !toolCursor) return;

    // Standardize resolving the target mesh (handles decoupled core architectures)
    const targetMesh = core.selectedMesh || window.msh;
    if (!targetMesh) return;

    // Convert mouse to normalized device coordinates
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, core.camera);
    const hits = raycaster.intersectObject(targetMesh);

    if (hits.length > 0) {
        toolCursor.visible = true;
        const hit = hits[0];

        // 1. Move to intersection point
        toolCursor.position.copy(hit.point);

        // 2. Surface Snapping: Align Up-vector to world-space normal
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(targetMesh.matrixWorld);
        const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        
        toolCursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), worldNormal);

        // 3. Right-Click Orientation transform (Local Z rotation)
        toolCursor.rotateZ(toolOrientation);

    } else {
        // Hide if not hovering over the mesh
        toolCursor.visible = false;
    }
}

// ── EVENT LISTENERS ──────────────────────────────────────────────────────────
function onPointerMove(e) {
    if (!activeTool) return;

    updateCursorPosition(e.clientX, e.clientY);

    // Gesture Detection
    if (isDragging) {
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        
        // Apply deadzone to filter out micro-jitters
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            if (Math.abs(dy) > Math.abs(dx)) {
                console.log(`[TactileTools] SAWING (Vertical) - Speed: ${Math.abs(dy)}`);
            } else {
                console.log(`[TactileTools] SCRAPING (Horizontal) - Speed: ${Math.abs(dx)}`);
            }
        }
    }

    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
}

function onPointerDown(e) {
    if (!activeTool) return;
    
    // Ignore UI clicks
    if (e.target.closest('#ui') || e.target.closest('#tactile-toolbar')) return;
    
    if (e.button === 0) { // Left click
        isDragging = true;
        lastMouse.x = e.clientX;
        lastMouse.y = e.clientY;
    }
}

function onPointerUp(e) {
    if (e.button === 0) isDragging = false;
}

function onContextMenu(e) {
    if (!activeTool) return;
    
    // Ignore UI clicks
    if (e.target.closest('#ui') || e.target.closest('#tactile-toolbar')) return;
    
    e.preventDefault(); // Prevent standard browser menu
    
    // Toggle between 0 and 90 degrees (saw vs scraper)
    toolOrientation = toolOrientation === 0 ? Math.PI / 2 : 0;
    
    // Immediately force an update so the cursor rotates without needing to move the mouse
    updateCursorPosition(lastMouse.x, lastMouse.y);
    console.log(`[TactileTools] Orientation changed: ${toolOrientation === 0 ? 'Saw' : 'Scraper'} mode.`);
}

function onKeyDown(e) {
    if (e.key === 'Escape' && activeTool) {
        dropTool();
    }
}

// ── PLUGIN EXPORT ────────────────────────────────────────────────────────────
export function install(engineCore) {
    if (!engineCore.scene || !engineCore.camera) {
        console.error('Tactile Tools: engineCore missing required properties (scene, camera).');
        return;
    }
    
    core = engineCore;

    // Inject DOM Elements
    injectToolbar();

    // Bind Document Level Input Listeners
    const domElement = core.renderer?.domElement || document;
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);

    console.log('✓ Tactile Tools framework installed.');
}