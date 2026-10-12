/**
 * BINTH.IN — Vanilla JS QR Code Generator
 * Generates valid QR Codes (Model 2, Byte Mode) as SVG or Canvas elements.
 * Zero external libraries or CDN dependencies.
 */

// QR Code math & Reed-Solomon polynomial utilities for Version 1-4 QR codes
const GF256 = {
  exp: new Uint8Array(512),
  log: new Uint8Array(256),
  init() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      this.exp[i] = x;
      this.exp[i + 255] = x;
      this.log[x] = i;
      x <<= 1;
      if (x & 256) x ^= 0x11d;
    }
  },
  mul(a, b) {
    if (a === 0 || b === 0) return 0;
    return this.exp[this.log[a] + this.log[b]];
  }
};
GF256.init();

function rsGeneratorPoly(degree) {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= GF256.mul(g[j], GF256.exp[i]);
      next[j + 1] ^= g[j];
    }
    g = next;
  }
  return g;
}

function rsCalculateEC(msgBytes, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const info = new Array(msgBytes.length + ecCount).fill(0);
  for (let i = 0; i < msgBytes.length; i++) info[i] = msgBytes[i];

  for (let i = 0; i < msgBytes.length; i++) {
    const coef = info[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        info[i + j] ^= GF256.mul(gen[j], coef);
      }
    }
  }
  return info.slice(msgBytes.length);
}

// QR Code Versions Capacity Table (Byte Mode, Error Correction L)
const QR_VERSIONS = [
  null,
  { version: 1, size: 21, dataCap: 17, totalBytes: 26, ecCount: 7, align: [] },
  { version: 2, size: 25, dataCap: 32, totalBytes: 44, ecCount: 10, align: [6, 18] },
  { version: 3, size: 29, dataCap: 53, totalBytes: 70, ecCount: 15, align: [6, 22] },
  { version: 4, size: 33, dataCap: 78, totalBytes: 100, ecCount: 20, align: [6, 26] },
  { version: 5, size: 37, dataCap: 106, totalBytes: 134, ecCount: 26, align: [6, 30] }
];

export const QRCode = {
  /**
   * Determine best version for text length
   */
  pickVersion(text) {
    const utf8Bytes = new TextEncoder().encode(text);
    const len = utf8Bytes.length;
    for (let v = 1; v < QR_VERSIONS.length; v++) {
      if (len + 3 <= QR_VERSIONS[v].dataCap) {
        return { ver: QR_VERSIONS[v], bytes: utf8Bytes };
      }
    }
    // Fallback to Version 5
    return { ver: QR_VERSIONS[5], bytes: utf8Bytes };
  },

  /**
   * Generate raw boolean matrix of QR modules
   */
  generateMatrix(text) {
    const { ver, bytes } = this.pickVersion(text);
    const N = ver.size;
    const matrix = Array.from({ length: N }, () => Array(N).fill(null));
    const isReserved = Array.from({ length: N }, () => Array(N).fill(false));

    function setModule(r, c, val) {
      matrix[r][c] = val;
      isReserved[r][c] = true;
    }

    // 1. Finder patterns (7x7 at 3 corners)
    function addFinder(top, left) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBlack = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          setModule(top + r, left + c, isBlack);
        }
      }
      // Separator
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = top + r;
          const cc = left + c;
          if (rr >= 0 && rr < N && cc >= 0 && cc < N && matrix[rr][cc] === null) {
            setModule(rr, cc, false);
          }
        }
      }
    }

    addFinder(0, 0);
    addFinder(0, N - 7);
    addFinder(N - 7, 0);

    // 2. Alignment patterns for Version >= 2
    if (ver.align.length > 0) {
      for (const ar of ver.align) {
        for (const ac of ver.align) {
          if (matrix[ar][ac] !== null) continue; // Skip overlapping with finders
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              const isBlack = (Math.max(Math.abs(r), Math.abs(c)) !== 1);
              setModule(ar + r, ac + c, isBlack);
            }
          }
        }
      }
    }

    // 3. Timing patterns
    for (let i = 8; i < N - 8; i++) {
      if (matrix[6][i] === null) setModule(6, i, i % 2 === 0);
      if (matrix[i][6] === null) setModule(i, 6, i % 2 === 0);
    }

    // Dark module
    setModule(4 * ver.version + 9, 8, true);

    // 4. Reserve format information space
    for (let i = 0; i < 9; i++) {
      if (matrix[8][i] === null) isReserved[8][i] = true;
      if (matrix[i][8] === null) isReserved[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
      if (matrix[8][N - 1 - i] === null) isReserved[8][N - 1 - i] = true;
      if (matrix[N - 1 - i][8] === null) isReserved[N - 1 - i][8] = true;
    }

    // 5. Build Bitstream (Byte Mode: 0100 + 8-bit count + payload + terminator + padding)
    const bits = [];
    function pushBits(val, len) {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    }

    pushBits(0b0100, 4); // Byte mode indicator
    pushBits(bytes.length, 8); // Character count
    for (const b of bytes) pushBits(b, 8);

    // Terminator
    const dataBitCap = ver.dataCap * 8;
    while (bits.length < dataBitCap && bits.length % 8 !== 0) bits.push(0);
    while (bits.length < dataBitCap && bits.length < dataBitCap) {
      if (dataBitCap - bits.length < 4) {
        while (bits.length < dataBitCap) bits.push(0);
        break;
      }
      pushBits(0, 4);
      break;
    }
    // Pad bytes
    const padBytes = [0xEC, 0x11];
    let padIdx = 0;
    while (bits.length < dataBitCap) {
      pushBits(padBytes[padIdx % 2], 8);
      padIdx++;
    }

    // Convert bits to data bytes
    const dataBytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      dataBytes.push(b);
    }

    // 6. Reed-Solomon Error Correction Code
    const ecBytes = rsCalculateEC(dataBytes, ver.ecCount);
    const finalCodewords = dataBytes.concat(ecBytes);

    // 7. Place data bits along columns (2-by-2 upward/downward zig-zag)
    const allBits = [];
    for (const cw of finalCodewords) {
      for (let i = 7; i >= 0; i--) allBits.push((cw >> i) & 1);
    }

    let bitIdx = 0;
    let upward = true;
    for (let c = N - 1; c > 0; c -= 2) {
      if (c === 6) c--; // Skip vertical timing line
      for (let rIdx = 0; rIdx < N; rIdx++) {
        const r = upward ? (N - 1 - rIdx) : rIdx;
        for (let colOffset = 0; colOffset < 2; colOffset++) {
          const col = c - colOffset;
          if (!isReserved[r][col]) {
            const rawBit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
            // Apply standard mask pattern 0: (r + col) % 2 === 0
            const mask = (r + col) % 2 === 0;
            matrix[r][col] = (rawBit === 1) ^ mask;
          }
        }
      }
      upward = !upward;
    }

    // 8. Format Info (Mask 0 + Error Correction Level L = format bits 0x77c4)
    const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
    for (let i = 0; i < 6; i++) matrix[8][i] = !!formatBits[i];
    matrix[8][7] = !!formatBits[6];
    matrix[8][8] = !!formatBits[7];
    matrix[7][8] = !!formatBits[8];
    for (let i = 0; i < 6; i++) matrix[5 - i][8] = !!formatBits[9 + i];

    for (let i = 0; i < 7; i++) matrix[N - 1 - i][8] = !!formatBits[i];
    for (let i = 0; i < 8; i++) matrix[8][N - 8 + i] = !!formatBits[7 + i];

    return matrix;
  },

  /**
   * Render SVG string
   */
  generateSVG(text, size = 240) {
    const matrix = this.generateMatrix(text);
    const N = matrix.length;
    const margin = 4;
    const total = N + margin * 2;
    const cellSize = (size / total).toFixed(2);

    let rects = '';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (matrix[r][c]) {
          const x = (c + margin) * cellSize;
          const y = (r + margin) * cellSize;
          rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#5A2D2D"/>`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
      <rect width="100%" height="100%" fill="#FFFDF8"/>
      ${rects}
    </svg>`;
  },

  /**
   * Render to Canvas element for downloading
   */
  renderToCanvas(canvas, text, size = 300) {
    const matrix = this.generateMatrix(text);
    const N = matrix.length;
    const margin = 4;
    const total = N + margin * 2;
    const cellSize = Math.floor(size / total);
    const actualSize = cellSize * total;

    canvas.width = actualSize;
    canvas.height = actualSize;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFDF8';
    ctx.fillRect(0, 0, actualSize, actualSize);

    ctx.fillStyle = '#5A2D2D'; // Deep Maroon brand color
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (matrix[r][c]) {
          ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
        }
      }
    }
  }
};
