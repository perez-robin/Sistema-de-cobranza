import fs from 'fs';
import zlib from 'zlib';

function createPng(width, height, r, g, b) {
  // Simple PNG encoder for a solid/gradient icon with blue & gold border
  const bytesPerPixel = 4;
  const rowSize = 1 + width * bytesPerPixel;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * bytesPerPixel;
      // Gradient calculation
      const t = (x + y) / (width + height);
      const pr = Math.round(r * (1 - t * 0.4));
      const pg = Math.round(g * (1 - t * 0.3));
      const pb = Math.round(b * (1 - t * 0.2));

      // Border check (outer 8% gold border)
      const border = Math.round(width * 0.04);
      const isBorder = (x < border || x >= width - border || y < border || y >= height - border);

      if (isBorder) {
        rawData[pxOffset] = 245;     // Gold R
        rawData[pxOffset + 1] = 158; // Gold G
        rawData[pxOffset + 2] = 11;  // Gold B
        rawData[pxOffset + 3] = 255;
      } else {
        rawData[pxOffset] = pr;
        rawData[pxOffset + 1] = pg;
        rawData[pxOffset + 2] = pb;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdr = chunk('IHDR', ihdrData);
  const idat = chunk('IDAT', deflated);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

// Precomputed CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Generate PWA icons
fs.writeFileSync('public/icon-192.png', createPng(192, 192, 30, 58, 138));
fs.writeFileSync('public/icon-512.png', createPng(512, 512, 30, 58, 138));
fs.writeFileSync('public/icon-maskable-512.png', createPng(512, 512, 23, 37, 84));
fs.writeFileSync('public/apple-touch-icon.png', createPng(180, 180, 30, 58, 138));
console.log('Icons generated successfully');
