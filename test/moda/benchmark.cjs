const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const sharp = require(path.resolve(process.argv[2]));
const output = path.resolve(process.argv[3]);
const pdf = require('./pdf-fixture.cjs')();
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
(async () => {
  sharp.cache(false);
  sharp.concurrency(4);
  fs.mkdirSync(output, { recursive: true });
  // Share actual input bytes between processes so codec changes are measured independently.
  const sourceDirectory = path.resolve(process.argv[4] || output);
  fs.mkdirSync(sourceDirectory, { recursive: true });
  const sourceFile = path.join(sourceDirectory, 'source.rgba');
  if (!fs.existsSync(sourceFile)) {
    const decoded = await sharp(path.resolve(__dirname, '../fixtures/2569067123_aca715a2ee_o.jpg')).resize(3072, 2048, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
    fs.writeFileSync(sourceFile, decoded);
    for (const [format, options] of [['jpeg', { quality: 96 }], ['png', { compressionLevel: 6 }], ['webp', { quality: 90 }], ['tiff', { compression: 'lzw' }]]) {
      const encoded = await sharp(decoded, { raw: { width: 3072, height: 2048, channels: 4 } })[format](options).toBuffer();
      fs.writeFileSync(path.join(sourceDirectory, 'source.' + format), encoded);
    }
  }
  const photo = fs.readFileSync(sourceFile);
  const image = () => sharp(photo, { raw: { width: 3072, height: 2048, channels: 4 } });
  const overlay = await image().resize(1024, 768).png().toBuffer();
  const cases = {
    'jpeg-q96': () => image().flatten({ background: 'white' }).jpeg({ quality: 96 }).toBuffer(),
    'png-rgba': () => image().png({ compressionLevel: 6, adaptiveFiltering: true }).toBuffer(),
    'png-palette': () => image().resize(1024).png({ palette: true, quality: 100 }).toBuffer(),
    'webp-q90': () => image().webp({ quality: 90 }).toBuffer(),
    'webp-lossless': () => image().resize(1024).webp({ lossless: true }).toBuffer(),
    'tiff-lzw-icc-dpi': () => image().withMetadata({ density: 300 }).tiff({ compression: 'lzw', tile: true, pyramid: false }).toBuffer(),
    'layout-composite': () => image().composite([{ input: overlay, left: 120, top: 160 }]).png({ compressionLevel: 1 }).toBuffer(),
    'resize-lanczos': () => image().resize(1536, 1024, { kernel: 'lanczos2' }).png({ compressionLevel: 1 }).toBuffer()
  };
  for (const format of ['jpeg', 'png', 'webp', 'tiff']) {
    const input = fs.readFileSync(path.join(sourceDirectory, 'source.' + format));
    cases['decode-' + format] = () => sharp(input).ensureAlpha().raw().toBuffer();
  }
  if (sharp.format.pdf.input.buffer) cases['pdf-300dpi'] = () => sharp(pdf, { density: 300 }).png().toBuffer();
  const result = { platform: process.platform, arch: process.arch, cpu: os.cpus()[0].model, concurrency: sharp.concurrency(), simd: sharp.simd(), versions: sharp.versions, cases: {} };
  for (const [name, operation] of Object.entries(cases)) {
    await operation();
    const elapsed = [];
    let buffer;
    for (let i = 0; i < 5; i++) {
      const started = performance.now();
      buffer = await operation();
      elapsed.push(performance.now() - started);
    }
    const read = () => name.startsWith('decode-') ? sharp(buffer, { raw: { width: 3072, height: 2048, channels: 4 } }) : sharp(buffer);
    const decoded = await read().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    fs.writeFileSync(path.join(output, name + '.rgba'), decoded.data);
    const metadata = await read().metadata();
    result.cases[name] = { medianMs: median(elapsed), samplesMs: elapsed, bytes: buffer.length, width: metadata.width, height: metadata.height, density: metadata.density, icc: metadata.icc && crypto.createHash('sha256').update(metadata.icc).digest('hex'), decodedSha256: crypto.createHash('sha256').update(decoded.data).digest('hex') };
  }
  fs.writeFileSync(path.join(output, 'benchmark.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
