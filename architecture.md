# P3dK — Architecture Specification v4.0
## "The Pantheon Release"
**p3dk.com | Zero-install | CDN-first | PEAK IS PEAK.**

---

## The One-Paragraph Pitch

P3dK is the only tool that takes a phone scan from raw depth data to a
physics-optimised, beautifully-supported, print-ready STL — entirely in
a browser tab, with zero installs, on any modern phone.
A $50,000 aerospace workflow. Free. In your pocket.

---

## Why This Is Possible Now

Three things converged in 2023-2024 that make P3dK viable:

1. **manifold-3d WASM** — guaranteed watertight booleans in a browser.
   Without this, topology optimisation and CFD produce garbage.
   P3dK already has this working. This is the hard part. It's done.

2. **WebXR Depth API** — raw LiDAR/ARCore depth maps accessible from JS.
   PoissonRecon compiled to WASM closes the quality gap with Polycam.

3. **Web Workers + WebGPU** — heavy compute (SIMP, CFD, splat sort)
   runs off the main thread without blocking the UI.
   Real-time slider feedback on topology optimisation is now feasible.

---

## CDN-First Philosophy

**We import, not reimplement.**
Every heavy algorithm that already exists as an open-source library
gets compiled to WASM once and hosted on jsDelivr via the GitHub repo.
We write the thin JS wrappers, the UI, and the pipeline glue.

| Algorithm | Source | Our work |
|---|---|---|
| Boolean CSG | manifold-3d (npm) | ✅ already wired |
| Surface reconstruction | PoissonRecon (C++) | compile once → WASM |
| Topology optimisation | TopOptWeb / SIMP88 (JS) | port to 3D + Web Worker |
| Gaussian splat render | GaussianSplats3D (npm) | import + wire to loader |
| CFD fluid sim | custom GLSL shaders | already written |
| Erosion solver | custom C/Rust kernel | compile once → WASM |

**The rule:** if an algorithm exists as open-source C++/Rust/JS,
we compile or import it. We only write new code for pipeline glue,
UI, and features that genuinely don't exist anywhere.

---

## What We Never Build Again

- A mesh boolean engine (manifold-3d owns this)
- A 3D renderer (Three.js owns this)
- A Gaussian splat renderer (GaussianSplats3D owns this)
- A surface reconstruction algorithm (PoissonRecon owns this)
- A topology optimisation solver (SIMP88 owns this, we extend to 3D)

---

## The Full Feature Stack

### TIER 1 — Unique combination nobody else ships

```
◉  INDRA'S NET          WebXR scan → PoissonRecon WASM → manifold mesh
✦  SUPPORT FOUNDRY      Classical columns + Grapevine L-system vines
Φ  FIBONACCI LOOM       12 mathematical pattern CSG cuts
⚗  ARCHITECT'S COMPASS  SIMP topology optimisation + material + load constraints
↔  ELONGATE             Region stretch: select plane, offset N copies, stitch
```

### TIER 2 — Browser-first, technically impressive

```
Ψ  CFD TUNNEL           100k GPU particle Eulerian advection (airflow analysis)
⚡  SHIVA RASP           AI erosion: CFD + FEA coupled lightweighting
✶  SPLAT FORGE          Gaussian splat viewer + Web Worker trainer
∿  MOULDING FOUNDRY     Classical edge profiles: ogee, ovolo, fillet, chamfer
```

### TIER 3 — Solid utility, better than competitors

```
Σ  I/O                  STL/OBJ/PLY/3MF/GLB load + export, Z-up auto-orient
λ  VISUALS              Material, wireframe, ghost, stars
⊕  HEPHAESTUS PIN       Hole/boss drag placement with telemetry
✂  OCCAM CLEAVER        Twist, slice, hollow, smooth, edge sweep
∞  CONSTRUCTOR          Parametric primitives + op history export
⬡  AUTO-PACKER          Multi-part 10mm grid layout
```

---

## The Killer Workflows

### Prosthetic Limb
```
Phone scan of residual limb (Indra's Net)
  → watertight mesh (PoissonRecon WASM + manifold)
  → topology optimisation: fix socket faces, load = body weight
    (Architect's Compass — removes 40-60% material)
  → classical column supports (Support Foundry)
  → export STL → print
```
**Before P3dK:** Orthotist + CAD specialist + $15,000 software + 2 weeks
**With P3dK:** One person, one phone, one browser tab, 20 minutes

### RC Aircraft Skeleton
```
Design or import wing/fuselage mesh
  → CFD analysis: identify aerodynamic load paths (CFD Tunnel)
  → topology opt coupled with CFD: keep load paths, remove drag regions
    (Architect's Compass + Shiva Rasp coupled mode)
  → export printable lattice skeleton
  → cover with fabric, fly
```
**Before P3dK:** Aerospace FEA software ($50k/seat) + CFD suite ($30k/seat)
**With P3dK:** Browser tab. Free tier.

### Custom Phone Case
```
Load STL → too short by 3mm
  → Elongate: select mid-section, offset +3mm, stitch
  → Fibonacci Loom: hex pattern cut into back face
  → export STL → print
```
**Time: 90 seconds.**

### Scan → Art Object
```
Scan sculpture/object (Indra's Net)
  → Splat Forge: generate .splat for beautiful social sharing
  → patterns + support foundry for printable version
  → two outputs: gorgeous visual + printable mesh
```

---

## Module Map

```
p3dk/
│
├── index.html          25KB — CSS, HTML shell, scope manager, importmap
│                       main.js inlined for blob:// compat (claude.ai)
│
├── main.js             20KB — scene, loader, events, IDB session, render loop
│                       Lazy panel loader: import('./src/X.js') on first open
│
└── src/                Lazy modules — load only when panel opens
    │
    ├── ALWAYS LOADED (tiny, boot-critical)
    ├── manifold.js     7KB + 800KB WASM — CSG kernel, boots in background
    ├── viewcube.js     5KB — orientation cube, theme-aware
    │
    ├── TIER 1 — The Differentiators
    ├── xr-scanner.js   15KB — WebXR depth capture, ring buffer, MC fallback
    ├── reconstruct.js  8KB + 480KB WASM — PoissonRecon, TSDF, normal est.
    ├── splat.js        50KB — GaussianSplats3D import + Web Worker trainer
    ├── support.js      20KB — overhang scan, columns, L-system vines
    ├── patterns.js     15KB — 12 pattern generators, clip pipeline
    ├── executor.js     8KB — CSG execution, bevel, skin-deep
    ├── topo-opt.js     12KB — SIMP 3D, Web Worker, material library
    │                          import: TopOptWeb algorithm (JS, no WASM needed)
    ├── elongate.js     6KB — region select, duplicate, offset, stitch
    │
    ├── TIER 2 — Power features
    ├── cfd.js          27KB — 100k GPU particles, Data3DTexture Eulerian
    ├── erosion.js      10KB + 150KB WASM — CFD+FEA coupled erosion kernel
    ├── moulding.js     12KB — edge loop detect, profile library, CSG sweep
    │
    ├── TIER 3 — Core utility
    ├── sculpt.js       5KB — twist, slice, hollow, smooth
    ├── kinetic.js      4KB — hole/boss drag FSM, telemetry
    ├── exporter.js     8KB — STL/PLY/3MF/OBJ/GLB, CRC32 ZIP
    ├── constructor.js  8KB — primitives, op history, macro parser
    └── auto-packer.js  5KB — bbox layout, 10mm spacing
```

**Total if user opens every panel:** ~340KB JS + ~1.4MB WASM (cached after first load)
**On first open (shell only):** ~46KB — loads in under 1 second on 4G

---

## WASM Build Pipeline

One-time builds. Outputs hosted in `/wasm/` on GitHub, served via jsDelivr.
Never needs rebuilding unless upstream source changes.

```bash
# PoissonRecon — run once in Termux or GitHub Actions CI
git clone https://github.com/mkazhdan/PoissonRecon
emcc PoissonRecon/Src/PoissonRecon.cpp -O3 \
  -s WASM=1 -s MODULARIZE=1 \
  -s EXPORTED_FUNCTIONS='["_reconstruct"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -o wasm/poisson.js
# → wasm/poisson.js (~80KB) + wasm/poisson.wasm (~400KB)

# Erosion solver — custom Rust kernel
cargo install wasm-pack
wasm-pack build --target web --out-dir wasm/erosion
# → wasm/erosion_bg.wasm (~150KB)
```

**CDN load pattern (same for all WASM modules):**
```js
const CDNS = [
  'https://cdn.jsdelivr.net/gh/YOUR_REPO@main/wasm/',
  'https://unpkg.com/p3dk-wasm@latest/wasm/'
];
for (const cdn of CDNS) {
  try {
    const mod = await import(cdn + 'module.js');
    instance = await mod.default({ locateFile: f => cdn + f });
    break; // success
  } catch(e) { continue; } // try next CDN
}
// Graceful degrade if all fail — show message, disable feature
```

---

## Topology Optimisation Architecture

The SIMP algorithm is already proven in JS (TopOptWeb). P3dK extends it:

```
INPUT:
  mesh (watertight — guaranteed by manifold-3d)
  constraints: array of {faceIds, type: 'fixed'|'load', direction, magnitude}
  material: {E: modulus, nu: poisson_ratio, yield: MPa}
  targetMass: 0.3 to 0.9

WEB WORKER PIPELINE:
  1. Voxelise mesh (resolution = slider: 5-20mm, coarse for preview)
  2. Map constraints to voxel grid
  3. SIMP iterations:
     a. Assemble stiffness matrix (diagonal approx for speed)
     b. Conjugate gradient solve → displacement field
     c. Compute sensitivity (strain energy per voxel)
     d. Update density: remove low-sensitivity voxels
     e. Filter (checkerboard suppression)
     f. Repeat until Δdensity < tol OR targetMass reached
  4. Marching cubes → BufferGeometry
  5. manifold-3d validation → watertight confirmed
  6. postMessage(geometry) → main thread renders preview

REAL-TIME SLIDER:
  - Coarse (20mm voxels): ~5s per solve → slider feels live
  - Medium (10mm voxels): ~30s → "preview" button
  - Fine (5mm voxels): ~120s → "bake" button, Web Worker

MATERIAL LIBRARY (presets):
  PLA:   E=3.5GPa,  nu=0.36, yield=50MPa,  density=1.24g/cc
  PETG:  E=2.1GPa,  nu=0.38, yield=45MPa,  density=1.27g/cc
  ABS:   E=2.3GPa,  nu=0.35, yield=40MPa,  density=1.05g/cc
  Nylon: E=3.0GPa,  nu=0.39, yield=75MPa,  density=1.15g/cc
  Metal: E=200GPa,  nu=0.30, yield=250MPa, density=7.85g/cc
```

---

## CFD + Topology Coupling

When both modules are loaded, they share the voxel grid:

```js
// In erosion.js — coupled mode
const stressField = topoOpt.getSensitivityField();  // from SIMP
const dragField   = cfd.getDragField();              // from CFD particles

// Voxel survives if EITHER load is significant
const keepVoxel = v =>
  stressField[v] > STRESS_THRESHOLD ||
  dragField[v]   > DRAG_THRESHOLD;

// Remove voxels where neither structural nor aerodynamic load exists
```

This is what $80,000/seat Altair HyperWorks does.
P3dK does it in a Web Worker, free, on a phone.

---

## Monetisation Tiers

```
FREE (always)
  ├── Load/export STL/OBJ/PLY/3MF/GLB
  ├── Pattern cuts (Fibonacci Loom)
  ├── Sculpt tools (Occam Cleaver)
  ├── Kinetic builder (Hephaestus Pin)
  ├── Basic support generation (plain cylinders only)
  ├── ViewCube, undo/redo, session save
  └── P3dK.com watermark on support base discs (viral marketing)

PRO KEY — one-time payment via Gumroad (~$29)
  ├── Full Support Foundry (Doric/Ionic/Gothic + Grapevine vines)
  ├── Topology optimisation (Architect's Compass)
  ├── AI erosion lightweighting (Shiva Rasp)
  ├── CFD + topology coupling
  ├── Gaussian splat training (Splat Forge)
  ├── Classical edge profiles (Moulding Foundry)
  └── No watermark on supports

STUDIO KEY — one-time payment (~$99)
  ├── Everything in Pro
  ├── Batch processing (multiple files)
  ├── Custom material library
  ├── Export full op-history + replay macros
  └── Priority support
```

---

## Deployment

```
git push → GitHub Actions → GitHub Pages → p3dk.com

Zero config. Zero build step. Zero server costs.
Three.js from jsDelivr. WASM from jsDelivr (your repo).
Your hosting cost: $0/month.
```

---

## AI Session Protocol

**Start every session:**
> "Read ARCHITECTURE.md. Today we are working on [ONE FILE ONLY].
> Import existing libraries. Do not reimplement algorithms that exist.
> Do not modify any other files."

**Status:**
- ✅ WORKING: load/export, manifold CSG, patterns, sculpt, session IDB
- 🔧 WRITTEN/NEEDS TEST: support.js, xr-scanner.js
- 📋 PLANNED: reconstruct.js, topo-opt.js, elongate.js, splat.js
- 🔮 FUTURE: erosion.js, moulding.js, auto-packer.js

**Next concrete step:**
Push to GitHub → open on S21 Ultra → test support.js on real STL.
Everything else is a multiplier on a foundation that needs device validation.
