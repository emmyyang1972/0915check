import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

const port = Number(process.env.PORT ?? 3000);
const indexPath = process.env.INDEX_PATH ?? path.resolve('data', 'index.json');
const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
const documents = index.documents;
const uiPath = path.resolve('public', 'index.html');

function countBy(key, docs = documents) {
  return Object.fromEntries([...docs.reduce((map, doc) => map.set(doc[key], (map.get(doc[key]) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1]));
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
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
    else if (key === 'year' && !value) return false;
    else if (!['topic', 'year'].includes(key) && value !== wanted) return false;
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await fs.readFile(uiPath));
    return;
  }
  if (url.pathname === '/api/health') { json(res, 200, { ok: true, indexed: documents.length, generatedAt: index.generatedAt }); return; }
  if (url.pathname === '/api/file') {
    const doc = documents.find(item => item.documentId === url.searchParams.get('id'));
    if (!doc) { json(res, 404, { error: 'Document not found' }); return; }
    try {
      const contentTypes = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8' };
      const body = await fs.readFile(doc.absolutePath);
      res.writeHead(200, { 'content-type': contentTypes[doc.extension] ?? 'application/octet-stream', 'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}` });
      res.end(body);
    } catch { json(res, 404, { error: 'Source file is unavailable' }); }
    return;
  }
  if (url.pathname === '/api/facets') {
    const filtered = documents.filter(doc => matches(doc, url.searchParams));
    json(res, 200, { total: filtered.length, review: filtered.filter(doc => doc.classificationStatus === 'needs_review').length, jurisdiction: countBy('jurisdiction', filtered), documentType: countBy('documentType', filtered), primaryTopic: countBy('primaryTopic', filtered), region: countBy('region', filtered), year: countBy('year', filtered), extension: countBy('extension', filtered) });
    return;
  }
  if (url.pathname === '/api/search') { const results = search(url.searchParams).slice(0, 500); json(res, 200, { total: results.length, indexed: documents.length, results }); return; }
  json(res, 404, { error: 'Not found' });
});

server.listen(port, () => console.log(`醫療法規查詢器：http://localhost:${port}`));
