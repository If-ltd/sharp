# Moda Sharp native PDF and performance runtime

Fork of Sharp v0.35.5, paired with If-ltd/sharp-libvips v1.3.4-moda.1. Native package and ABI versions remain unchanged; consumers pin immutable Release tarballs with explicit resolutions.

Windows packages include the PDFium DLL and all PDFium third-party notices alongside the shared libvips runtime. macOS requires version 13 or newer. Worker, Sharp and the TIFF encoder share this runtime.

The native CI exercises PDF buffer decoding and pixels, PNG palette output, JPEG, WebP, TIFF LZW/ICC/DPI, SVG, GIF and AVIF. Benchmarks compare baseline and candidate in separate processes on the same runner, including JPEG, PNG, palette PNG, WebP lossy/lossless, TIFF, composite, resize and native PDF. Lossless workload pixels and metadata must agree; JPEG differences are bounded separately. Timings are reported rather than assuming compiler flags improve every workload.
