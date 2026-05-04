import * as THREE from 'three';

// -----------------------------------------------------------------------------
// Constants & Memory Management
// -----------------------------------------------------------------------------
// Ruthless memory management: Pre-allocate a strict buffer. 
// 500,000 points * 3 (x,y,z) * 4 bytes = ~6MB flat allocation.
const MAX_POINTS = 500000;
const positionsBuffer = new Float32Array(MAX_POINTS * 3);
let currentPointIndex = 0; 
let totalPointsCaptured = 0;

let xrSession = null;
let xrRefSpace = null;
let pointCloud = null;
let pointCloudGeometry = null;

// Subsampling rate to prevent thermal throttling on mobile devices
const DEPTH_SUBSAMPLE_STEP = 4; 

// -----------------------------------------------------------------------------
// Placeholder: WASM Surface Reconstruction
// -----------------------------------------------------------------------------
/**
 * Simulates a WASM mesher (e.g., Screened Poisson). 
 * Currently computes the AABB (Axis-Aligned Bounding Box) of the raw point cloud.
 * * @param {Float32Array} pointsBuffer - The flat array of x,y,z coordinates
 * @param {number} pointCount - Total active points to process
 * @returns {THREE.BufferGeometry}
 */
function meshPointCloud(pointsBuffer, pointCount) {
    if (pointCount === 0) return new THREE.BufferGeometry();

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    // Iterate through the flat array to find bounds
    for (let i = 0; i < pointCount * 3; i += 3) {
        const x = pointsBuffer[i];
        const y = pointsBuffer[i + 1];
        const z = pointsBuffer[i + 2];

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;

    const geometry = new THREE.BoxGeometry(width, height, depth);
    geometry.translate(minX + width / 2, minY + height / 2, minZ + depth / 2);
    
    return geometry;
}

// -----------------------------------------------------------------------------
// WebXR Depth Extraction & Rendering
// -----------------------------------------------------------------------------
function setupPointCloud(scene) {
    pointCloudGeometry = new THREE.BufferGeometry();
    pointCloudGeometry.setAttribute('position', new THREE.BufferAttribute(positionsBuffer, 3));
    pointCloudGeometry.setDrawRange(0, 0);

    const material = new THREE.PointsMaterial({
        size: 0.02, // 2cm points
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.8
    });

    pointCloud = new THREE.Points(pointCloudGeometry, material);
    pointCloud.frustumCulled = false; // Disable culling as bounding box changes dynamically
    scene.add(pointCloud);
}

function onXRFrame(time, frame) {
    if (!xrSession) return;
    xrSession.requestAnimationFrame(onXRFrame);

    const pose = frame.getViewerPose(xrRefSpace);
    if (!pose) return;

    for (const view of pose.views) {
        // Require CPU-optimized depth data to feed the JS buffer
        const depthData = frame.getDepthInformation(view);
        if (!depthData) continue;

        const { width, height } = depthData;
        const transformMatrix = view.transform.matrix; // Camera to World
        const projectionMatrix = view.projectionMatrix;
        const inverseProjection = new THREE.Matrix4().copy(new THREE.Matrix4().fromArray(projectionMatrix)).invert();
        const cameraWorldMatrix = new THREE.Matrix4().fromArray(transformMatrix);

        // Extract depth points
        for (let y = 0; y < height; y += DEPTH_SUBSAMPLE_STEP) {
            for (let x = 0; x < width; x += DEPTH_SUBSAMPLE_STEP) {
                const distance = depthData.getDepthInMeters(x, y);
                if (distance === 0 || distance > 3.0) continue; // Ignore dead pixels or scans beyond 3 meters

                // Convert pixel coordinates to Normalized Device Coordinates (NDC)
                const ndcX = (x / width) * 2.0 - 1.0;
                // WebGL NDC Y is inverted relative to image coordinates
                const ndcY = -((y / height) * 2.0 - 1.0); 

                // Unproject to camera space
                const pointCameraSpace = new THREE.Vector4(ndcX, ndcY, -1.0, 1.0);
                pointCameraSpace.applyMatrix4(inverseProjection);
                
                // Scale by real depth distance
                const dir = new THREE.Vector3(pointCameraSpace.x, pointCameraSpace.y, pointCameraSpace.z).normalize();
                dir.multiplyScalar(distance);

                // Transform to world space
                const pointWorldSpace = dir.applyMatrix4(cameraWorldMatrix);

                // Write to ring buffer
                const bufferIndex = currentPointIndex * 3;
                positionsBuffer[bufferIndex] = pointWorldSpace.x;
                positionsBuffer[bufferIndex + 1] = pointWorldSpace.y;
                positionsBuffer[bufferIndex + 2] = pointWorldSpace.z;

                currentPointIndex = (currentPointIndex + 1) % MAX_POINTS;
                if (totalPointsCaptured < MAX_POINTS) totalPointsCaptured++;
            }
        }
    }

    // Flag WebGL to upload the updated typed array slice to the GPU
    pointCloudGeometry.attributes.position.needsUpdate = true;
    pointCloudGeometry.setDrawRange(0, totalPointsCaptured);
}

// -----------------------------------------------------------------------------
// Module Export
// -----------------------------------------------------------------------------
/**
 * Installs the XR Scanner module into the host application.
 * @param {Object} engineCore - The main engine instance containing `scene`, `renderer`, and `setMesh()`
 */
export async function install(engineCore) {
    if (!navigator.xr) {
        console.warn('WebXR not supported in this browser.');
        return;
    }

    const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!isSupported) {
        console.warn('Immersive AR not supported.');
        return;
    }

    // Inject UI Button
    const scanBtn = document.createElement('button');
    scanBtn.innerText = 'START SCAN';
    scanBtn.style.cssText = `
        position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);
        padding: 15px 30px; font-size: 18px; font-weight: bold; font-family: monospace;
        background: #00ffcc; color: #020008; border: none; border-radius: 8px;
        cursor: pointer; z-index: 9999; box-shadow: 0 4px 15px rgba(0,255,204,0.4);
    `;
    document.body.appendChild(scanBtn);

    let isScanning = false;

    scanBtn.addEventListener('click', async () => {
        if (isScanning) {
            // STOP SCAN
            xrSession.end();
            return;
        }

        // START SCAN
        try {
            xrSession = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['depth-sensing'],
                depthSensing: {
                    // CPU required to pull raw Float32 data into JS context
                    usagePreference: ['cpu-optimized'],
                    dataFormatPreference: ['luminance-alpha']
                }
            });

            isScanning = true;
            scanBtn.innerText = 'FINISH SCAN';
            scanBtn.style.background = '#ff0055';
            
            // Engine setup
            engineCore.renderer.xr.enabled = true;
            engineCore.renderer.xr.setReferenceSpaceType('local');
            await engineCore.renderer.xr.setSession(xrSession);
            
            setupPointCloud(engineCore.scene);

            xrRefSpace = await xrSession.requestReferenceSpace('local');
            xrSession.requestAnimationFrame(onXRFrame);

            // Handle Session End
            xrSession.addEventListener('end', () => {
                isScanning = false;
                scanBtn.innerText = 'START SCAN';
                scanBtn.style.background = '#00ffcc';
                
                // Cleanup Live Point Cloud
                engineCore.scene.remove(pointCloud);
                if(pointCloudGeometry) pointCloudGeometry.dispose();
                if(pointCloud.material) pointCloud.material.dispose();

                // Generate WASM Mesh and pass to engine
                console.log(`Processing ${totalPointsCaptured} points...`);
                const finalMeshGeometry = meshPointCloud(positionsBuffer, totalPointsCaptured);
                engineCore.setMesh(finalMeshGeometry);

                // Reset state
                currentPointIndex = 0;
                totalPointsCaptured = 0;
                xrSession = null;
            });

        } catch (err) {
            console.error('Failed to start WebXR Depth Session:', err);
            alert('LiDAR/Depth Sensor not available or permission denied.');
        }
    });
}