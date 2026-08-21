// Structural audit of the battle dataset. Catches the errors a human eye slides
// past: a coordinate in the wrong state, a date outside the war, casualties
// larger than the force that took them.
import fs from 'node:fs';

const db = JSON.parse(fs.readFileSync('data/battles.json', 'utf8'));
const geo = JSON.parse(fs.readFileSync('data/us-states.json', 'utf8'));
const F = db.meta.fields;
const rows = db.rows.map(r => Object.fromEntries(F.map((f, i) => [f, r[i]])));

const ABBR = {AL:'Alabama',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};

const byName = new Map(geo.features.map(f => [f.name, f]));
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) &&
        pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inFeature = (pt, f) => f.polys.some(p => inRing(pt, p[0]) && !p.slice(1).some(h => inRing(pt, h)));
function locate(pt) {
  const hits = geo.features.filter(f => inFeature(pt, f)).map(f => f.name);
  return hits;
}

const WAR_START = '1861-04-12', WAR_END = '1865-06-23';

// Battles fought on water or on barrier islands: their coordinates correctly
// fall outside any simplified state polygon.
const AFLOAT = new Set(['Fort Sumter', 'Hatteras Inlet Batteries', 'Port Royal',
  'Roanoke Island', 'Hampton Roads', 'Mobile Bay', 'Fort Wagner', 'Fort Pulaski',
  'New Madrid and Island No. 10', 'Forts Jackson and St. Philip']);
// Actions that ended in a surrender, where losing most of the force is the
// historical fact rather than a data error.
const SURRENDERED = new Set(['Fort Donelson', 'Harpers Ferry', 'Roanoke Island',
  'Fort Pulaski', 'Vicksburg', 'Port Hudson', 'Arkansas Post', 'Fort Pillow',
  'Hatteras Inlet Batteries', 'New Madrid and Island No. 10', 'Front Royal',
  'Richmond', 'Second Winchester', 'Rappahannock Station', 'Mobile Bay',
  'Fort Fisher', 'Selma', "Sailor's Creek", 'Fort Blakeley', 'Fort McAllister',
  "Milliken's Bend", 'Lexington', 'Fort Stedman', 'Griswoldville']);
const issues = [];
const add = (name, kind, msg) => issues.push({ name, kind, msg });
const seen = new Map();

for (const b of rows) {
  const id = `${b.name} (${b.state})`;
  if (seen.has(b.name)) add(id, 'DUPLICATE', `name also used by ${seen.get(b.name)}`);
  seen.set(b.name, id);

  // dates
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.start) || !/^\d{4}-\d{2}-\d{2}$/.test(b.end))
    add(id, 'DATE', `malformed: ${b.start}..${b.end}`);
  if (b.start < WAR_START || b.end > WAR_END) add(id, 'DATE', `outside the war: ${b.start}..${b.end}`);
  if (b.end < b.start) add(id, 'DATE', `end before start: ${b.start}..${b.end}`);
  const days = (new Date(b.end) - new Date(b.start)) / 864e5;
  if (days > 60) add(id, 'DATE', `spans ${days} days — long for a single bubble`);

  // geography
  const state = ABBR[b.state];
  if (!state) add(id, 'STATE', `unknown state code ${b.state}`);
  else if (b.state === 'DC') {
    if (Math.abs(b.lat - 38.9) > 0.2 || Math.abs(b.lon + 77.03) > 0.2) add(id, 'COORD', `not near DC: ${b.lat},${b.lon}`);
  } else if (!AFLOAT.has(b.name)) {
    const hits = locate([b.lon, b.lat]);
    if (!hits.includes(state)) {
      add(id, 'COORD', `(${b.lat}, ${b.lon}) is in [${hits.join(', ') || 'open water / no state'}], expected ${state}`);
    }
  }

  // strength vs losses
  for (const side of ['us', 'cs']) {
    const f = b[side + 'Forces'], c = b[side + 'Cas'];
    if (c > f && f > 0) add(id, 'LOSSES', `${side.toUpperCase()} casualties ${c} exceed force engaged ${f}`);
    if (f > 0 && c / f > 0.6 && !SURRENDERED.has(b.name))
      add(id, 'LOSSES', `${side.toUpperCase()} lost ${(100 * c / f).toFixed(0)}% of its force — verify`);
  }
  const tot = b.usCas + b.csCas;
  if (tot === 0 && b.name !== 'Fort Sumter') add(id, 'LOSSES', 'zero total casualties');
  if (b.usForces + b.csForces === 0 && b.theater !== 'Coast') add(id, 'FORCES', 'no strength recorded');

  if (!['US', 'CS', 'IND'].includes(b.result)) add(id, 'RESULT', `bad result code ${b.result}`);
  if (!['East', 'West', 'TransMiss', 'Coast'].includes(b.theater)) add(id, 'THEATER', `bad theater ${b.theater}`);
}

// coverage sanity: every month of the war that saw a listed battle
const months = new Set(rows.map(r => r.start.slice(0, 7)));
console.log(`${rows.length} battles · ${months.size} distinct months represented`);
const totalCas = rows.reduce((s, r) => s + r.usCas + r.csCas, 0);
console.log(`total casualties in dataset: ${totalCas.toLocaleString()}`);
const byYear = {};
for (const r of rows) { const y = r.start.slice(0, 4); byYear[y] = (byYear[y] || 0) + 1; }
console.log('battles per year:', byYear);

if (!issues.length) console.log('\nNo structural issues found.');
else {
  console.log(`\n${issues.length} issue(s):`);
  for (const i of issues) console.log(`  [${i.kind}] ${i.name}: ${i.msg}`);
}
