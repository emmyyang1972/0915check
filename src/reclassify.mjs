import fs from 'node:fs/promises';
import path from 'node:path';

const indexPath = path.resolve(process.argv[2] ?? 'data/index.json');
const currentYear = new Date().getFullYear();
const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
function validYears(value) { return [...new Set((String(value).match(/(?:19|20)\d{2}/g) ?? []).filter(year => Number(year) <= currentYear))].sort().reverse(); }
function folderYear(relativePath) { return [...String(relativePath).split(/[\\/]+/)].reverse().find(part => /^(?:19|20)\d{2}$/.test(part)) ?? ''; }
let changed = 0;
for (const doc of index.documents) {
  const candidates = validYears(`${doc.title ?? ''} ${doc.fileName ?? ''} ${doc.contentSample ?? ''}`);
  const year = folderYear(doc.relativePath) || candidates[0] || '未標示年份';
  const years = [...new Set([year, ...candidates].filter(item => item !== '未標示年份' && Number(item) <= currentYear))];
  if (doc.year !== year || JSON.stringify(doc.years) !== JSON.stringify(years)) changed++;
  doc.year = year; doc.years = years;
  if (Number(doc.year) > currentYear) { doc.year = '未標示年份'; doc.years = []; }
}
index.generatedAt = new Date().toISOString();
index.reclassifiedAt = index.generatedAt;
index.classificationPolicy = `year must be <= ${currentYear}; folder year takes priority`;
await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
console.log(JSON.stringify({ indexPath, currentYear, changed, documents: index.documents.length }, null, 2));
