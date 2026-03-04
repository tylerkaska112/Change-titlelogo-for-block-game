/**
 * replace_logo.js
 *
 * Replaces the MenuTitle bitmap (ID 235) inside skinHDWin.swf,
 * then repacks the modified SWF back into MediaWindows64.arc.
 *
 * Usage:
 *   node replace_logo.js <path-to-new-logo.tga>
 *
 * The input TGA must be 32-bit RGBA (same size as original: 857x207,
 * or any size - the script will use whatever dimensions you provide).
 *
 * Output: MediaWindows64_patched.arc (next to the original .arc)
 */

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const ARC_PATH  = 'C:/Users/mom3h/Desktop/MinecraftConsolesource/Minecraft.Client/Common/Media/MediaWindows64.arc'; // Change this to wherever MediaWindows64.arc is located on your pc
const OUT_ARC   = 'C:/Users/mom3h/Desktop/MinecraftConsolesource/Minecraft.Client/Common/Media/MediaWindows64_patched.arc'; // Change this to wherever MediaWinows64.arc is located on your pc

// EX. const ARC_PATH = 'C:/ex/ex/ex/ex/Minecraft.Client/Common/Media/MediaWindows64.arc';
// EX. const OUT_ARC  = 'C:/ex/ex/ex/ex/Minecraft.Client/Common/Media/MediaWindows64_patched.arc';

const SWF_NAME  = 'skinHDWin.swf';
const BITMAP_ID = 235;  // MenuTitle  (change to 136 for MenuTitleSmall)
// ─────────────────────────────────────────────────────────────────────────────

if (process.argv.length < 3) {
  console.error('Usage: node replace_logo.js <new_logo.tga>');
  process.exit(1);
}
const newImagePath = process.argv[2];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Read big-endian int32 from buffer at offset
function readBEInt(buf, off) { return buf.readInt32BE(off); }

// Read Java DataInputStream UTF string (2-byte big-endian length + UTF-8)
function readJavaUTF(buf, off) {
  const len = buf.readUInt16BE(off);
  return { str: buf.toString('utf8', off + 2, off + 2 + len), nextOff: off + 2 + len };
}

// Write Java DataInputStream UTF string
function writeJavaUTF(str) {
  const strBuf = Buffer.from(str, 'utf8');
  const out = Buffer.alloc(2 + strBuf.length);
  out.writeUInt16BE(strBuf.length, 0);
  strBuf.copy(out, 2);
  return out;
}

// ── Parse .arc ────────────────────────────────────────────────────────────────
console.log('Reading archive:', ARC_PATH);
const arc = fs.readFileSync(ARC_PATH);
let arcPos = 0;

const fileCount = arc.readInt32BE(arcPos); arcPos += 4;
console.log('Files in archive:', fileCount);

const entries = [];
for (let i = 0; i < fileCount; i++) {
  const r = readJavaUTF(arc, arcPos);
  arcPos = r.nextOff;
  const ptr  = arc.readInt32BE(arcPos); arcPos += 4;
  const size = arc.readInt32BE(arcPos); arcPos += 4;

  let name = r.str;
  let isCompressed = false;
  if (name[0] === '*') { name = name.slice(1); isCompressed = true; }

  entries.push({ name, ptr, size, isCompressed, origName: r.str });
}

const headerDataSize = arcPos; // everything before first file blob

// ── Find and extract skinHDWin.swf ───────────────────────────────────────────
const swfEntry = entries.find(e => e.name === SWF_NAME);
if (!swfEntry) { console.error('Cannot find', SWF_NAME, 'in archive'); process.exit(1); }

console.log(`Found ${SWF_NAME}: ptr=${swfEntry.ptr} size=${swfEntry.size}`);
const swfRaw = arc.slice(swfEntry.ptr, swfEntry.ptr + swfEntry.size);

// Decompress SWF (CWS → FWS)
if (swfRaw[0] !== 0x43 || swfRaw[1] !== 0x57 || swfRaw[2] !== 0x53) {
  console.error('SWF is not CWS (compressed). Header:', swfRaw.slice(0,3).toString());
  process.exit(1);
}
console.log('Decompressing SWF...');
const swfUncompressedSize = swfRaw.readUInt32LE(4);
const swfDecompressed = zlib.inflateSync(swfRaw.slice(8));
const swf = Buffer.concat([swfRaw.slice(0, 8), swfDecompressed]);
console.log(`SWF decompressed: ${swf.length} bytes (header says ${swfUncompressedSize})`);

// ── Load new image (TGA or PNG) ───────────────────────────────────────────────
console.log('Loading new image:', newImagePath);
const imgFile = fs.readFileSync(newImagePath);

let imgWidth, imgHeight, argbPixels; // argbPixels = flat ARGB pre-multiplied, top-to-bottom

const ext = path.extname(newImagePath).toLowerCase();
const isPNG = ext === '.png' || (imgFile[0] === 0x89 && imgFile[1] === 0x50);
const isTGA = !isPNG;

if (isPNG) {
  // ── Decode PNG manually (no dependencies) ──────────────────────────────────
  // PNG: 8-byte sig, then chunks: 4-len + 4-type + data + 4-crc
  if (imgFile.readUInt32BE(0) !== 0x89504e47 || imgFile.readUInt32BE(4) !== 0x0d0a1a0a) {
    console.error('Not a valid PNG file.');
    process.exit(1);
  }

  let ihdr, idatParts = [];
  let pngPos = 8;
  while (pngPos < imgFile.length) {
    const chunkLen  = imgFile.readUInt32BE(pngPos);
    const chunkType = imgFile.toString('ascii', pngPos + 4, pngPos + 8);
    const chunkData = imgFile.slice(pngPos + 8, pngPos + 8 + chunkLen);
    pngPos += 12 + chunkLen;
    if (chunkType === 'IHDR') ihdr = chunkData;
    else if (chunkType === 'IDAT') idatParts.push(chunkData);
    else if (chunkType === 'IEND') break;
  }

  imgWidth  = ihdr.readUInt32BE(0);
  imgHeight = ihdr.readUInt32BE(4);
  const bitDepth  = ihdr[8];
  const colorType = ihdr[9]; // 2=RGB, 6=RGBA

  console.log(`PNG: ${imgWidth}x${imgHeight} depth=${bitDepth} colorType=${colorType}`);

  if (bitDepth !== 8) { console.error('PNG must be 8 bits per channel.'); process.exit(1); }
  if (colorType !== 2 && colorType !== 6) {
    console.error('PNG must be RGB (type 2) or RGBA (type 6). Got colorType:', colorType);
    console.error('Please save as RGB or RGBA PNG.');
    process.exit(1);
  }

  const hasAlpha = colorType === 6;
  const channels = hasAlpha ? 4 : 3;

  // Decompress IDAT
  const compressed = Buffer.concat(idatParts);
  const raw = zlib.inflateSync(compressed);

  // PNG filtering: each row has 1 filter byte + channels*width bytes
  const stride = channels * imgWidth;
  const reconstructed = Buffer.alloc(imgHeight * stride);

  for (let y = 0; y < imgHeight; y++) {
    const filterType = raw[y * (stride + 1)];
    const rowSrc = y * (stride + 1) + 1;
    const rowDst = y * stride;
    const prevDst = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? reconstructed[rowDst + x - channels] : 0;
      const b = y > 0 ? reconstructed[prevDst + x] : 0;
      const c = (y > 0 && x >= channels) ? reconstructed[prevDst + x - channels] : 0;
      const px = raw[rowSrc + x];

      let val;
      switch (filterType) {
        case 0: val = px; break;
        case 1: val = (px + a) & 0xff; break;
        case 2: val = (px + b) & 0xff; break;
        case 3: val = (px + Math.floor((a + b) / 2)) & 0xff; break;
        case 4: { // Paeth
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          val = (px + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default: val = px;
      }
      reconstructed[rowDst + x] = val;
    }
  }

  // Convert to ARGB pre-multiplied
  argbPixels = Buffer.alloc(imgWidth * imgHeight * 4);
  for (let i = 0; i < imgWidth * imgHeight; i++) {
    const r = reconstructed[i * channels + 0];
    const g = reconstructed[i * channels + 1];
    const b = reconstructed[i * channels + 2];
    const a = hasAlpha ? reconstructed[i * channels + 3] : 255;
    argbPixels[i*4 + 0] = a;
    argbPixels[i*4 + 1] = Math.round(r * a / 255);
    argbPixels[i*4 + 2] = Math.round(g * a / 255);
    argbPixels[i*4 + 3] = Math.round(b * a / 255);
  }

} else {
  // ── Decode TGA ─────────────────────────────────────────────────────────────
  const tgaType = imgFile[2];
  imgWidth      = imgFile.readUInt16LE(12);
  imgHeight     = imgFile.readUInt16LE(14);
  const tgaBpp  = imgFile[16];
  const tgaDesc = imgFile[17];

  console.log(`TGA: ${imgWidth}x${imgHeight} ${tgaBpp}bpp type=${tgaType}`);

  if (tgaType !== 2) {
    console.error('TGA must be uncompressed true-color (type 2). Got type:', tgaType);
    console.error('Please save as a flat TGA, or use a PNG instead.');
    process.exit(1);
  }
  if (tgaBpp !== 32) {
    console.error(`TGA must be 32-bit RGBA. Got ${tgaBpp}bpp.`);
    console.error('Please save with alpha channel (32-bit), or use a PNG instead.');
    process.exit(1);
  }

  const idLength   = imgFile[0];
  const pixelStart = 18 + idLength;
  const pixelData  = imgFile.slice(pixelStart);
  const topToBottom = (tgaDesc & 0x20) !== 0;

  argbPixels = Buffer.alloc(imgWidth * imgHeight * 4);
  for (let row = 0; row < imgHeight; row++) {
    const srcRow = topToBottom ? row : (imgHeight - 1 - row);
    for (let col = 0; col < imgWidth; col++) {
      const srcIdx = (srcRow * imgWidth + col) * 4;
      const dstIdx = (row   * imgWidth + col) * 4;
      const b = pixelData[srcIdx + 0];
      const g = pixelData[srcIdx + 1];
      const r = pixelData[srcIdx + 2];
      const a = pixelData[srcIdx + 3];
      argbPixels[dstIdx + 0] = a;
      argbPixels[dstIdx + 1] = Math.round(r * a / 255);
      argbPixels[dstIdx + 2] = Math.round(g * a / 255);
      argbPixels[dstIdx + 3] = Math.round(b * a / 255);
    }
  }
}

console.log(`Image loaded: ${imgWidth}x${imgHeight}`);

// Compress pixel data with zlib (deflate)
console.log('Compressing new image pixels...');
const compressed = zlib.deflateSync(argbPixels, { level: 9 });

// ── Build new DefineBitsLossless2 tag ─────────────────────────────────────────
// Tag type 36 = DefineBitsLossless2
// Layout: [TagType+Len 2b] [LongLen? 4b] [CharacterID 2b] [Format 1b] [Width 2b] [Height 2b] [ZlibData]
const tagDataLen = 2 + 1 + 2 + 2 + compressed.length; // id + format + w + h + pixels
const newTagBuf = Buffer.alloc(6 + tagDataLen); // 2 (short hdr) + 4 (long len) + data
let wp = 0;
newTagBuf.writeUInt16LE((36 << 6) | 0x3f, wp); wp += 2;  // tag type 36, long length
newTagBuf.writeInt32LE(tagDataLen, wp);          wp += 4;
newTagBuf.writeUInt16LE(BITMAP_ID, wp);          wp += 2;
newTagBuf[wp] = 5;                               wp += 1;  // format 5 = ARGB
newTagBuf.writeUInt16LE(imgWidth, wp);           wp += 2;
newTagBuf.writeUInt16LE(imgHeight, wp);          wp += 2;
compressed.copy(newTagBuf, wp);

// ── Scan SWF and replace the target DefineBitsLossless2 tag ──────────────────
console.log(`Replacing DefineBitsLossless2 bitmap ID ${BITMAP_ID} in SWF...`);

// Re-parse SWF header to find start of tags
let sp = 8;
const nbits = (swf[sp] >> 3) & 0x1f;
const rectBits = 5 + 4 * nbits;
sp += Math.ceil(rectBits / 8);
sp += 4; // frame rate + count
const tagsStart = sp;

const before = [];  // chunks before the target tag
const after  = [];  // chunks after the target tag
let found = false;

sp = tagsStart;
while (sp < swf.length) {
  const tagAndLen = swf.readUInt16LE(sp);
  const tagType = (tagAndLen >> 6) & 0x3ff;
  let tagLen = tagAndLen & 0x3f;
  const tagHeaderSize = 2;
  sp += 2;
  let extraHeaderSize = 0;
  if (tagLen === 63) {
    tagLen = swf.readInt32LE(sp);
    sp += 4;
    extraHeaderSize = 4;
  }
  const fullTagSize = 2 + extraHeaderSize + tagLen;
  const tagStart = sp - 2 - extraHeaderSize;

  if (tagType === 36) { // DefineBitsLossless2
    const bitmapId = swf.readUInt16LE(sp);
    if (bitmapId === BITMAP_ID) {
      console.log(`  Found target tag at offset ${tagStart}, old size=${fullTagSize}, new size=${newTagBuf.length}`);
      before.push(swf.slice(0, tagStart));
      after.push(swf.slice(tagStart + fullTagSize));
      found = true;
      break;
    }
  }

  sp += tagLen;
  if (tagType === 0) break;
}

if (!found) {
  console.error(`Bitmap ID ${BITMAP_ID} (DefineBitsLossless2) not found in SWF!`);
  process.exit(1);
}

// Rebuild SWF buffer with replaced tag
const newSwf = Buffer.concat([before[0], newTagBuf, after[0]]);

// Update uncompressed size field in SWF header (bytes 4-7, little-endian)
newSwf.writeUInt32LE(newSwf.length, 4);

// Re-compress the SWF (CWS)
console.log('Re-compressing SWF...');
const recompressed = zlib.deflateSync(newSwf.slice(8), { level: 9 });
const newSwfCws = Buffer.concat([
  Buffer.from([0x43, 0x57, 0x53]),  // CWS
  Buffer.from([newSwf[3]]),          // version
  newSwf.slice(4, 8),                // uncompressed size
  recompressed
]);
console.log(`New SWF size: ${newSwfCws.length} (was ${swfRaw.length})`);

// ── Rebuild the .arc file ─────────────────────────────────────────────────────
console.log('Rebuilding archive...');

// We need to rebuild the entire archive because the SWF size changed,
// which shifts all subsequent file offsets.

// Collect all file blobs (extract from original arc, but replace our SWF)
const blobs = [];
for (const entry of entries) {
  if (entry.name === SWF_NAME) {
    blobs.push(newSwfCws);
  } else {
    blobs.push(arc.slice(entry.ptr, entry.ptr + entry.size));
  }
}

// Calculate new offsets
// Header: 4 bytes (count) + for each entry: UTF string + 4 (ptr) + 4 (size)
// We need to compute header size first to know where blobs start

function javaUTFSize(str) {
  return 2 + Buffer.byteLength(str, 'utf8');
}

let headerSize = 4; // file count
for (const entry of entries) {
  headerSize += javaUTFSize(entry.origName) + 4 + 4;
}

// Now assign new offsets
let dataOffset = headerSize;
const newOffsets = [];
for (let i = 0; i < entries.length; i++) {
  newOffsets.push(dataOffset);
  dataOffset += blobs[i].length;
}

// Build new header
const headerParts = [Buffer.alloc(4)];
headerParts[0].writeInt32BE(fileCount, 0);

for (let i = 0; i < entries.length; i++) {
  const entry = entries[i];
  headerParts.push(writeJavaUTF(entry.origName));
  const ptrBuf = Buffer.alloc(8);
  ptrBuf.writeInt32BE(newOffsets[i], 0);
  ptrBuf.writeInt32BE(blobs[i].length, 4);
  headerParts.push(ptrBuf);
}

const newArc = Buffer.concat([...headerParts, ...blobs]);
console.log(`Writing patched archive: ${OUT_ARC}`);
console.log(`Archive size: ${newArc.length} bytes (was ${arc.length})`);
fs.writeFileSync(OUT_ARC, newArc);
console.log('Done! Patched archive written to:');
console.log(' ', OUT_ARC);
console.log('');
console.log('To apply: replace MediaWindows64.arc with MediaWindows64_patched.arc');
console.log('  copy /Y "' + OUT_ARC + '" "' + ARC_PATH + '"');
