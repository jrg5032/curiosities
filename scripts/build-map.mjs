// Converts the us-atlas states TopoJSON into a compact, simplified GeoJSON
// for embedding in the standalone map page.
import fs from 'node:fs';
import * as topojson from '/tmp/claude-0/-home-user-curiosities/ea8e5118-da39-598b-a8e8-debff78c7591/scratchpad/topojson-client-3.1.0/src/index.js';

const topo = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-curiosities/ea8e5118-da39-598b-a8e8-debff78c7591/scratchpad/us-atlas-3.0.1/states-10m.json', 'utf8'));
const fc = topojson.feature(topo, topo.objects.states);

// Territories and states outside the theater of war are dropped; the war was
// fought entirely within what is now the lower 48 (plus Indian Territory).
const DROP = new Set(['Alaska', 'Hawaii', 'Puerto Rico', 'United States Virgin Islands',
  'American Samoa', 'Guam', 'Commonwealth of the Northern Mariana Islands', 'District of Columbia']);

// Ramer-Douglas-Peucker on lon/lat, plus small-ring culling: the map is drawn
// at roughly 1000px wide, so sub-pixel detail and barrier islands cost bytes
// without changing what anyone sees.
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let maxD = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    const d = (px - cx) ** 2 + (py - cy) ** 2;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (Math.sqrt(maxD) > eps) {
    return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
  }
  return [pts[0], pts[pts.length - 1]];
}
const area = (r) => Math.abs(r.reduce((s, p, i) => {
  const q = r[(i + 1) % r.length];
  return s + (p[0] * q[1] - q[0] * p[1]);
}, 0) / 2);

const EPS = 0.02;        // ~2 km
const MIN_AREA = 0.02;   // drop islands below ~200 km²
const round = (p) => [Math.round(p[0] * 1e3) / 1e3, Math.round(p[1] * 1e3) / 1e3];

function simplifyPolys(polys) {
  const out = [];
  for (const poly of polys) {
    const rings = [];
    for (const ring of poly) {
      if (area(ring) < MIN_AREA) continue;
      let s = rdp(ring, EPS).map(round);
      // dedupe consecutive points introduced by rounding
      s = s.filter((p, i) => i === 0 || p[0] !== s[i - 1][0] || p[1] !== s[i - 1][1]);
      if (s.length > 3) { s[s.length - 1] = s[0]; rings.push(s); }
    }
    if (rings.length) out.push(rings);
  }
  return out;
}

const features = [];
for (const f of fc.features) {
  if (DROP.has(f.properties.name)) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const simplified = simplifyPolys(polys);
  if (!simplified.length) continue;
  features.push({ name: f.properties.name, polys: simplified });
}
features.sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync('data/us-states.json', JSON.stringify({ features }));
const bytes = fs.statSync('data/us-states.json').size;
console.log(`${features.length} states, ${(bytes / 1024).toFixed(1)} KB`);
console.log(features.map(f => f.name).join(', '));
