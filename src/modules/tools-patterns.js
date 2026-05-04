import * as THREE from 'three';

const M = Math;

// ── PURE MATH & ALGORITHM REFERENCES ──────────────────────────────────────────
// Polygon Clipping : Sutherland-Hodgman algorithm (1974) for half-plane culling.
// Cellular Lattice : Georgy Voronoi (1908) spatial partitioning via seed loci.
// Curved Tiling    : Henri Poincaré (1882) disk model for hyperbolic arcs.
// 3D Simplex Noise : Ken Perlin (2001) / Stefan Gustavson (2005) pure math impl.
// Fluid Dynamics   : Navier-Stokes(1822) inspired vortex shedding & boundary.
// ──────────────────────────────────────────────────────────────────────────────

// ── POLYGON HALF-PLANE CLIPPING ───────────────────────────────────────────────
// Ref: Sutherland, I.E. & Hodgman, G.W. (1974). "Reentrant polygon clipping."
// Math: Iteratively evaluates edges against a clip edge using dot products. 
// Intersections crossing the half-plane boundary (N · P = 0) are resolved using 
// linear interpolation: P_int = P1 + t*(P2 - P1), where t is the distance ratio.
const clp = (py, x0, x1, y0, y1) => {
    const I = [p => p[0] >= x0, p => p[0] <= x1, p => p[1] >= y0, p => p[1] <= y1];
    const S = [
        (a, b) => [x0, a[1] + (x0 - a[0]) / (b[0] - a[0]) * (b[1] - a[1])],
        (a, b) => [x1, a[1] + (x1 - a[0]) / (b[0] - a[0]) * (b[1] - a[1])],
        (a, b) => [a[0] + (y0 - a[1]) / (b[1] - a[1]) * (b[0] - a[0]), y0],
        (a, b) => [a[0] + (y1 - a[1]) / (b[1] - a[1]) * (b[0] - a[0]), y1]
    ];
    let o = py;
    for (let i = 0; i < 4; i++) {
        if (!o.length) return null;
        const n = o; o = [];
        for (let j = 0; j < n.length; j++) {
            const c = n[j], p = n[(j + n.length - 1) % n.length];
            const ci = I[i](c), pi = I[i](p);
            if (ci) { if (!pi) o.push(S[i](p, c)); o.push(c); } 
            else if (pi) o.push(S[i](p, c));
        }
    }
    return o.length > 2 ? o : null;
};

const tSh = p => {
    if (!p || p.length < 3) return null;
    let a = 0;
    for (let i = 0, n = p.length; i < n; i++) a += p[i][0] * p[(i + 1) % n][1] - p[(i + 1) % n][0] * p[i][1];
    if (M.abs(a) * .5 < .04) return null;
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    return s;
};

function hpClip(poly, mx, my, nx, ny) {
    if (!poly || poly.length < 3) return null;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const c = poly[i], p = poly[(i + poly.length - 1) % poly.length];
        const dc = (c[0] - mx) * nx + (c[1] - my) * ny, dp = (p[0] - mx) * nx + (p[1] - my) * ny;
        if (dc >= 0) {
            if (dp < 0) { const t = dp / (dp - dc); out.push([p[0] + t * (c[0] - p[0]), p[1] + t * (c[1] - p[1])]); }
            out.push(c);
        } else if (dp >= 0) {
            const t = dp / (dp - dc); out.push([p[0] + t * (c[0] - p[0]), p[1] + t * (c[1] - p[1])]);
        }
    }
    return out.length >= 3 ? out : null;
}

// ── CORNER ROUNDING (BÉZIER ARCS) ─────────────────────────────────────────────
// Ref: Bézier, P. (1962). "Essai de définition numérique des courbes..."
// Math: Replaces sharp corners with Quadratic Bézier curves. Treats the original
// sharp corner as control point P1, computing edge offsets P0 and P2. Samples 
// the curve using polynomial: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2 for t ∈ [0,1].
const ARC_SEGS = 6;
function cornerRound(poly, rf) {
    if (!poly || poly.length < 3 || rf <= 0) return poly;
    const n = poly.length, out = [];
    for (let i = 0; i < n; i++) {
        const prev = poly[(i + n - 1) % n], curr = poly[i], next = poly[(i + 1) % n];
        const dx1 = prev[0] - curr[0], dy1 = prev[1] - curr[1];
        const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
        const len1 = M.sqrt(dx1 * dx1 + dy1 * dy1), len2 = M.sqrt(dx2 * dx2 + dy2 * dy2);
        if (len1 < .001 || len2 < .001) { out.push(curr); continue; }
        const maxOff = M.min(len1, len2) * .49 * rf;
        const p1 = [curr[0] + dx1 / len1 * maxOff, curr[1] + dy1 / len1 * maxOff];
        const p2 = [curr[0] + dx2 / len2 * maxOff, curr[1] + dy2 / len2 * maxOff];
        for (let s = 0; s <= ARC_SEGS; s++) {
            const t = s / ARC_SEGS, u = 1 - t;
            out.push([u * u * p1[0] + 2 * u * t * curr[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * curr[1] + t * t * p2[1]]);
        }
    }
    return out;
}

function hypArc(ax, ay, bx, by, cx, cy, depth, segs = 8) {
    const pts = [], mx = (ax + bx) / 2, my = (ay + by) / 2;
    const dx = cx - mx, dy = cy - my, len = M.sqrt(dx * dx + dy * dy) || 1;
    const edgeLen = M.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
    const bow = edgeLen * depth * .3, nx = dx / len * bow, ny = dy / len * bow;
    const cpx = mx + nx, cpy = my + ny;
    for (let i = 0; i <= segs; i++) {
        const t = i / segs, u = 1 - t;
        pts.push([u * u * ax + 2 * u * t * cpx + t * t * bx, u * u * ay + 2 * u * t * cpy + t * t * by]);
    }
    return pts;
}

// ── DYNAMIC STRING / MULTI-LINE PLAQUE RASTERIZER ─────────────────────────────
function mkCharShapes(text, b, sc, st, mg, an, oX, oY, isSingle, fontFam = 'sans-serif') {
    const PS = 64; 
    const u0 = b.minU + mg, u1 = b.maxU - mg, v0 = b.minV + mg, v1 = b.maxV - mg;
    if (u1 <= u0 || v1 <= v0) return [];
    
    const cv = document.createElement('canvas'); 
    const ctx = cv.getContext('2d');
    ctx.font = `bold ${PS}px "${fontFam}", sans-serif`;
    
    // Support multi-line via the '|' delimiter
    const lines = (text || '★').split('|');
    let maxW = 0;
    lines.forEach(l => maxW = M.max(maxW, ctx.measureText(l).width));
    
    const tw = M.ceil(maxW || PS) + 10;
    const th = PS * lines.length;
    
    cv.width = tw; cv.height = th;
    ctx.font = `bold ${PS}px "${fontFam}", sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left'; 
    ctx.textBaseline = 'top';
    
    // Draw all lines vertically stacked
    lines.forEach((l, i) => ctx.fillText(l, 5, i * PS));
    
    const img = ctx.getImageData(0, 0, tw, th).data;
    const ext = .5, eu0 = u0 - (u1 - u0) * ext, eu1 = u1 + (u1 - u0) * ext;
    const ev0 = v0 - (v1 - v0) * ext, ev1 = v1 + (v1 - v0) * ext;
    
    const ps = sc / th; 
    const hs = M.max(.01, ps * .48 - st * .02);
    const rd = an * M.PI / 180, cA = M.cos(rd), sA = M.sin(rd);
    const cu = (u0 + u1) / 2, cv2 = (v0 + v1) / 2;
    
    const stepX = tw * ps * 1.2; 
    const stepY = th * ps * 1.3;
    
    let startX = M.floor((eu0 - cu) / stepX) - 1, endX = M.ceil((eu1 - cu) / stepX) + 1;
    let startY = M.floor((ev0 - cv2) / stepY) - 1, endY = M.ceil((ev1 - cv2) / stepY) + 1;

    if (isSingle) {
        startX = 0; endX = 0; startY = 0; endY = 0;
    }
    
    const P = [];
    for (let ry = startY; ry <= endY; ry++) {
        for (let rx = startX; rx <= endX; rx++) {
            for (let py = 0; py < th; py += 2) {
                for (let px = 0; px < tw; px += 2) {
                    if (img[(py * tw + px) * 4 + 3] > 128) {
                        let x, y;
                        if (isSingle) {
                            x = cu - (tw * ps) / 2 + px * ps + oX;
                            y = cv2 - (th * ps) / 2 + py * ps + oY;
                        } else {
                            x = cu + rx * stepX - (tw * ps) / 2 + px * ps + oX;
                            y = cv2 + ry * stepY - (th * ps) / 2 + py * ps + oY;
                        }
                        
                        if (an !== 0) {
                            const dx = x - cu, dy = y - cv2;
                            x = cu + dx * cA - dy * sA;
                            y = cv2 + dx * sA + dy * cA;
                        }
                        const sh = tSh(clp([
                            [x - hs, y - hs], [x + hs, y - hs],
                            [x + hs, y + hs], [x - hs, y + hs]
                        ], u0, u1, v0, v1));
                        if (sh) P.push(sh);
                    }
                }
            }
        }
    }
    return P;
}

// ── MAIN PATTERN FOUNDRY ENGINE ───────────────────────────────────────────────
export const PatternFoundry = {
    mk(type, b, sc, st, mg, an, oX, oY, stg, stgH, dn, excl = [], crnR = 0, fontFam = 'sans-serif') {
        const textInput = document.getElementById('EC') ? document.getElementById('EC').value : '★';
        
        if (type === 'char' || type === 'charSingle') {
            return mkCharShapes(textInput, b, sc, st, mg, an, oX, oY, type === 'charSingle', fontFam);
        }

        const effSc = sc / dn; 
        const rf = crnR / 100;
        
        const u0 = b.minU + mg, u1 = b.maxU - mg, v0 = b.minV + mg, v1 = b.maxV - mg;
        if (u1 <= u0 || v1 <= v0) return [];
        
        const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, ext = .6;
        const eu0 = u0 - (u1 - u0) * ext, eu1 = u1 + (u1 - u0) * ext;
        const ev0 = v0 - (v1 - v0) * ext, ev1 = v1 + (v1 - v0) * ext;
        const buf = effSc * .55;
        let P = [];

        // ── 1. Halftone / Acoustic Panels (Variable Radius)
        if (type === 'halftone') {
            const freq = M.PI / (effSc * 4); // Modulation wavelength
            for (let v = M.floor(ev0 / effSc) - 1; v * effSc < ev1 + effSc; v++) {
                const off = (v & 1 ? stg * effSc * .5 : 0) + (stgH * effSc * .5);
                for (let u = M.floor((eu0 - off) / effSc) - 1; u * effSc + off < eu1 + effSc; u++) {
                    const cx = u * effSc + off, cy = v * effSc;
                    // Modulate radius using world coordinates
                    const mod = M.sin(cx * freq) * M.cos(cy * freq); 
                    const r = (effSc * 0.5) * (0.2 + 0.7 * M.abs(mod)) - st; 
                    if (r > 0.3) {
                        const p = [];
                        for (let k = 0; k < 12; k++) p.push([cx + r * M.cos(k * M.PI / 6), cy + r * M.sin(k * M.PI / 6)]);
                        P.push(p);
                    }
                }
            }
        }
        // ── 2. Knurling (Diamond Grip for Bevel Extrusion)
        else if (type === 'knurl') {
            const r = effSc * 0.5, gap = st * 0.5;
            for (let v = M.floor(ev0 / r) - 1; v * r < ev1 + r; v++) {
                const off = (v & 1) ? r : 0;
                for (let u = M.floor((eu0 - off) / effSc) - 1; u * effSc + off < eu1 + effSc; u++) {
                    const cx = u * effSc + off, cy = v * r;
                    P.push([[cx, cy - r + gap], [cx + r - gap, cy], [cx, cy + r - gap], [cx - r + gap, cy]]);
                }
            }
        }
        // ── 3. Guilloché / Spiro (Watchmaker Rosettes)
        else if (type === 'spiro') {
            const petals = M.max(3, M.floor(36 * (1 / dn))); 
            const R = effSc * 0.45, thick = M.max(0.1, st);
            for (let v = M.floor(ev0 / effSc); v * effSc < ev1; v++) {
                const off = (v & 1 ? stg * effSc * .5 : 0) + (stgH * effSc * .5);
                for (let u = M.floor((eu0 - off) / effSc); u * effSc + off < eu1; u++) {
                    const cx = u * effSc + off, cy = v * effSc;
                    for (let i = 0; i < petals; i++) {
                        const a = (i / petals) * M.PI * 2, p = [];
                        for(let k = 0; k < 12; k++) {
                            const ea = (k / 11) * M.PI * 2;
                            const ex = M.cos(ea) * R, ey = M.sin(ea) * thick;
                            p.push([cx + ex * M.cos(a) - ey * M.sin(a), cy + ex * M.sin(a) + ey * M.cos(a)]);
                        }
                        P.push(p);
                    }
                }
            }
        }
        // ── 4. Custom SVG Parser
        else if (type === 'svg') {
            const shape = new THREE.Shape();
            // Tiny SVG Path String Matcher
            const tokens = textInput.match(/[a-zA-Z]+|[-+]?[0-9]*\.?[0-9]+/g) || [];
            let i = 0;
            while(i < tokens.length) {
                const cmd = tokens[i++];
                if(cmd==='M' || cmd==='m') { shape.moveTo(+tokens[i], +tokens[i+1]); i+=2; }
                else if(cmd==='L' || cmd==='l') { shape.lineTo(+tokens[i], +tokens[i+1]); i+=2; }
                else if(cmd==='C' || cmd==='c') { shape.bezierCurveTo(+tokens[i], +tokens[i+1], +tokens[i+2], +tokens[i+3], +tokens[i+4], +tokens[i+5]); i+=6; }
                else if(cmd==='Q' || cmd==='q') { shape.quadraticCurveTo(+tokens[i], +tokens[i+1], +tokens[i+2], +tokens[i+3]); i+=4; }
                else if(cmd==='Z' || cmd==='z') { shape.closePath(); }
            }
            
            const pts = shape.getPoints(10); 
            if(pts.length > 2) {
                let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
                pts.forEach(p => { minX = M.min(minX, p.x); maxX = M.max(maxX, p.x); minY = M.min(minY, p.y); maxY = M.max(maxY, p.y); });
                const sw = maxX - minX, sh = maxY - minY;
                const scale = (effSc * 2) / M.max(sw, sh);
                
                // Single centralized tile scaled to fit the user's CELL SCALE
                const pArr = pts.map(p => [(p.x - minX - sw/2) * scale, (p.y - minY - sh/2) * scale]);
                P.push(pArr);
            }
        }
        // ── Existing Generative Patterns Below
        else if (type === 'voronoi') {
            const seeds = [], minD = effSc * (1 - M.min(.9, st / effSc));
            let rng = (M.round(effSc * 7 + mg * 3)) ^ 0x5f3759df;
            const lcg = () => { rng = (rng * 1664525 + 1013904223) | 0; return (rng >>> 0) / 0xFFFFFFFF; };
            for (let i = 0; i < 2000 && seeds.length < 200; i++) {
                const tx = eu0 + (eu1 - eu0) * lcg(), ty = ev0 + (ev1 - ev0) * lcg();
                let ok = true;
                for (const s of seeds) if ((tx - s[0]) ** 2 + (ty - s[1]) ** 2 < minD * minD) { ok = false; break; }
                if (ok) seeds.push([tx, ty]);
            }
            const bbox = [[eu0 - effSc, ev0 - effSc], [eu1 + effSc, ev0 - effSc], [eu1 + effSc, ev1 + effSc], [eu0 - effSc, ev1 + effSc]];
            for (let i = 0; i < seeds.length; i++) {
                let cell = bbox.slice(); 
                const [sx, sy] = seeds[i];
                for (let j = 0; j < seeds.length; j++) {
                    if (i === j) continue;
                    const [ox, oy] = seeds[j];
                    cell = hpClip(cell, (sx + ox) / 2, (sy + oy) / 2, sx - ox, sy - oy);
                    if (!cell) break;
                }
                if (!cell || cell.length < 3) continue;
                const cxc = cell.reduce((s, p) => s + p[0], 0) / cell.length, cyc = cell.reduce((s, p) => s + p[1], 0) / cell.length;
                P.push(cell.map(([x, y]) => {
                    const dx = x - cxc, dy = y - cyc, d = M.sqrt(dx * dx + dy * dy), sf = M.max(0, d - st) / M.max(d, .001);
                    return [cxc + dx * sf, cyc + dy * sf];
                }));
            }
        }
        else if (type === 'bubbles') {
            const seeds = [];
            let rng = (M.round(effSc * 7 + mg * 3)) ^ 0x5f3759df;
            const lcg = () => { rng = (rng * 1664525 + 1013904223) | 0; return (rng >>> 0) / 0xFFFFFFFF; };
            for (let i = 0; i < 2000 && seeds.length < 250; i++) {
                const tx = eu0 + (eu1 - eu0) * lcg(), ty = ev0 + (ev1 - ev0) * lcg();
                const r = effSc * (0.2 + 0.6 * lcg());
                let ok = true;
                for (const s of seeds) if ((tx - s.x) ** 2 + (ty - s.y) ** 2 < (r + s.r + st) ** 2) { ok = false; break; }
                if (ok) seeds.push({x: tx, y: ty, r: r});
            }
            for (const s of seeds) {
                const p = [];
                for (let i = 0; i < 16; i++) {
                    const a = (i / 16) * M.PI * 2;
                    p.push([s.x + M.cos(a) * s.r, s.y + M.sin(a) * s.r]);
                }
                P.push(p);
            }
        }
        else if (type === 'fractal') {
            const hs = M.max(.01, st * .5);
            for (let v = M.floor(ev0 / effSc); v * effSc < ev1; v++) {
                for (let u = M.floor(eu0 / effSc); u * effSc < eu1; u++) {
                    let isHole = false, tx = M.abs(u), ty = M.abs(v);
                    while (tx > 0 || ty > 0) {
                        if (tx % 3 === 1 && ty % 3 === 1) { isHole = true; break; }
                        tx = M.floor(tx / 3); ty = M.floor(ty / 3);
                    }
                    if (isHole) {
                        const cx = u * effSc, cy = v * effSc;
                        P.push([[cx+hs, cy+hs], [cx+effSc-hs, cy+hs], [cx+effSc-hs, cy+effSc-hs], [cx+hs, cy+effSc-hs]]);
                    }
                }
            }
        }
        else if (type === 'weave') {
            const hs = M.max(.01, st * .5), w = effSc;
            for (let v = M.floor(ev0 / w)-1; v * w < ev1+w; v++) {
                for (let u = M.floor(eu0 / w)-1; u * w < eu1+w; u++) {
                    const cx = u * w, cy = v * w;
                    if ((u + v) & 1) P.push([[cx+hs, cy-w*.5+hs], [cx+w-hs, cy-w*.5+hs], [cx+w-hs, cy+w*1.5-hs], [cx+hs, cy+w*1.5-hs]]);
                    else P.push([[cx-w*.5+hs, cy+hs], [cx+w*1.5-hs, cy+hs], [cx+w*1.5-hs, cy+w-hs], [cx-w*.5+hs, cy+w-hs]]);
                }
            }
        }
        else if (type === 'scales') {
            const r = effSc * 0.6; 
            for (let v = M.floor(ev0 / (effSc*0.5)) - 1; v * effSc * 0.5 < ev1 + effSc; v++) {
                const off = (v & 1) ? effSc * 0.5 : 0;
                for (let u = M.floor((eu0 - off) / effSc) - 1; u * effSc + off < eu1 + effSc; u++) {
                    const cx = u * effSc + off, cy = v * effSc * 0.5, p = [];
                    for(let a=0; a<=12; a++) p.push([cx + M.cos((a/12)*M.PI)*r, cy - M.sin((a/12)*M.PI)*r]);
                    p.push([cx, cy + r*0.4]); 
                    P.push(p);
                }
            }
        }
        else if (type === 'maze') {
            const hs = M.max(.01, st * .5);
            let rng = (M.round(effSc * 7)) ^ 0x12345;
            const lcg = () => { rng = (rng * 1664525 + 1013904223) | 0; return (rng >>> 0) / 0xFFFFFFFF; };
            for (let v = M.floor(ev0 / effSc); v * effSc < ev1; v++) {
                for (let u = M.floor(eu0 / effSc); u * effSc < eu1; u++) {
                    const cx = u * effSc, cy = v * effSc;
                    if (lcg() > 0.5) P.push([[cx+hs, cy], [cx+effSc, cy+effSc-hs], [cx+effSc-hs, cy+effSc], [cx, cy+hs]]);
                    else P.push([[cx, cy+effSc-hs], [cx+effSc-hs, cy], [cx+effSc, cy+hs], [cx+hs, cy+effSc]]);
                }
            }
        }
        else if (type === 'stars') {
            const r1 = effSc * 0.5, r2 = r1 * 0.4;
            for (let v = M.floor(ev0 / effSc) - 1; v * effSc < ev1 + effSc; v++) {
                const off = (v & 1 ? stg * effSc * .5 : 0) + (stgH * effSc * .5);
                for (let u = M.floor((eu0 - off) / effSc) - 1; u * effSc + off < eu1 + effSc; u++) {
                    const cx = u * effSc + off, cy = v * effSc, p = [];
                    for(let k=0; k<10; k++) {
                        const r = (k%2===0) ? r1 : r2;
                        p.push([cx + r*M.cos(k*M.PI/5-M.PI/2), cy + r*M.sin(k*M.PI/5-M.PI/2)]);
                    }
                    P.push(p);
                }
            }
        }
        else if (type === 'hypTri') {
            const h = effSc * .866, ri = M.max(.05, effSc * .45 - st * .65), bowDepth = M.min(1, st / effSc * 2 + .3);
            for (let rw = M.floor(ev0 / h) - 1; rw * h < ev1 + h; rw++) {
                const isOdd = rw & 1, xOff = isOdd ? (effSc * .5 + stg * effSc * .5) : (stgH * effSc * .5);
                for (let cl = M.floor((eu0 - xOff) / effSc) - 1; cl * effSc + xOff < eu1 + effSc; cl++) {
                    const cx = cl * effSc + xOff, cy = rw * h;
                    let verts;
                    if (isOdd) verts = [[cx - ri, cy - ri * .577], [cx + ri, cy - ri * .577], [cx, cy + ri * 1.155]];
                    else verts = [[cx, cy - ri * 1.155], [cx - ri, cy + ri * .577], [cx + ri, cy + ri * .577]];
                    const curved = [];
                    for (let k = 0; k < 3; k++) {
                        const arc = hypArc(verts[k][0], verts[k][1], verts[(k + 1) % 3][0], verts[(k + 1) % 3][1], cx, cy, bowDepth, 8);
                        for (let s = 0; s < arc.length - 1; s++) curved.push(arc[s]);
                    }
                    P.push(curved);
                }
            }
        }
        else if (type === 'hex') {
            const r = effSc * .5, ri = M.max(.05, r - st * 1.15), rh = r * 1.73;
            for (let rw = M.floor(ev0 / rh) - 1; rw * rh < ev1 + rh; rw++) {
                const cy = rw * rh, xO = (rw & 1) ? (r + stg * effSc * .5) : (stgH * effSc * .5);
                for (let cl = M.floor((eu0 - xO) / effSc) - 1; cl * effSc + xO < eu1 + effSc; cl++) {
                    const cx = cl * effSc + xO, p = [];
                    for (let k = 0; k < 6; k++) p.push([cx + ri * M.cos(k * M.PI / 3), cy + ri * M.sin(k * M.PI / 3)]);
                    P.push(p);
                }
            }
        }
        else if (type === 'isoCube') {
            const r = effSc * 0.5, a = r * 0.8660254, b = r * 0.5, sf = M.max(0.01, 1 - st / a); 
            for(let rw = M.floor(ev0/(r*1.5)) - 1; rw*(r*1.5) < ev1+(r*1.5); rw++) {
                const cy = rw * (r * 1.5), xO = (rw & 1) ? (a + stg*effSc*0.5) : (stgH*effSc*0.5);
                for(let cl = M.floor((eu0-xO)/(a*2)) - 1; cl*(a*2)+xO < eu1+(a*2); cl++) {
                    const cx = cl * (a * 2) + xO;
                    const rcenters = [[0, r*0.5], [a*0.5, -b*0.5], [-a*0.5, -b*0.5]];
                    const rpts = [[[0,0], [-a,b], [0,r], [a,b]], [[0,0], [a,b], [a,-b], [0,-r]], [[0,0], [0,-r], [-a,-b], [-a,b]]];
                    for(let i=0; i<3; i++) {
                        const rcx = rcenters[i][0], rcy = rcenters[i][1], p = [];
                        for(let j=0; j<4; j++) p.push([cx + rcx + (rpts[i][j][0] - rcx)*sf, cy + rcy + (rpts[i][j][1] - rcy)*sf]);
                        P.push(p);
                    }
                }
            }
        }
        else if (type === 'sq') {
            const hs = M.max(.01, st * .5);
            for (let v = M.floor(ev0 / effSc); v * effSc < ev1; v++) {
                const off = (v & 1 ? stg * effSc * .5 : 0) + (stgH * effSc * .5);
                for (let u = M.floor((eu0 - off) / effSc); u * effSc + off < eu1; u++) {
                    const cx = u * effSc + off, cy = v * effSc;
                    P.push([[cx + hs, cy + hs], [cx + effSc - hs, cy + hs], [cx + effSc - hs, cy + effSc - hs], [cx + hs, cy + effSc - hs]]);
                }
            }
        }
        else if (type === 'brick') {
            const bh = effSc * .4, hs = M.max(.01, st * .5);
            for (let rw = M.floor(ev0 / bh) - 1; rw * bh < ev1 + bh; rw++) {
                const xX = (rw & 1) * (effSc * .5 + stg * effSc * .25) + (stgH * effSc * .25);
                for (let cl = M.floor((eu0 - xX) / effSc) - 1; cl * effSc + xX < eu1 + effSc; cl++) {
                    P.push([[cl * effSc + xX + hs, rw * bh + hs], [(cl + 1) * effSc + xX - hs, rw * bh + hs], [(cl + 1) * effSc + xX - hs, (rw + 1) * bh - hs], [cl * effSc + xX + hs, (rw + 1) * bh - hs]]);
                }
            }
        }
        else if (type === 'diamond') {
            const rs = M.max(.05, effSc * .7 - st);
            for (let v = M.floor(ev0 / effSc) - 1; v * effSc < ev1 + effSc; v++) {
                const off = (v & 1 ? stg * effSc * .5 : 0) + (stgH * effSc * .5);
                for (let u = M.floor((eu0 - off) / effSc) - 1; u * effSc + off < eu1 + effSc; u++) {
                    const cx = u * effSc + (v & 1 ? effSc * .5 : 0) + off, cy = v * effSc * .5;
                    P.push([[cx, cy - rs], [cx + rs, cy], [cx, cy + rs], [cx - rs, cy]]);
                }
            }
        }
        else if (type === 'tri') {
            const h = effSc * .866, ri = M.max(.05, effSc * .45 - st * .65);
            for (let rw = M.floor(ev0 / h) - 1; rw * h < ev1 + h; rw++) {
                const isOdd = rw & 1, xOff = isOdd ? (effSc * .5 + stg * effSc * .5) : (stgH * effSc * .5);
                for (let cl = M.floor((eu0 - xOff) / effSc) - 1; cl * effSc + xOff < eu1 + effSc; cl++) {
                    const cx = cl * effSc + xOff, cy = rw * h;
                    if (isOdd) P.push([[cx - ri, cy - ri * .577], [cx + ri, cy - ri * .577], [cx, cy + ri * 1.155]]);
                    else P.push([[cx, cy - ri * 1.155], [cx - ri, cy + cy * .577], [cx + ri, cy + cy * .577]]);
                }
            }
        }

        // ── Rotation, Translation & Final Geometry Pipeline
        const rd = an * M.PI / 180, cA = M.cos(rd), sA = M.sin(rd), O = [];
        
        for (let p of P) {
            if (!p || p.length < 3) continue;
            // Bypass corner rounding for text/SVG/spiro to preserve their exact vectors
            if (rf > 0 && !['hypTri', 'char', 'charSingle', 'svg', 'spiro'].includes(type)) {
                p = cornerRound(p, rf);
            }
            
            p = p.map(([x, y]) => [x + oX, y + oY]);
            
            if (an !== 0) {
                p = p.map(([x, y]) => {
                    const dx = x - cu, dy = y - cv;
                    return [cu + dx * cA - dy * sA, cv + dx * sA + dy * cA];
                });
            }
            
            if (excl.length) {
                const rx = p.reduce((s, q) => s + q[0], 0) / p.length - oX;
                const ry = p.reduce((s, q) => s + q[1], 0) / p.length - oY;
                if (excl.some(z => rx >= z.u0 - buf && rx <= z.u1 + buf && ry >= z.v0 - buf && ry <= z.v1 + buf)) continue;
                if (p.some(([px, py]) => excl.some(z => (px - oX) >= z.u0 && (px - oX) <= z.u1 && (py - oY) >= z.v0 && (py - oY) <= z.v1))) continue;
            }
            
            const sh = tSh(clp(p, u0, u1, v0, v1));
            if (sh) O.push(sh);
        }
        return O;
    }
};