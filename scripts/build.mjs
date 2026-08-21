// Inlines the data files into the template to produce a single self-contained
// page — no network requests beyond the webfont.
import fs from 'node:fs';

const tpl = fs.readFileSync('src/map.html', 'utf8');
const db = JSON.parse(fs.readFileSync('data/battles.json', 'utf8'));
const states = JSON.parse(fs.readFileSync('data/us-states.json', 'utf8'));

const COLOPHON = [
  'Sources and caveats.',
  'Dates, locations, strengths and casualties are compiled from the standard references — the National Park Service / CWSAC battle summaries, the American Battlefield Trust, and the Livermore and Fox casualty tabulations — and every entry was re-checked against published figures before this map was built.',
  'Civil War numbers are estimates and historians disagree, sometimes sharply. "Casualties" here means killed, wounded, captured and missing; where a garrison surrendered, the surrendered men are counted, which is why sieges such as Vicksburg, Harpers Ferry and Fort Donelson show enormous losses against modest forces. "Troops engaged" means the men actually brought into the fight, not the men present.',
  'Coordinates mark the centre of each battlefield, accurate to a mile or two. States are given by their modern boundaries: the fighting at Philippi, Rich Mountain, Carnifex Ferry and Harpers Ferry took place in what was still Virginia and became West Virginia in 1863, and Honey Springs was fought in Indian Territory, now Oklahoma.',
  'The timeline runs from the first shot at Fort Sumter on 12 April 1861 to the surrender of Stand Watie on 23 June 1865, the last Confederate general in the field — which is why it continues for six quiet weeks after the last battle at Palmito Ranch.',
  'These are 143 principal engagements. The CWSAC catalogues 384, and the thousands of skirmishes, raids and sieges below that threshold are not shown here — this is the shape of the war, not the whole of it.'
].join(' ');

const meta = { fields: db.meta.fields, colophon: COLOPHON };

const out = tpl
  .replace('__BATTLES__', JSON.stringify(db.rows))
  .replace('__STATES__', JSON.stringify(states))
  .replace('__META__', JSON.stringify(meta));

fs.writeFileSync('index.html', out);
console.log(`index.html — ${(out.length / 1024).toFixed(1)} KB, ${db.rows.length} battles`);
