/**
 * P3dK // UI MANAGER & EVENT GLUE
 */

import { loadModel } from './loader.js';
import { exportModel } from './exporter.js';
// import { playBlip, toggleRadio } from './audio.js';
// import { FlightDemo } from './flight-demo.js';

export function initUI(engineCore) {
    const $ = id => document.getElementById(id);
    const sS = msg => { const e = $('sts'); if(e) e.textContent = msg; };

    console.log("UI Manager: DOM Bindings Active...");

   // ── 1. GLOBAL UI TOGGLES (Theme & Sidebar) ────────────────────────────
    let themeManualOverride = false;

    const applyTheme = (isLight) => {
        if (isLight) {
            document.documentElement.classList.add('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
        }
        const btn = $('themeToggle');
        if (btn) btn.textContent = isLight ? '🌙' : '🌓';
    };

    const autoTheme = () => {
        if (themeManualOverride) return;
        const h = new Date().getHours();
        const isDay = h >= 7 && h < 20; // 7 AM to 8 PM (19:59)
        applyTheme(isDay);
    };

    // Run the time check immediately on boot, then check every 60 seconds
    autoTheme();
    setInterval(autoTheme, 60000);

    const themeBtn = $('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            themeManualOverride = true; // User took control, stop auto-switching
            const currentlyLight = document.documentElement.classList.contains('light-mode');
            applyTheme(!currentlyLight);
            if (window.playBlip) window.playBlip('click'); // Optional audio
        });
    }

    const uiToggleBtn = $('uiToggleBtn') || $('uiToggle');
    if (uiToggleBtn) {
        uiToggleBtn.addEventListener('click', () => {
            $('ui').classList.toggle('collapsed');
            uiToggleBtn.classList.toggle('collapsed');
            uiToggleBtn.textContent = uiToggleBtn.classList.contains('collapsed') ? '▶' : '◀';
            if (window.playBlip) window.playBlip('click'); // Optional audio
        });
    }

    // ── 2. PANEL ACCORDION LOGIC ──────────────────────────────────────────
    document.querySelectorAll('.pnl-hdr').forEach(hdr => {
        hdr.addEventListener('click', () => {
            const body = hdr.nextElementSibling;
            if (body) {
                body.classList.toggle('hidden');
                hdr.classList.toggle('closed');
            }
        });
    });

// ── 3. I/O (SMART EXPORTER) ───────────────────────
    const fileInput = $('F');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            // Grab just the FIRST file to keep loader.js happy
            const file = e.target.files[0];
            if (!file) return;
            
            sS(`> LOADING: ${file.name}...`);
            
            try {
                // Pass the single file into your existing loader
                const meshes = await loadModel(file);
                engineCore.setMesh(meshes);
                
                // Add up all the triangles across all parts robustly
                let tris = 0;
                // Check if meshes is an array, if not wrap it
                const meshArray = Array.isArray(meshes) ? meshes : [meshes];
                
                meshArray.forEach(m => {
                    const geometry = m.isBufferGeometry ? m : m.geometry;
                    if (geometry && geometry.attributes && geometry.attributes.position) {
                        tris += Math.floor(geometry.attributes.position.count / 3);
                    }
                });
                
                const baseFilename = file.name.split('.')[0];
                sS(`> LOADED: ${tris} TRIS [${file.name}]`);
                
                // Auto-close the loader panel (Using the safe panelSystem variable)
                const panelSystem = document.getElementById('pSys');
                if (panelSystem) {
                    const pBody = panelSystem.querySelector('.pnl-body');
                    const pHdr = panelSystem.querySelector('.pnl-hdr');
                    if (pBody) pBody.classList.add('hidden');
                    if (pHdr) pHdr.classList.add('closed');
                }

                // Enable the export buttons and bind them to the smart exporter
                const exportBtns = [
                    { id: 'XPT', fmt: 'stl' },
                    { id: 'XPL', fmt: 'ply' },
                    { id: 'XOBJ', fmt: 'obj' },
                    { id: 'XGLB', fmt: 'glb' }
                ];
                
                exportBtns.forEach(b => {
                    const btn = $(b.id);
                    if (btn) {
                        btn.disabled = false;
                        
                        // Clone to wipe old event listeners and prevent double-exports
                        const newBtn = btn.cloneNode(true);
                        btn.parentNode.replaceChild(newBtn, btn);
                        
                        newBtn.addEventListener('click', () => {
                            // Smart Export: Only export what the user clicked on!
                            const targetMesh = engineCore.selectedMesh || engineCore.meshGroup;
                            const prefix = engineCore.selectedMesh ? 'Part' : 'Assembly';
                            
                            sS(`> EXPORTING ${prefix.toUpperCase()} AS .${b.fmt.toUpperCase()}...`);
                            
                            exportModel(targetMesh, b.fmt, `${baseFilename}-${prefix}-modded`);
                            
                            sS(`> SAVED .${b.fmt.toUpperCase()}`);
                        });
                    }
                });

            } catch (err) {
                sS('> ERR: ' + err.message);
                console.error("Loader Error:", err);
            }
            
            e.target.value = ''; // Reset input
        });
    }

    // ── 4. PATTERN FOUNDRY BINDINGS ───────────────────────────────────────
    const patternSelect = $('PT');
    const charRow = $('charRow');
    if (patternSelect && charRow) {
        patternSelect.addEventListener('change', (e) => {
            const showInput = ['char', 'charSingle', 'svg'].includes(e.target.value);
            charRow.classList.toggle('hidden', !showInput);
        });
    }

    sS('> READY — LOAD A MESH TO BEGIN');
}