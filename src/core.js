import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initScene } from './scene.js';
import { initUI } from './ui-manager.js';

const boot = async () => {
    console.log("🚀 P3dK Engine: HUD & Raycaster Active...");
    
    const { scene, camera, renderer } = initScene();
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2;
    
    // --- HUD MINIMAP (Glass Layout View) ---
    const mapDiv = document.createElement('div');
    mapDiv.style.cssText = "position:absolute;top:20px;right:20px;width:220px;height:220px;background:rgba(0,229,255,0.05);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(0,229,255,0.2);border-radius:12px;z-index:999;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,0.3);";
    document.body.appendChild(mapDiv);
    
    const mapRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    mapRenderer.setSize(220, 220);
    mapDiv.appendChild(mapRenderer.domElement);
    
    const mapCam = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 1000);
    mapCam.position.set(0, 300, 0); // Looking straight down at the bed
    mapCam.lookAt(0, 0, 0);

    // --- RAYCASTER (Part Selection & Cinematic Pan) ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let activeTarget = new THREE.Vector3(0, 0, 0);

    window.addEventListener('pointerdown', (e) => {
        if (e.target.closest('#ui') || e.target.closest('.pnl')) return; // Ignore UI clicks
        
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        
        if (engineCore.meshGroup) {
            const hits = raycaster.intersectObjects(engineCore.meshGroup.children);
            engineCore.meshGroup.children.forEach(m => m.material.emissive.setHex(0x000000)); // Reset glow

            if (hits.length > 0) {
                const hit = hits[0].object;
                hit.material.emissive.setHex(0x004455); // Highlight selected
                hit.geometry.computeBoundingSphere();
                const center = hit.geometry.boundingSphere.center.clone();
                hit.localToWorld(center);
                activeTarget.copy(center); // Set new camera target
            } else {
                // Clicked empty space, return to center
                activeTarget.set(0, engineCore.floorHeight || 0, 0);
            }
        }
    });

    // --- ENGINE STATE ---
    const engineCore = {
        scene, camera, renderer, controls, meshGroup: new THREE.Group(), floorHeight: 0,
        
        setMesh(geometries) {
            while(this.meshGroup.children.length) {
                const m = this.meshGroup.children[0];
                this.meshGroup.remove(m);
                m.geometry.dispose(); m.material.dispose();
            }
            this.scene.add(this.meshGroup);

            const geos = Array.isArray(geometries) ? geometries : [geometries];
            const mat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
            const totalBB = new THREE.Box3();

            geos.forEach(geo => {
                const mesh = new THREE.Mesh(geo, mat.clone());
                this.meshGroup.add(mesh);
                geo.computeBoundingBox();
                totalBB.union(geo.boundingBox);
            });

            const sy = totalBB.max.y;
            const md = Math.max(totalBB.max.x - totalBB.min.x, sy, totalBB.max.z - totalBB.min.z);
            
            this.floorHeight = sy / 2;
            this.camera.position.set(0, sy + (md * 0.5), md * 1.5);
            activeTarget.set(0, this.floorHeight, 0);
            
            // Frame the minimap perfectly
            mapCam.left = -md * 0.6; mapCam.right = md * 0.6;
            mapCam.top = md * 0.6; mapCam.bottom = -md * 0.6;
            mapCam.updateProjectionMatrix();
        }
    };
    
    initUI(engineCore);
    
    const loop = () => {
        requestAnimationFrame(loop);
        controls.target.lerp(activeTarget, 0.08); // Cinematic smoothing
        controls.update(); 
        renderer.render(scene, camera);
        mapRenderer.render(scene, mapCam); // Draw HUD
    };
    loop();
};

window.onload = boot;