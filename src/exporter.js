/**
 * P3dK // EXPORTER MODULE
 */
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { PLYExporter } from 'three/addons/exporters/PLYExporter.js';

export const exportModel = (mesh, format, filename = 'P3dK-Export') => {
    if (!mesh) return;
    const link = document.createElement('a');

    if (format === 'stl') {
        const data = new STLExporter().parse(mesh);
        link.href = URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
        link.download = `${filename}.stl`;
        link.click();
    } else if (format === 'obj') {
        const data = new OBJExporter().parse(mesh);
        link.href = URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
        link.download = `${filename}.obj`;
        link.click();
    } else if (format === 'ply') {
        const data = new PLYExporter().parse(mesh, ['position', 'normal']);
        link.href = URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
        link.download = `${filename}.ply`;
        link.click();
    } else if (format === 'glb') {
        const scene = new THREE.Scene();
        scene.add(mesh.clone());
        new GLTFExporter().parse(scene, (glb) => {
            link.href = URL.createObjectURL(new Blob([glb], { type: 'application/octet-stream' }));
            link.download = `${filename}.glb`;
            link.click();
        }, (err) => console.error(err), { binary: true });
    }
};