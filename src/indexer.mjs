import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { classify } from './classifier.mjs';
import { extractOfficeText } from './office-text.mjs';
import { extractPdfText } from './pdf-text.mjs';

const sourceRoot = path.resolve(process.argv[2] ?? process.env.REGULATORY_SOURCE ?? 'C:\\6.查检相关法律法规');
const outputPath = path.resolve(process.argv[3] ?? path.resolve('data', 'index.json'));
const extractPdf = process.env.PDF_TEXT === '1';
const supported = new Set(['.pdf', '.doc', '.docx', '.docm', '.xls', '.xlsx', '.ppt', '.pptx', '.wps', '.txt', '.md']);
const stats = { scanned: 0, indexed: 0, unsupported: 0, pdfText: 0, pdfPendingOcr: 0, officeText: 0, extractionErrors: 0 };
async function walk(dir) { const files = []; for (const entry of await fs.readdir(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) files.push(...await walk(full)); else files.push(full); } return files.sort((a, b) => a.localeCompare(b, 'zh-Hant')); }
function idFor(value) { return crypto.createHash('sha1').update(value).digest('hex').slice(0, 16); }
function cleanName(name) { return name.replace(/\.(pdf|docx?|docm|xlsx?|pptx?|pptm|wps|txt|md)$/iu, '').replace(/^\[[^\]]+\]\s*/, '').replace(/\s*\(\d+\)$/, '').trim(); }
function yearsOf(value) { return [...new Set(value.match(/(?:19|20)\d{2}/g) ?? [])].sort().reverse(); }
function regionOf(value) { const names = ['北京', '上海', '天津', '重慶', '重庆', '河北', '山西', '遼寧', '辽宁', '吉林', '黑龍江', '黑龙江', '江蘇', '江苏', '浙江', '安徽', '福建', '江西', '山東', '山东', '河南', '湖北', '湖南', '廣東', '广东', '廣西', '广西', '海南', '四川', '貴州', '贵州', '雲南', '云南', '西藏', '陝西', '陕西', '甘肅', '甘肃', '青海', '寧夏', '宁夏', '新疆', '香港', '澳門', '澳门', '台灣', '臺灣', '台湾']; return names.find(name => value.includes(name)) ?? '地區待確認'; }
function hierarchy(relativePath) { const parts = relativePath.split(/[\\/]+/); const first = parts.find(part => /^\d{2}_/.test(part)) ?? '90_待人工確認'; const start = parts.indexOf(first); const rest = parts.slice(start + 1, -1); const yearFromFolder = [...rest].reverse().find(part => /^(?:19|20)\d{2}$/.test(part)) ?? ''; const second = first.startsWith('17_') ? (rest.find(part => /^\d{2}_/.test(part)) ?? '90_其他後勤') : '（無）'; return { folderCategory: first.replace(/^\d{2}_/, ''), subcategory: second.replace(/^\d{2}_/, ''), yearFromFolder }; }
function statusFor(doc) { return doc.confidence >= 0.7 && doc.contentExtraction !== 'error' ? 'classified_candidate' : 'needs_review'; }

const files = await walk(sourceRoot); const documents = [];
for (const fullPath of files) {
  stats.scanned++; const ext = path.extname(fullPath).toLowerCase(); if (!supported.has(ext)) { stats.unsupported++; continue; }
  const stat = await fs.stat(fullPath); const relativePath = path.relative(sourceRoot, fullPath); const fileName = path.basename(fullPath); const h = hierarchy(relativePath); let contentSample = ''; let contentExtraction = 'not_attempted';
  try {
    if (ext === '.pdf') { if (extractPdf) { contentSample = await extractPdfText(fullPath); contentExtraction = contentSample ? 'pdf_text_layer' : 'pdf_needs_ocr'; if (contentSample) stats.pdfText++; else stats.pdfPendingOcr++; } else { contentExtraction = 'pdf_pending_text_extraction'; stats.pdfPendingOcr++; } }
    else if (['.docx', '.docm', '.xlsx', '.xls', '.pptx', '.pptm'].includes(ext)) { contentSample = await extractOfficeText(fullPath, ext.slice(1)); contentExtraction = contentSample ? 'office_xml' : 'empty_or_unsupported'; if (contentSample) stats.officeText++; }
    else contentExtraction = 'filename_only';
  } catch { contentExtraction = 'error'; stats.extractionErrors++; }
  const title = cleanName(fileName); const allText = `${relativePath} ${title} ${contentSample}`; const years = yearsOf(allText); const year = h.yearFromFolder || years[0] || '未標示年份'; const classification = classify(`${relativePath} ${title}`, contentSample); const contentHash = crypto.createHash('sha256').update(await fs.readFile(fullPath)).digest('hex');
  const doc = { documentId: idFor(relativePath), title, normalizedTitle: title.replace(/[《》「」（）()\s]/g, '').toLowerCase(), fileName, extension: ext.slice(1), relativePath, absolutePath: fullPath, sourcePath: fullPath, folderCategory: h.folderCategory, subcategory: h.subcategory, region: regionOf(allText), year, years: [...new Set([year, ...years].filter(item => item !== '未標示年份'))], size: stat.size, modifiedAt: stat.mtime.toISOString(), contentHash, contentExtraction, contentSample: contentSample.slice(0, 1500), status: 'pending', reviewStatus: 'unreviewed', classificationMethod: 'source-folder-filename-content-rules', ...classification };
  doc.classificationStatus = statusFor(doc); doc.reviewReasons = [doc.jurisdiction === 'UNKNOWN' && 'jurisdiction', doc.primaryTopic === '其他／待確認' && 'medical_topic', doc.contentExtraction === 'pdf_needs_ocr' && 'pdf_ocr'].filter(Boolean); documents.push(doc); stats.indexed++;
}
await fs.mkdir(path.dirname(outputPath), { recursive: true }); await fs.writeFile(outputPath, JSON.stringify({ schemaVersion: '2.0', generatedAt: new Date().toISOString(), sourceRoot, sourcePolicy: 'fresh-read-of-source-folder', stats, documents }, null, 2), 'utf8'); console.log(JSON.stringify({ outputPath, sourceRoot, ...stats }, null, 2));
