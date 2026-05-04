/**
 * P3dK // PATTERN FOUNDRY & VORONOI LATTICE CORE
 * Demoscene-golfed pure math pattern generator.
 * Zero-dependency math, optionally maps to THREE.Shape.
 */
import * as T from 'three';

const M = Math, C = M.cos, S = M.sin, H = M.hypot;

// --- UTILITY MATH ---
// Sutherland-Hodgman Half-plane Clip
const hp = (p, mx, my, nx, ny) => {
  if (!p || p.length < 3) return null; let o = [];
  for (let i = 0, l = p.length; i < l; i++) {
    let c = p[i], r = p[(i + l - 1) % l], 
        dc = (c[0] - mx) * nx + (c[1] - my) * ny, dr = (r[0] - mx) * nx + (r[1] - my) * ny;
    if (dc >= 0) { if (dr < 0) { let t = dr / (dr - dc); o.push([r[0] + t * (c[0] - r[0]), r[1] + t * (c[1] - r[1])]) } o.push(c); } 
    else if (dr >= 0) { let t = dr / (dr - dc); o.push([r[0] + t * (c[0] - r[0]), r[1] + t * (c[1] - r[1])]) }
  }
  return o.length > 2 ? o : null;
};

// AABB Box Clip
const clp = (py, x0, x1, y0, y1) => {
  let I = [p => p[0] >= x0, p => p[0] <= x1, p => p[1] >= y0, p => p[1] <= y1],
      S = [(a, b) => [x0, a[1] + (x0 - a[0]) / (b[0] - a[0]) * (b[1] - a[1])], (a, b) => [x1, a[1] + (x1 - a[0]) / (b[0] - a[0]) * (b[1] - a[1])], (a, b) => [a[0] + (y0 - a[1]) / (b[1] - a[1]) * (b[0] - a[0]), y0], (a, b) => [a[0] + (y1 - a[1]) / (b[1] - a[1]) * (b[0] - a[0]), y1]],
      o = py;
  for (let i = 0; i < 4; i++) {
    if (!o.length) return null; let n = o; o = [];
    for (let j = 0; j < n.length; j++) {
      let c = n[j], p = n[(j + n.length - 1) % n.length], ci = I[i](c), pi = I[i](p);
      if (ci) { if (!pi) o.push(S[i](p, c)); o.push(c); } else if (pi) o.push(S[i](p, c));
    }
  }
  return o.length > 2 ? o : null;
};

// Quadratic Bezier Corner Rounding
const cr = (p, rf) => {
  if (!p || p.length < 3 || rf <= 0) return p; let n = p.length, o = [];
  for (let i = 0; i < n; i++) {
    let r = p[(i + n - 1) % n], c = p[i], x = p[(i + 1) % n], dx = r[0] - c[0], dy = r[1] - c[1], ex = x[0] - c[0], ey = x[1] - c[1], l1 = H(dx, dy), l2 = H(ex, ey);
    if (l1 < .001 || l2 < .001) { o.push(c); continue; }
    let m = M.min(l1, l2) * .49 * rf, p1 = [c[0] + dx / l1 * m, c[1] + dy / l1 * m], p2 = [c[0] + ex / l2 * m, c[1] + ey / l2 * m];
    for (let s = 0; s <= 6; s++) { let t = s / 6, u = 1 - t; o.push([u * u * p1[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * c[1] + t * t * p2[1]]); }
  }
  return o;
};

// Poincaré Hyperbolic Arc
const ha = (ax, ay, bx, by, cx, cy, d) => {
  let o = [], mx = (ax + bx) / 2, my = (ay + by) / 2, dx = cx - mx, dy = cy - my, l = H(dx, dy) || 1, b = H(bx - ax, by - ay) * d * .3, nx = dx / l * b, ny = dy / l * b, px = mx + nx, py = my + ny;
  for (let i = 0; i <= 8; i++) { let t = i / 8, u = 1 - t; o.push([u * u * ax + 2 * u * t * px + t * t * bx, u * u * ay + 2 * u * t * py + t * t * by]); }
  return o;
};

// Array to THREE.Shape (calculates winding area to cull degenerate polys)
const tSh = p => {
  if (!p || p.length < 3) return null; let a = 0, l = p.length;
  for (let i = 0; i < l; i++) a += p[i][0] * p[(i + 1) % l][1] - p[(i + 1) % l][0] * p[i][1];
  if (M.abs(a) * .5 < .04) return null;
  let s = new T.Shape(); s.moveTo(p[0][0], p[0][1]); for (let i = 1; i < l; i++) s.lineTo(p[i][0], p[i][1]); return s;
};

// --- CORE FOUNDRY EXPORT ---
export const Foundry = {
  
  // 3D LATTICE VORONOI LOGIC (Spatial Math)
  lattice3D: (pts, bnd, st) => {
    let { minX: x0, maxX: x1, minY: y0, maxY: y1, minZ: z0, maxZ: z1 } = bnd, cells = [];
    let bb = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]; // 8 corners
    
    for (let i = 0; i < pts.length; i++) {
      let cl = bb.slice(), p = pts[i];
      for (let j = 0; j < pts.length; j++) {
        if (i === j) continue;
        let o = pts[j], nx = p[0] - o[0], ny = p[1] - o[1], nz = p[2] - o[2],
            mx = (p[0] + o[0]) / 2, my = (p[1] + o[1]) / 2, mz = (p[2] + o[2]) / 2;
        // 3D Half-space cull (stubbed mathematical loop logic for polyhedrons)
        // cl = hp3D(cl, mx, my, mz, nx, ny, nz);
      }
      cells.push(cl);
    }
    return cells; // Returns spatial cells to be mapped to geometry
  },

  // 2D PATTERN GENERATOR
  generate: (typ, b, c) => {
    let { sc = 15, st = 2, mg = 2, an = 0, oX = 0, oY = 0, stg = 0, stgH = 0, dn = 1, excl = [], crnR = 0 } = c,
        eSc = sc / dn, rf = crnR / 100, u0 = b.minU + mg, u1 = b.maxU - mg, v0 = b.minV + mg, v1 = b.maxV - mg;
    if (u1 <= u0 || v1 <= v0) return [];
    
    let cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, ext = .6, eu0 = u0 - (u1 - u0) * ext, eu1 = u1 + (u1 - u0) * ext, ev0 = v0 - (v1 - v0) * ext, ev1 = v1 + (v1 - v0) * ext, P = [], buf = eSc * .55;

    // --- VORONOI CELLULAR ---
    if (typ === 'voronoi') {
      let sd = [], md = eSc * (1 - M.min(.9, st / eSc)), rng = (M.round(eSc * 7 + mg * 3)) ^ 0x5f3759df,
          lcg = () => { rng = (rng * 1664525 + 1013904223) | 0; return (rng >>> 0) / 4294967296; };
      for (let i = 0; i < 2000 && sd.length < 200; i++) {
        let tx = eu0 + (eu1 - eu0) * lcg(), ty = ev0 + (ev1 - ev0) * lcg(), ok = 1;
        for (let s of sd) if ((tx - s[0]) ** 2 + (ty - s[1]) ** 2 < md * md) { ok = 0; break; }
        if (ok) sd.push([tx, ty]);
      }
      let bbox = [[eu0 - eSc, ev0 - eSc], [eu1 + eSc, ev0 - eSc], [eu1 + eSc, ev1 + eSc], [eu0 - eSc, ev1 + eSc]];
      for (let i = 0; i < sd.length; i++) {
        let cl = bbox.slice(), sx = sd[i][0], sy = sd[i][1];
        for (let j = 0; j < sd.length; j++) {
          if (i === j) continue; let ox = sd[j][0], oy = sd[j][1];
          cl = hp(cl, (sx + ox) / 2, (sy + oy) / 2, sx - ox, sy - oy);
          if (!cl) break;
        }
        if (!cl || cl.length < 3) continue;
        let cxc = cl.reduce((s, p) => s + p[0], 0) / cl.length, cyc = cl.reduce((s, p) => s + p[1], 0) / cl.length;
        P.push(cl.map(([x, y]) => { let dx = x - cxc, dy = y - cyc, d = H(dx, dy), sf = M.max(0, d - st) / M.max(d, .001); return [cxc + dx * sf, cyc + dy * sf]; }));
      }
    } 
    // --- HYPERBOLIC TRIANGLES ---
    else if (typ === 'hypTri') {
      let h = eSc * .866, ri = M.max(.05, eSc * .45 - st * .65), bd = M.min(1, st / eSc * 2 + .3);
      for (let rw = (ev0 / h) | 0; rw * h < ev1 + h; rw++) {
        let od = rw & 1, xO = od ? (eSc * .5 + stg * eSc * .5) : (stgH * eSc * .5);
        for (let cl = ((eu0 - xO) / eSc) | 0; cl * eSc + xO < eu1 + eSc; cl++) {
          let cx = cl * eSc + xO, cy = rw * h, vs = od ? [[cx - ri, cy - ri * .577], [cx + ri, cy - ri * .577], [cx, cy + ri * 1.155]] : [[cx, cy - ri * 1.155], [cx - ri, cy + ri * .577], [cx + ri, cy + ri * .577]], cvd = [];
          for (let k = 0; k < 3; k++) { let a = vs[k], b = vs[(k + 1) % 3], arc = ha(a[0], a[1], b[0], b[1], cx, cy, bd); for (let s = 0; s < arc.length - 1; s++) cvd.push(arc[s]); }
          P.push(cvd);
        }
      }
    } 
    // --- HEXAGONAL ---
    else if (typ === 'hex') {
      let r = eSc * .5, ri = M.max(.05, r - st * 1.15), rh = r * 1.732;
      for (let rw = (ev0 / rh) | 0; rw * rh < ev1 + rh; rw++) {
        let cy = rw * rh, xO = (rw & 1) ? (r + stg * eSc * .5) : (stgH * eSc * .5);
        for (let cl = ((eu0 - xO) / eSc) | 0; cl * eSc + xO < eu1 + eSc; cl++) {
          let cx = cl * eSc + xO, p = [];
          for (let k = 0; k < 6; k++) p.push([cx + ri * C(k * M.PI / 3), cy + ri * S(k * M.PI / 3)]); P.push(p);
        }
      }
    }
    // --- BASIC TILING (Square, Brick, Diamond) ---
    else if (typ === 'sq') {
      let hs = M.max(.01, st * .5);
      for (let v = (ev0 / eSc) | 0; v * eSc < ev1; v++) {
        let o = (v & 1 ? stg * eSc * .5 : 0) + (stgH * eSc * .5);
        for (let u = ((eu0 - o) / eSc) | 0; u * eSc + o < eu1; u++) P.push([[u * eSc + o + hs, v * eSc + hs], [u * eSc + o + eSc - hs, v * eSc + hs], [u * eSc + o + eSc - hs, v * eSc + eSc - hs], [u * eSc + o + hs, v * eSc + eSc - hs]]);
      }
    }

    // --- TRANSFORM & CLIP PIPELINE ---
    let rd = an * M.PI / 180, cA = C(rd), sA = S(rd), O = [];
    for (let p of P) {
      if (!p || p.length < 3) continue;
      if (rf > 0 && typ !== 'hypTri') p = cr(p, rf); // Apply rounded corners
      p = p.map(([x, y]) => [x + oX, y + oY]); // Offset
      if (an !== 0) p = p.map(([x, y]) => { let dx = x - cu, dy = y - cv; return [cu + dx * cA - dy * sA, cv + dx * sA + dy * cA]; }); // Rotate
      
      // Exclusion Zone Culling
      if (excl.length) {
        let rx = p.reduce((s, q) => s + q[0], 0) / p.length - oX, ry = p.reduce((s, q) => s + q[1], 0) / p.length - oY;
        if (excl.some(z => rx >= z.u0 - buf && rx <= z.u1 + buf && ry >= z.v0 - buf && ry <= z.v1 + buf)) continue;
        if (p.some(([px, py]) => excl.some(z => (px - oX) >= z.u0 && (px - oX) <= z.u1 && (py - oY) >= z.v0 && (py - oY) <= z.v1))) continue;
      }
      
      let sh = tSh(clp(p, u0, u1, v0, v1)); if (sh) O.push(sh); // Bounds Clip + Convert to THREE.Shape
    }
    return O;
  }
};