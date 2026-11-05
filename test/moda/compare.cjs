const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const baseline = JSON.parse(fs.readFileSync(path.join(process.argv[2], 'benchmark.json')));
const candidate = JSON.parse(fs.readFileSync(path.join(process.argv[3], 'benchmark.json')));
const summary = [];
for (const [name, current] of Object.entries(candidate.cases)) {
  const previous = baseline.cases[name];
  if (!previous) { summary.push({ name, nativeSupportAdded: true, ms: current.medianMs }); continue; }
  assert.deepEqual([current.width, current.height, current.density, current.icc], [previous.width, previous.height, previous.density, previous.icc], name + ' metadata');
  if (name !== 'jpeg-q96' && name !== 'decode-jpeg') assert.equal(current.decodedSha256, previous.decodedSha256, name + ' decoded pixels');
  else {
    const a = fs.readFileSync(path.join(process.argv[2], name + '.rgba'));
    const b = fs.readFileSync(path.join(process.argv[3], name + '.rgba'));
    assert.equal(a.length, b.length);
    let squared = 0;
    for (let i = 0; i < a.length; i++) squared += (a[i] - b[i]) ** 2;
    const psnr = squared ? 10 * Math.log10(255 * 255 / (squared / a.length)) : Infinity;
    assert.ok(psnr > 40, `JPEG decoder/encoder difference: ${psnr}dB`);
  }
  summary.push({ name, baselineMs: previous.medianMs, candidateMs: current.medianMs, speedup: previous.medianMs / current.medianMs, bytesRatio: current.bytes / previous.bytes });
}
console.log(JSON.stringify({ cpu: candidate.cpu, simd: candidate.simd, summary }, null, 2));
