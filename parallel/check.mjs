// Reads the snapshot bodies that the SDK sent and checks each one:
// it must show its own page, and it must contain the cross-origin iframe.
// Usage: node parallel/check.mjs <framework> [contexts] [browser]
// Exit code 1: a snapshot is wrong (bug present).
import fs from 'node:fs';

const [framework = 'mocha', parallel = '', browserName = 'chrome'] = process.argv.slice(2);
const file = new URL(`./out/${framework}-${parallel || 'sequential'}-${browserName}.json`, import.meta.url);
if (!fs.existsSync(file)) {
  console.log(`No result file ${file.pathname}: the wdio run did not finish.`);
  process.exit(1);
}
const { snapshots, logs } = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log(`${framework}, ${parallel ? `parallelMode: "${parallel}"` : 'sequential'}, ${browserName}`);
const expected = ['a via browser', 'a via context', 'b via browser', 'b via context'];
let failed = false;
for (const name of expected) {
  const snapshot = snapshots.find((s) => s.name === name);
  if (!snapshot) {
    console.log(`  ${name.padEnd(14)} NOT SENT`);
    failed = true;
    continue;
  }
  const page = new URL(snapshot.url).pathname.slice(1);
  const iframes = snapshot.domSnapshot.corsIframes?.length || 0;
  const ok = page === name[0] && iframes === 1;
  if (!ok) failed = true;
  console.log(`  ${name.padEnd(14)} page /${page}, cross-origin iframes: ${iframes}  ${ok ? 'OK' : 'WRONG'}`);
}

const iframeErrors = [...new Set(logs
  .map((l) => (l.message || '').replace(/\x1b\[[0-9;]*m/g, ''))
  .filter((m) => /Error capturing CORS iframes/.test(m)))];
for (const message of iframeErrors) console.log(`  debug log: ${message}`);

if (failed) {
  console.log('\nBUG: a snapshot is missing, shows another page, or has no cross-origin iframe.');
  process.exit(1);
}
console.log('\nOK: each snapshot shows its own page with its cross-origin iframe.');
