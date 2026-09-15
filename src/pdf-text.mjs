import fs from 'node:fs/promises';
import zlib from 'node:zlib';

function decodeLiteral(value) {
  return value.replace(/\\([\\()nrtbf])/g, (_, c) => ({ '\\': '\\', '(': '(', ')': ')', n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[c] ?? c)).replace(/\\(\d{1,3})/g, (_, n) => String.fromCharCode(parseInt(n, 8)));
}

function decodeHex(value) {
  const clean = value.replace(/\s/g, '');
  const bytes = Buffer.from(clean.length % 2 ? `${clean}0` : clean, 'hex');
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let output = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) output += String.fromCharCode(bytes.readUInt16BE(i));
    return output;
  }
  return bytes.toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function extractOperators(text) {
  const chunks = [];
  for (const match of text.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) chunks.push(decodeLiteral(match[0].replace(/\)\s*Tj$/, '').slice(1)));
  for (const match of text.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) chunks.push(decodeHex(match[1]));
  for (const match of text.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    for (const literal of match[1].matchAll(/\((?:\\.|[^\\)])*\)/g)) chunks.push(decodeLiteral(literal[0].slice(1, -1)));
    for (const hex of match[1].matchAll(/<([0-9A-Fa-f\s]+)>/g)) chunks.push(decodeHex(hex[1]));
  }
  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

export async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);
  // Avoid spending time inflating scanned image streams; legal PDFs with a text
  // layer normally keep their page text streams relatively small.
  const source = buffer.toString('latin1');
  const chunks = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('stream', cursor);
    if (start < 0) break;
    const dataStart = source[start + 6] === '\r' && source[start + 7] === '\n' ? start + 8 : start + 7;
    const end = source.indexOf('endstream', dataStart);
    if (end < 0) break;
    const dictionary = source.slice(Math.max(0, start - 500), start);
    const raw = buffer.subarray(dataStart, end);
    try {
      if (/\/Subtype\s*\/Image|\/DCTDecode|\/JPXDecode/.test(dictionary) || raw.length > 1024 * 1024) {
        cursor = end + 9;
        continue;
      }
      const decoded = /\/FlateDecode/.test(dictionary) ? zlib.inflateSync(raw) : raw;
      const text = extractOperators(decoded.toString('latin1'));
      if (text) chunks.push(text);
    } catch { /* ignore image and unsupported streams */ }
    cursor = end + 9;
  }
  return chunks.join(' ').replace(/\s+/g, ' ').trim().slice(0, 12000);
}
