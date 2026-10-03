// Maintenance script (not a gate): rebuilds gates/fixtures/ref-bigrams.json.
// Stores only truncated hashes of the reference's content-word bigrams, never its prose.
// Usage: node gates/mkref.mjs <path-to-reference-app.js>
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';

const html = await (await fetch('https://www.saegis.xyz/')).text();
const js = readFileSync(process.argv[2], 'utf8');
const strings = [...js.matchAll(/(['`])((?:\\.|(?!\1)[^\\\n]){6,})\1/g)].map((m) => m[2]).join(' ');
const text =
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ') + ' ' + strings;
const STOP = new Set(JSON.parse(readFileSync('gates/fixtures/stopwords.json', 'utf8')));
const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
const set = new Set();
for (let i = 0; i < words.length - 1; i++) {
  const a = words[i];
  const b = words[i + 1];
  if (a.length < 3 || b.length < 3 || STOP.has(a) || STOP.has(b)) continue;
  set.add(createHash('sha1').update(a + ' ' + b).digest('hex').slice(0, 12));
}
writeFileSync('gates/fixtures/ref-bigrams.json', JSON.stringify([...set].sort()));
console.log('bigrams', set.size);
