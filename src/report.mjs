import fs from 'node:fs/promises';
import path from 'node:path';

const indexPath = process.argv[2] ?? path.resolve('data', 'index.json');
const outputDir = process.argv[3] ?? path.resolve('data', 'classification');
const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
const docs = index.documents;

function groupBy(key) {
  const counts = new Map();
  for (const doc of docs) counts.set(doc[key], (counts.get(doc[key]) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

const columns = ['documentId', 'fileName', 'relativePath', 'jurisdiction', 'region', 'year', 'years', 'documentType', 'primaryTopic', 'secondaryTopics', 'extension', 'size', 'modifiedAt', 'classificationStatus', 'confidence'];
const csv = [columns.join(','), ...docs.map(doc => columns.map(key => csvCell(Array.isArray(doc[key]) ? doc[key].join('；') : doc[key])).join(','))].join('\r\n');
const review = docs.filter(doc => doc.classificationStatus === 'needs_review');
const reviewCsv = [columns.join(','), ...review.map(doc => columns.map(key => csvCell(Array.isArray(doc[key]) ? doc[key].join('；') : doc[key])).join(','))].join('\r\n');

const summary = {
  generatedAt: new Date().toISOString(),
  sourceRoot: index.sourceRoot,
  total: docs.length,
  autoCandidates: docs.length - review.length,
  needsReview: review.length,
  byJurisdiction: groupBy('jurisdiction'),
  byDocumentType: groupBy('documentType'),
  byPrimaryTopic: groupBy('primaryTopic'),
  byExtension: groupBy('extension')
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, 'classification-report.csv'), '\ufeff' + csv, 'utf8');
await fs.writeFile(path.join(outputDir, 'review-queue.csv'), '\ufeff' + reviewCsv, 'utf8');
await fs.writeFile(path.join(outputDir, 'classification-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify({ outputDir, total: summary.total, autoCandidates: summary.autoCandidates, needsReview: summary.needsReview }, null, 2));
