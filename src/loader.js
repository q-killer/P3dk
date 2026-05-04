/**
 * P3dK // UNIVERSAL LOADER MODULE
 * Handles STL, OBJ, PLY, and 3MF (Array Export + Auto-Packer + Floor Snap)
 */
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import * as fflate from 'three/addons/libs/fflate.module.js';

export const loadModel = (file) => {
    return new Promise((resolve, reject) => {
        const ext = file.name.split('.').pop().toLowerCase();
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                let geometries = [];
                const data = e.target.result;

                // 1. Parse into array
                if (ext === 'stl') geometries.push(new STLLoader().parse(data));
                else if (ext === 'ply') geometries.push(new PLYLoader().parse(data));
                else if (ext === 'obj') {
                    const result = new OBJLoader().parse(data);
                    result.traverse(child => { 
                        if (child.isMesh) {
                            child.updateMatrixWorld(true);
                            geometries.push(child.geometry.clone().applyMatrix4(child.matrixWorld));
                        }
                    });
                } else if (ext === '3mf') {
                    try {
                        const result = new ThreeMFLoader().parse(data);
                        result.traverse(child => { 
                            if (child.isMesh) {
                                child.updateMatrixWorld(true);
                                geometries.push(child.geometry.clone().applyMatrix4(child.matrixWorld));
                            }
                        });
                    } catch (err) {
                        console.warn("> ThreeMFLoader crashed. Engaging Raw XML Extractor...");
                        const unzipped = fflate.unzipSync(new Uint8Array(data));
                        for (const filename in unzipped) {
                            if (filename.endsWith('.model')) {
                                const xmlStr = new TextDecoder().decode(unzipped[filename]);
                                const doc = new DOMParser().parseFromString(xmlStr, "application/xml");
                                doc.querySelectorAll('object').forEach(obj => {
                                    const vertices = obj.querySelectorAll('vertex');
                                    const triangles = obj.querySelectorAll('triangle');
                                    if (vertices.length > 0 && triangles.length > 0) {
                                        const pos = new Float32Array(triangles.length * 9);
                                        const vArr = new Float32Array(vertices.length * 3);
                                        let vIdx = 0, pIdx = 0;
                                        vertices.forEach(v => { vArr[vIdx++] = parseFloat(v.getAttribute('x')); vArr[vIdx++] = parseFloat(v.getAttribute('y')); vArr[vIdx++] = parseFloat(v.getAttribute('z')); });
                                        triangles.forEach(t => {
                                            const v1 = parseInt(t.getAttribute('v1')) * 3, v2 = parseInt(t.getAttribute('v2')) * 3, v3 = parseInt(t.getAttribute('v3')) * 3;
                                            pos[pIdx++] = vArr[v1]; pos[pIdx++] = vArr[v1+1]; pos[pIdx++] = vArr[v1+2]; pos[pIdx++] = vArr[v2]; pos[pIdx++] = vArr[v2+1]; pos[pIdx++] = vArr[v2+2]; pos[pIdx++] = vArr[v3]; pos[pIdx++] = vArr[v3+1]; pos[pIdx++] = vArr[v3+2];
                                        });
                                        const geo = new THREE.BufferGeometry();
                                        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                                        geometries.push(geo);
                                    }
                                });
                            }
                        }
                    }
                } else throw new Error(`Unsupported format: .${ext}`);

                if (!geometries.length) throw new Error("No mesh found in file.");

                // 2. Rotate FIRST, then compute bounds
                geometries.forEach(g => {
                    if (['stl', 'ply', '3mf'].includes(ext)) g.rotateX(-Math.PI / 2);
                    g.computeVertexNormals();
                    g.computeBoundingBox();
                });

                // 3. Auto-Pack & Snap to Floor
                let currentX = 0;
                geometries.forEach(g => {
                    const bb = g.boundingBox;
                    const w = bb.max.x - bb.min.x;
                    g.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -(bb.max.z + bb.min.z) / 2); // Perfect floor snap
                    g.translate(currentX + (w / 2), 0, 0); // Line them up
                    currentX += w + 10;
                });

                // 4. Center the entire assembly on the grid
                geometries.forEach(g => g.computeBoundingBox());
                const tBB = new THREE.Box3();
                geometries.forEach(g => tBB.union(g.boundingBox));
                const offsetX = -(tBB.max.x + tBB.min.x) / 2;
                const offsetZ = -(tBB.max.z + tBB.min.z) / 2;
                geometries.forEach(g => g.translate(offsetX, 0, offsetZ));

                resolve(geometries);
            } catch (err) { reject(new Error(`Failed to parse: ${err.message}`)); }
        };
        reader.onerror = () => reject(new Error("Browser file read error."));
        ext === 'obj' ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
    });
};