# P3dK // Contributor & AI Guidelines

Welcome to the P3dK Engine. We write high-performance, demoscene-inspired code. If you are submitting a PR (or if you are an AI generating a module), you must adhere to these strict engineering constraints.

## 1. Zero Garbage Collection in Render Loops
Do **not** instantiate objects inside `requestAnimationFrame` loops. 
* 🚫 **BAD:** `let dir = new THREE.Vector3().subVectors(a, b);` (Inside a loop)
* ✅ **GOOD:** Pre-allocate vectors globally (`const _dir = new T.Vector3();`) and reuse them (`_dir.subVectors(a, b);`).

## 2. Code Golfing & Math Optimization
* Use bitwise operations for rounding positive numbers: `Math.floor(x)` -> `x | 0`.
* Keep internal variables terse if their context is obvious (e.g., `let g = mesh.geometry; let p = g.attributes.position;`). Exported functions and class names should remain verbose for the linker.
* Do not use heavy array methods (`.map`, `.filter`) inside high-frequency physics loops. Use raw `for(let i=0; i<len; i++)` loops.

## 3. Strict ES Modules
No global variables. No attaching functions to `window.exeC`. 
* All tools must export their functionality.
* The `ui-manager.js` is solely responsible for bridging the DOM to the ES modules.

## 4. No Local Static Assets
Do not add `.png`, `.jpg`, `.wav`, or `.mp3` files to this repository. 
* All textures must be generated mathematically (e.g., Canvas 2D API, WebGL Shaders, Simplex Noise).
* All audio must be synthesized via the Web Audio API, or loaded from an external CDN tracker (e.g., `.mod` / `.xm` chiptune files).