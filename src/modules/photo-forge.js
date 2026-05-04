/**
 * P3dK MODULE // PHOTO-FORGE
 * Converts 2D Images (JPG/PNG) into 3D Displacement Meshes locally.
 */
import * as THREE from 'three';

export const install = (engineCore) => {
    console.log("🔌 Plugin Loaded: Photo-Forge");

    // 1. Inject UI Upload Button
    const modSys = document.getElementById('modSys').querySelector('.pnl-body');
    const wrap = document.createElement('div');
    wrap.style.cssText = "margin-top: 10px; display: flex; gap: 5px;";
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png, image/jpeg';
    fileInput.style.display = 'none';

    const forgeBtn = document.createElement('button');
    forgeBtn.className = 'btn';
    forgeBtn.style.cssText = "flex: 1; background: #332200; color: #ffaa00; border: 1px solid #ffaa00;";
    forgeBtn.textContent = "🖼️ GENERATE 3D RELIEF";
    
    wrap.appendChild(fileInput);
    wrap.appendChild(forgeBtn);
    modSys.appendChild(wrap);

    const sS = msg => { const e = document.getElementById('sts'); if(e) e.textContent = msg; };

    forgeBtn.addEventListener('click', () => fileInput.click());

    // 2. The Lithophane/Displacement Engine
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        sS("> EXTRUDING PHOTO TO 3D...");

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // A. Draw image to an invisible canvas to read pixel brightness
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Downscale slightly for performance (Max 512x512 resolution for the mesh)
                const maxDim = 512;
                let w = img.width, h = img.height;
                if (w > maxDim || h > maxDim) {
                    const ratio = Math.min(maxDim / w, maxDim / h);
                    w = Math.floor(w * ratio); h = Math.floor(h * ratio);
                }
                canvas.width = w; canvas.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h).data;

                // B. Create a high-density flat mesh to displace
                // (e.g., 100x100mm physical size, with w x h segments)
                const geo = new THREE.PlaneGeometry(100, 100 * (h/w), w - 1, h - 1);
                const pos = geo.attributes.position;
                
                const maxExtrusion = 5.0; // Maximum Z height in mm

                // C. Displace vertices based on pixel brightness (Grayscale)
                for (let i = 0; i < pos.count; i++) {
                    // ImageData is RGBA (4 values per pixel)
                    const r = imgData[i * 4];
                    const g = imgData[i * 4 + 1];
                    const b = imgData[i * 4 + 2];
                    
                    // Standard luminance formula
                    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0; 
                    
                    // Extrude the Z axis (White = High, Black = Low)
                    pos.setZ(i, brightness * maxExtrusion);
                }

                geo.computeVertexNormals();
                geo.rotateX(-Math.PI / 2); // Lay it flat on the bed

                // Send to core engine
                engineCore.setMesh(geo);
                sS(`> GENERATED RELIEF: ${(pos.count).toLocaleString()} VERTS`);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
};