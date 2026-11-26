/**
 * Renders a deterministic scannable-style 21x21 QR verification matrix onto a 2D canvas
 * encoding the geospatial coordinate payload and project verification hash.
 */
export function drawVerificationQRCode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  payload: string
): void {
  const modules = 21;
  const cell = size / modules;

  // White quiet zone background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(x, y, size, size);

  // Compute deterministic bit stream from payload string
  const hashes: number[] = [];
  let h1 = 2166136261;
  let h2 = 16777619;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 16777619);
    h2 = (h2 + ch * (i + 1)) | 0;
    hashes.push(Math.abs(h1 ^ h2));
  }
  if (hashes.length === 0) hashes.push(123456789);

  const isFinderPattern = (r: number, c: number): boolean => {
    const inTopLeft = r < 7 && c < 7;
    const inTopRight = r < 7 && c >= modules - 7;
    const inBottomLeft = r >= modules - 7 && c < 7;
    return inTopLeft || inTopRight || inBottomLeft;
  };

  const drawFinder = (startR: number, startC: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (isBorder || isInner) {
          ctx.fillStyle = '#07090E';
          ctx.fillRect(
            x + (startC + c) * cell,
            y + (startR + r) * cell,
            Math.ceil(cell),
            Math.ceil(cell)
          );
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, modules - 7);
  drawFinder(modules - 7, 0);

  // Timing patterns
  ctx.fillStyle = '#07090E';
  for (let i = 8; i < modules - 8; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(x + i * cell, y + 6 * cell, Math.ceil(cell), Math.ceil(cell));
      ctx.fillRect(x + 6 * cell, y + i * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }

  // Data modules
  let bitIdx = 0;
  for (let r = 1; r < modules - 1; r++) {
    for (let c = 1; c < modules - 1; c++) {
      if (isFinderPattern(r, c) || r === 6 || c === 6) continue;
      if (r < 8 && (c < 8 || c >= modules - 8)) continue;
      if (r >= modules - 8 && c < 8) continue;

      const hashVal = hashes[bitIdx % hashes.length];
      const bit = ((hashVal >> (bitIdx % 16)) ^ (r * 31 + c * 17)) & 1;
      if (bit === 1) {
        ctx.fillRect(x + c * cell, y + r * cell, Math.ceil(cell), Math.ceil(cell));
      }
      bitIdx++;
    }
  }
}
