import fs from 'node:fs/promises';
import path from 'node:path';

const indexPath = path.join(process.cwd(), 'data', 'index.json');
const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
const documents = index.documents;

function countBy(key, docs = documents) {
  return Object.fromEntries([...docs.reduce((map, doc) => map.set(doc[key], (map.get(doc[key]) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1]));
}

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  res.json(body);
}

function matches(doc, params) {
  const filters = [
    ['jurisdiction', doc.jurisdiction],
    ['documentType', doc.documentType],
    ['topic', doc.primaryTopic],
    ['region', doc.region],
    ['year', doc.years?.includes(params.get('year'))],
    ['extension', doc.extension]
  ];
  for (const [key, value] of filters) {
    const wanted = params.get(key);
    if (!wanted) continue;
    if (key === 'topic' && value !== wanted && !doc.secondaryTopics.includes(wanted)) return false;
    if (key === 'year' && !value) return false;
    if (!['topic', 'year'].includes(key) && value !== wanted) return false;
  }
  return true;
}

function search(params) {
  const q = params.get('q')?.trim().toLowerCase() ?? '';
  return documents.filter(doc => matches(doc, params)).map(doc => {
    let score = 0;
    if (q && doc.fileName.toLowerCase().includes(q)) score += 10;
    if (q && doc.relativePath.toLowerCase().includes(q)) score += 5;
    if (q && doc.primaryTopic.toLowerCase().includes(q)) score += 4;
    if (q && doc.documentType.toLowerCase().includes(q)) score += 3;
    if (q && (doc.contentSample ?? '').toLowerCase().includes(q)) score += 2;
    return { ...doc, score };
  }).filter(doc => !q || doc.score > 0).sort((a, b) => b.score - a.score || a.fileName.localeCompare(b.fileName, 'zh-Hant'));
}

export default function handler(req, res) {
  const params = new URL(req.url, `https://${req.headers.host ?? 'localhost'}`).searchParams;
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (params.get('endpoint') === 'health') return json(res, 200, { ok: true, indexed: documents.length, generatedAt: index.generatedAt });
  if (params.get('endpoint') === 'facets') {
    const filtered = documents.filter(doc => matches(doc, params));
    return json(res, 200, { total: filtered.length, review: filtered.filter(doc => doc.classificationStatus === 'needs_review').length, jurisdiction: countBy('jurisdiction', filtered), documentType: countBy('documentType', filtered), primaryTopic: countBy('primaryTopic', filtered), region: countBy('region', filtered), year: countBy('year', filtered), extension: countBy('extension', filtered) });
  }
  if (params.get('endpoint') === 'search') {
    const results = search(params).slice(0, 500);
    return json(res, 200, { total: results.length, indexed: documents.length, results });
  }
  return json(res, 400, { error: 'Missing endpoint' });
}
