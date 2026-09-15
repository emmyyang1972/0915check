import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { classify } from './classifier.mjs';
import { extractOfficeText } from './office-text.mjs';
import { extractPdfText } from './pdf-text.mjs';

const sourceRoot = process.argv[2] ?? process.env.REGULATORY_SOURCE;
const outputPath = process.argv[3] ?? path.resolve('data', 'index.json');
const pdfTextEnabled = process.env.PDF_TEXT === '1';

if (!sourceRoot) {
  console.error('用法：npm run index -- "D:\\6.查检相关法律法规"');
  process.exit(1);
}

const supported = new Set(['.pdf', '.doc', '.docx', '.docm', '.xls', '.xlsx', '.ppt', '.pptx', '.wps', '.txt', '.md']);
const stats = { scanned: 0, indexed: 0, unsupported: 0 };

async function walk(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full));
    else result.push(full);
  }
  return result;
}

function stableId(relativePath) {
  return crypto.createHash('sha1').update(relativePath).digest('hex').slice(0, 16);
}

const regionRules = [
  ['台灣', /台灣|臺灣|台北|臺北|新北|桃園|新竹|苗栗|台中|臺中|彰化|南投|雲林|嘉義|台南|臺南|高雄|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|連江/iu],
  ['北京', /北京/iu], ['上海', /上海/iu], ['天津', /天津/iu], ['重慶', /重慶|重庆/iu],
  ['廣東', /廣東|广东|深圳|廣州|广州/iu], ['江蘇', /江蘇|江苏|南京|蘇州|苏州/iu],
  ['浙江', /浙江|杭州/iu], ['山東', /山東|山东|濟南|济南/iu], ['河南', /河南|鄭州|郑州/iu],
  ['湖北', /湖北|武漢|武汉/iu], ['湖南', /湖南|長沙|长沙/iu], ['四川', /四川|成都/iu],
  ['河北', /河北|石家莊|石家庄/iu], ['山西', /山西|太原/iu], ['陝西', /陝西|陕西|西安/iu],
  ['遼寧', /遼寧|辽宁|瀋陽|沈阳/iu], ['吉林', /吉林|長春|长春/iu], ['黑龍江', /黑龍江|黑龙江|哈爾濱|哈尔滨/iu],
  ['安徽', /安徽|合肥/iu], ['福建', /福建|福州|廈門|厦门/iu], ['江西', /江西|南昌/iu],
  ['廣西', /廣西|广西|南寧|南宁/iu], ['海南', /海南|海口/iu], ['貴州', /貴州|贵州|貴陽|贵阳/iu],
  ['雲南', /雲南|云南|昆明/iu], ['甘肅', /甘肅|甘肃|蘭州|兰州/iu], ['青海', /青海|西寧|西宁/iu],
  ['內蒙古', /內蒙古|内蒙古/iu], ['新疆', /新疆/iu], ['西藏', /西藏/iu], ['寧夏', /寧夏|宁夏/iu]
];

function deriveYears(value) {
  return [...new Set([...value.matchAll(/(?:19|20)\d{2}/g)].map(match => match[0]))].sort().reverse();
}

function deriveRegion(value) {
  return regionRules.find(([, rule]) => rule.test(value))?.[0] ?? '地區待確認';
}

const files = await walk(sourceRoot);
const documents = [];
for (const fullPath of files) {
  stats.scanned++;
  const ext = path.extname(fullPath).toLowerCase();
  if (!supported.has(ext)) { stats.unsupported++; continue; }
  const stat = await fs.stat(fullPath);
  const relativePath = path.relative(sourceRoot, fullPath);
  const fileName = path.basename(fullPath);
  let contentSample = '';
  let contentExtraction = 'not_attempted';
  try {
    if (ext === '.pdf' && pdfTextEnabled) {
      contentSample = await extractPdfText(fullPath);
      contentExtraction = contentSample ? 'pdf_text_layer' : 'pdf_needs_ocr';
    } else if (ext === '.pdf') {
      contentExtraction = 'pdf_pending_text_extraction';
    } else {
      contentSample = await extractOfficeText(fullPath, ext.slice(1));
      contentExtraction = contentSample ? 'office_xml' : (['docx', 'docm', 'xlsx', 'xlsm', 'pptx', 'pptm'].includes(ext.slice(1)) ? 'empty_or_unsupported' : 'not_supported');
    }
  } catch {
    contentExtraction = 'error';
  }
  const classification = classify(relativePath, fileName, contentSample);
  const years = deriveYears(`${relativePath} ${fileName}`);
  const region = deriveRegion(`${relativePath} ${fileName}`);
  documents.push({
    documentId: stableId(relativePath),
    fileName,
    extension: ext.slice(1),
    relativePath,
    absolutePath: fullPath,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    years,
    year: years[0] ?? '年份待確認',
    region,
    contentExtraction,
    contentSample: contentSample.slice(0, 1000),
    indexedAt: new Date().toISOString(),
    status: 'pending',
    reviewStatus: 'unreviewed',
    classificationStatus: classification.primaryTopic !== '其他／待確認' || classification.documentType !== '待確認或非規範文件' ? 'classified_candidate' : 'needs_review',
    reviewReasons: [
      classification.jurisdiction === 'UNKNOWN' ? 'jurisdiction' : null,
      classification.documentType === '待確認或非規範文件' ? 'document_type' : null,
      classification.primaryTopic === '其他／待確認' ? 'medical_topic' : null
    ].filter(Boolean),
    classificationMethod: 'filename_and_path_rules',
    ...classification
  });
  stats.indexed++;
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceRoot,
  stats,
  documents
}, null, 2), 'utf8');

console.log(JSON.stringify({ outputPath, ...stats }, null, 2));
