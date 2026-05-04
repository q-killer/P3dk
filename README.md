# P3dK // FAB ENGINE (V39 Alpha)
**Code is Poetry. Computation is Art. PEAK IS PEAK.**

P3dK is a browser-native, computationally mathematically driven CAD and Eulerian CFD (Flow) engine. 

Our ultimate engineering goal is to maintain a fully-featured, watertight boolean solid modeling application—complete with sculpting, procedural generation, dynamic fluid simulation, and a full 3D flight demo—within an absolute minimal footprint (targeting a 75kB compiled production artifact).

## 🚀 Architecture: The Dev/Prod Split
To maintain our demoscene-level file size while keeping the codebase highly readable for human and AI collaboration, P3dK uses a strict split:

1. **Development Mode (`dev.html`):** Uses native browser ES Modules. Zero compilation step. Instant Hot Module Replacement (HMR) / refresh. 
2. **Production Mode ("The Crusher"):** Our future build pipeline will inline all modules, ruthlessly mangle variables via Google Closure Compiler, pack the math using Roadroller, and spit out a single `<75kB` `index.html` artifact.

## 📂 Modular File Structure
The monolithic core has been decoupled. **DO NOT** write code in the global `window.*` scope. 

/p3dk-project
│── dev.html                (Main UI, Canvas, and Module HUD)
│── styles.css              (Minimalist CSS, Day/Night themes)
│
├── /src                    (The Base Engine - Loads Instantly)
│   ├── core.js             (Three.js, Raycaster, Glass Minimap)
│   ├── ui-manager.js       (DOM events, file input, theme toggles)
│   ├── plugin-manager.js   (Dynamic importer for modules)
│   ├── loader.js           (3MF/STL/OBJ/GLB universal ingestion)
│   └── exporter.js         (Smart single-part/assembly exporter)
│
└── /src/modules            (The Plugins - Loaded on Demand)
    ├── wave-generator.js   (✅ Written)
    ├── photo-forge.js      (✅ Written)
    ├── xr-scanner.js       (⏳ Delegated to AI)
    ├── art-supports.js     (⏳ Delegated to AI)
    ├── csg-engine.js       (⏳ Delegated to AI)
    ├── math-brush.js       (⏳ Delegated to AI)
    ├── calibration-gen.js  (⏳ Delegated to AI)
    ├── classical-trim.js   (⏳ Delegated to AI)
    └── scan-healer.js      (⏳ Delegated to AI)
\`\`\`

## ⚙️ Core Dependencies (CDN)
To protect our payload size, heavy lifting is strictly delegated to CDNs:
* **Three.js (r160):** WebGL rendering.
* **Manifold3D (v2.5.1):** WASM C++ geometry kernel. The Blender "Exact" boolean equivalent. Guaranteed manifold output by mathematical proof.

# P3dK: Universal Web-CAD & Reality Capture Engine
**Architecture Specification v1.2**

## PHASE 1: Core Layout Engine (Stable)
* **Universal Loader:** 3MF/STL/OBJ ingestion with multi-part grid auto-packing.
* **Cinematic HUD:** WebGL raycaster, part isolation, and orthographic glass minimap.
* **Plugin Manager:** Dynamic CDN module loader to maintain a zero-install, lightweight core.

## PHASE 2: Reality Capture & Auto-Healing
* **WebXR Scanner:** Hardware-level depth map extraction via mobile ARCore/LiDAR.
* **Scan Healer:** WASM-powered Marching Cubes (Splat-to-Mesh), Taubin Volume-Preserving Smoothing, and Planar Decimation (snapping lumpy scans into flat CAD surfaces).

## PHASE 3: CSG Pre-Processor & Modder
* **WASM Booleans:** Instant planar bottom-cuts and hollowing/drainage hole punching.
* **Wave Overhangs:** Mathematical Z-axis rippling to bypass proprietary slicer supports.

## PHASE 4: Sculptural Support Foundry
* **Classical Architecture Generator:** Parametric Roman columns (CSG) acting as primary support structures.
* **Grapevine Algorithms:** L-System mathematical vines that wrap the columns and use microscopic, scar-free breakaway interface pins to support the target mesh.

## PHASE 5: The Tactile Workbench
* **Skeuomorphic Toolset:** Raycast-driven 3D cursors locked to mesh surface normals.
* **Tools:** Butter Knife (WASM Trenching/Scraping), Rasp (Erosion/Sanding), Masking Tape (Vertex Weight Exclusion Zones), 3D Pen (Path-to-Tube Extrusion).