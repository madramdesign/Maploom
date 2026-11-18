import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { crc32, createDeflate } from 'node:zlib';

/**
 * Streaming PNG writer. Rows are pushed strip by strip, so a 14400×21600
 * print file never has to exist in memory as one bitmap. Output is 8-bit RGB
 * (artwork is opaque) with a pHYs chunk so print software sees the right DPI.
 */
export class PngWriter {
  private out;
  private deflate;
  private rowsWritten = 0;
  private done: Promise<void>;

  constructor(file: string, readonly width: number, readonly height: number, dpi?: number) {
    this.out = createWriteStream(file);
    this.out.write(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // colour type: RGB
    this.chunk('IHDR', ihdr);
    this.chunk('sRGB', Buffer.from([0]));
    if (dpi) {
      const phys = Buffer.alloc(9);
      const ppm = Math.round(dpi / 0.0254);
      phys.writeUInt32BE(ppm, 0);
      phys.writeUInt32BE(ppm, 4);
      phys[8] = 1;
      this.chunk('pHYs', phys);
    }
    this.deflate = createDeflate({ level: 6, chunkSize: 1 << 20 });
    this.deflate.on('data', (buf: Buffer) => this.chunk('IDAT', buf));
    this.done = new Promise((resolve, reject) => {
      this.deflate.on('end', resolve);
      this.deflate.on('error', reject);
      this.out.on('error', reject);
    });
  }

  private chunk(type: string, data: Buffer) {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(data, crc32(head.subarray(4))) >>> 0, 0);
    this.out.write(head);
    this.out.write(data);
    this.out.write(crc);
  }

  /** Append `rows` scanlines of RGBA pixels (alpha is dropped). */
  async writeRgba(rgba: Uint8Array, rows: number): Promise<void> {
    const w = this.width;
    if (rgba.length < rows * w * 4) throw new Error('strip buffer too small');
    if (this.rowsWritten + rows > this.height) throw new Error('too many rows');
    const stride = w * 3 + 1;
    // Filter in ~32 MB batches to bound memory.
    const batchRows = Math.max(1, Math.floor((32 << 20) / stride));
    for (let r0 = 0; r0 < rows; r0 += batchRows) {
      const nRows = Math.min(batchRows, rows - r0);
      const buf = Buffer.allocUnsafe(nRows * stride);
      for (let r = 0; r < nRows; r++) {
        let o = r * stride;
        let i = (r0 + r) * w * 4;
        buf[o++] = 1; // filter: Sub
        let pr = 0;
        let pg = 0;
        let pb = 0;
        for (let x = 0; x < w; x++) {
          const R = rgba[i];
          const G = rgba[i + 1];
          const B = rgba[i + 2];
          buf[o++] = (R - pr) & 255;
          buf[o++] = (G - pg) & 255;
          buf[o++] = (B - pb) & 255;
          pr = R;
          pg = G;
          pb = B;
          i += 4;
        }
      }
      if (!this.deflate.write(buf)) await once(this.deflate, 'drain');
    }
    this.rowsWritten += rows;
  }

  async finish(): Promise<void> {
    if (this.rowsWritten !== this.height) throw new Error(`PNG incomplete: ${this.rowsWritten}/${this.height} rows`);
    this.deflate.end();
    await this.done;
    this.chunk('IEND', Buffer.alloc(0));
    await new Promise<void>((resolve, reject) => this.out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  }
}
