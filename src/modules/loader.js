/**
 * P3dK // DEMOSCENE ASCII STL LOADER
 * Zero-dependency, zero-bloat regex parsing. 
 * Converts Z-up to Y-up, centers X/Z, and floors Y to 0.
 */
import * as T from 'three';

export async function loadModel(f) {
  let t = await f.text(), 
      v = [], 
      m, 
      r = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  
  // Tight exec loop: skips normals/loops, rips raw vertex floats directly
  while (m = r.exec(t)) v.push(+m[1], +m[2], +m[3]);

  let g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(v, 3));

  // Z-up to Y-up conversion
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();

  // Single-letter vector math constraint:
  // b = boundingBox, x = max, n = min, c = center offset
  let b = g.boundingBox, 
      x = b.max, 
      n = b.min, 
      c = x.clone().add(n).multiplyScalar(-0.5);
  
  // Center X/Z, rest bottom on Y=0
  g.translate(c.x, -n.y, c.z);
  
  // Generate normals for lighting
  g.computeVertexNormals();
  
  return g;
}