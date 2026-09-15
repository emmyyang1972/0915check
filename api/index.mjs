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
function htmlEscape(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

function matches(doc, params) {
  const filters = [
    ['folderCategory', doc.folderCategory],
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
    if (q && (doc.primaryTopic ?? '').toLowerCase().includes(q)) score += 4;
    if (q && (doc.folderCategory ?? '').toLowerCase().includes(q)) score += 8;
    if (q && (doc.documentType ?? '').toLowerCase().includes(q)) score += 3;
    if (q && (doc.contentSample ?? '').toLowerCase().includes(q)) score += 2;
    return { ...doc, score };
  }).filter(doc => !q || doc.score > 0).sort((a, b) => b.score - a.score || a.fileName.localeCompare(b.fileName, 'zh-Hant'));
}

export default async function handler(req, res) {
  const params = new URL(req.url, `https://${req.headers.host ?? 'localhost'}`).searchParams;
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (params.get('endpoint') === 'file') {
    const doc = documents.find(item => item.documentId === params.get('id'));
    if (!doc) return json(res, 404, { error: 'Document not found' });
    try {
      const body = await fs.readFile(doc.absolutePath);
      res.status(200).setHeader('Content-Type', ({ pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[doc.extension] ?? 'application/octet-stream'));
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`); return res.end(body);
    } catch {
      const sample = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(doc.contentSample ?? '') ? '' : doc.contentSample;
      res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(`<!doctype html><meta charset="utf-8"><title>${htmlEscape(doc.title)}</title><style>body{font-family:system-ui,"Microsoft JhengHei";max-width:900px;margin:40px auto;padding:0 20px;color:#17395f}h1{line-height:1.4}dt{font-weight:bold;margin-top:14px}dd{margin:4px 0;color:#526b84;word-break:break-all}pre{white-space:pre-wrap;background:#f1f6fb;padding:16px;border-radius:10px}</style><h1>${htmlEscape(doc.title)}</h1><dl><dt>科別</dt><dd>${htmlEscape(doc.folderCategory)}</dd><dt>年份</dt><dd>${htmlEscape(doc.year)}</dd><dt>來源路徑</dt><dd>${htmlEscape(doc.relativePath)}</dd><dt>展示狀態</dt><dd>線上部署未包含原始檔案，以下為索引資料；請在原始資料夾開啟完整文件。</dd></dl>${sample ? `<h2>可讀文字摘錄</h2><pre>${htmlEscape(sample)}</pre>` : ''}`);
    }
  }
  if (params.get('endpoint') === 'health') return json(res, 200, { ok: true, indexed: documents.length, generatedAt: index.generatedAt });
  if (params.get('endpoint') === 'facets') {
    const filtered = documents.filter(doc => matches(doc, params));
    return json(res, 200, { total: filtered.length, review: filtered.filter(doc => doc.classificationStatus === 'needs_review').length, folderCategory: countBy('folderCategory', filtered), jurisdiction: countBy('jurisdiction', filtered), documentType: countBy('documentType', filtered), primaryTopic: countBy('primaryTopic', filtered), region: countBy('region', filtered), year: countBy('year', filtered), extension: countBy('extension', filtered) });
  }
  if (params.get('endpoint') === 'search') {
    const results = search(params).slice(0, 500);
    return json(res, 200, { total: results.length, indexed: documents.length, results });
  }
  return json(res, 400, { error: 'Missing endpoint' });
}
