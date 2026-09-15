import fs from 'node:fs/promises';
import zlib from 'node:zlib';

function decodeXml(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ').trim();
}

async function zipEntries(filePath) {
  const data = await fs.readFile(filePath);
  const result = new Map();
  let offset = 0;
  while (offset + 30 <= data.length && data.readUInt32LE(offset) === 0x04034b50) {
    const flags = data.readUInt16LE(offset + 6);
    const method = data.readUInt16LE(offset + 8);
    const compressedSize = data.readUInt32LE(offset + 18);
    const nameLength = data.readUInt16LE(offset + 26);
    const extraLength = data.readUInt16LE(offset + 28);
    const name = data.subarray(offset + 30, offset + 30 + nameLength).toString((flags & 0x800) ? 'utf8' : 'latin1');
    const start = offset + 30 + nameLength + extraLength;
    const compressed = data.subarray(start, start + compressedSize);
    try {
      result.set(name, method === 0 ? compressed : zlib.inflateRawSync(compressed));
    } catch { /* skip malformed or unsupported entries */ }
    offset = start + compressedSize;
  }
  return result;
}

export async function extractOfficeText(filePath, extension) {
  if (!['docx', 'docm', 'xlsx', 'xlsm', 'pptx', 'pptm'].includes(extension)) return '';
  const entries = await zipEntries(filePath);
  const xml = [];
  for (const [name, value] of entries) {
    if (name === 'word/document.xml' || name === 'xl/sharedStrings.xml' || name.startsWith('xl/worksheets/sheet') || name.startsWith('ppt/slides/slide')) {
      xml.push(value.toString('utf8'));
    }
  }
  return xml.map(decodeXml).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 12000);
}
