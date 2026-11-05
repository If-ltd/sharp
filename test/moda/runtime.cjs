const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('../..');
const pdf = require('./pdf-fixture.cjs')();
(async () => {
  assert.equal(sharp.simd(), true, 'runtime SIMD must be enabled');
  assert.equal(sharp.format.pdf.input.buffer, true, 'native PDF buffer loader is required');
  const { data, info } = await sharp(pdf, { density: 144 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [568, 852, 4]);
  assert.deepEqual([...data.subarray((772 * 568 + 80) * 4, (772 * 568 + 80) * 4 + 4)], [255, 0, 0, 255]);
  assert.deepEqual([...data.subarray(0, 4)], [255, 255, 255, 255]);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="red"/></svg>');
  const source = await sharp(svg).png().toBuffer();
  for (const [format, options] of [['png', { palette: true, quality: 100 }], ['webp', { lossless: true }], ['tiff', { compression: 'lzw' }], ['jpeg', { quality: 96 }], ['gif', {}], ['avif', { lossless: true, effort: 0 }]]) {
    const encoded = await sharp(source)[format](options).withMetadata({ density: 300 }).toBuffer();
    const metadata = await sharp(encoded).metadata();
    assert.deepEqual([metadata.width, metadata.height], [64, 48], format);
    const decoded = await sharp(encoded).removeAlpha().raw().toBuffer();
    assert.ok(decoded[0] >= 250 && decoded[1] <= 5 && decoded[2] <= 5, `${format} colours`);
    if (format === 'tiff') {
      assert.equal(metadata.density, 300);
      assert.ok(metadata.icc?.length, 'TIFF ICC profile is required');
    }
  }
  const output = process.argv[2];
  if (output) {
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'native-pdf-fixture.pdf'), pdf);
  }
  console.log(JSON.stringify({ platform: process.platform, arch: process.arch, simd: sharp.simd(), versions: sharp.versions, formats: ['pdf', 'svg', 'jpeg', 'png-palette', 'webp', 'tiff-lzw-icc-dpi', 'gif', 'avif'] }));
})().catch(error => { console.error(error); process.exitCode = 1; });
