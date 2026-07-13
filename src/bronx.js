// bronx.js — the map asset. Builds a 320x176 pixel-art night map of the
// Bronx once: real-ish geography (Harlem River, the southern peninsulas,
// Throgs Neck, Pelham Bay, City Island, Rikers), street-grid texture,
// parks, highways, bridges, and the five subway lines on true-ish
// routes. Everything is rasterized by hand — no canvas paths survive to
// the screen, so every edge is a crisp single pixel.

import { makeCanvas, text } from './gfx.js';
import { makeRng } from './rng.js';

export const MAP_W = 320, MAP_H = 176;

// region ids in the raster
const WATER = 0, BRONX = 1, YONKERS = 2, OTHER = 3;

const BRONX_POLY = [
  // NW corner at the county line, down the Harlem River shore
  [22, 14], [20, 22], [18, 32], [24, 38], [34, 42], [44, 50], [52, 62],
  [58, 76], [62, 92], [64, 108], [68, 122], [72, 134], [76, 144],
  // Port Morris + Bronx Kill
  [84, 148], [94, 148], [98, 142],
  // Hunts Point finger
  [102, 144], [106, 154], [112, 160], [118, 160], [122, 152], [124, 144],
  // Bronx River mouth
  [126, 140], [128, 140],
  // Soundview / Clason Point finger
  [130, 146], [136, 156], [144, 158], [150, 150], [152, 142],
  // Pugsley Creek
  [156, 138],
  // Castle Hill finger
  [158, 144], [162, 152], [168, 152], [172, 144], [174, 136],
  [176, 136],
  // Ferry Point
  [178, 142], [186, 146], [194, 140], [198, 132],
  // Throgs Neck — the long finger into the Sound
  [202, 126], [210, 130], [222, 140], [234, 150], [240, 156], [242, 152],
  [236, 144], [226, 132], [218, 122], [214, 114],
  // Eastchester Bay up to Pelham Bay Park
  [216, 106], [220, 96], [226, 88], [232, 82], [238, 84],
  [246, 88], [256, 92], [266, 88], [272, 80], [276, 68], [280, 60],
  [276, 50], [280, 40], [286, 32], [288, 14],
];

const MANHATTAN_POLY = [
  [12, 48], [22, 52], [32, 60], [40, 70], [46, 82], [50, 96], [55, 112],
  [58, 128], [62, 144], [66, 160], [70, 176], [0, 176], [0, 56],
];

const QUEENS_POLY = [
  [120, 176], [136, 172], [158, 170], [184, 168], [208, 166], [232, 164],
  [252, 168], [266, 176],
];

const YONKERS_POLY = [[14, 0], [292, 0], [288, 14], [22, 14]];

const RIKERS = [[128, 162], [146, 162], [148, 169], [126, 169]];
const CITY_ISLAND = [[282, 86], [292, 84], [296, 100], [286, 104]];
const RANDALLS = [[82, 158], [92, 158], [92, 166], [82, 166]];

const BRONX_RIVER = [
  [138, 15], [139, 34], [136, 52], [138, 70], [136, 90], [137, 104],
  [135, 120], [133, 134], [130, 146], [127, 154],
];

// parks: [x, y, w, h, kind] kind: 0 park, 1 cemetery
const PARKS = [
  [30, 16, 34, 20, 0], [36, 32, 22, 8, 0],          // Van Cortlandt
  [72, 16, 26, 14, 1],                               // Woodlawn
  [128, 44, 20, 34, 0], [126, 66, 24, 14, 0],       // Bronx Park (zoo)
  [112, 98, 18, 14, 0],                              // Crotona
  [84, 124, 14, 10, 0],                              // St Mary's
  [244, 16, 44, 40, 0], [252, 52, 30, 26, 0], [238, 20, 10, 24, 0], // Pelham Bay
  [178, 132, 14, 7, 0],                              // Ferry Point
];

const HIGHWAYS = [
  // Cross Bronx
  [[58, 90], [90, 94], [120, 98], [150, 102], [178, 106], [196, 112], [210, 118], [216, 124]],
  // Bruckner
  [[78, 144], [100, 140], [126, 136], [152, 134], [176, 130], [200, 126], [214, 124]],
  // Major Deegan
  [[28, 40], [40, 52], [50, 66], [56, 82], [60, 100], [64, 118], [70, 136], [76, 146]],
];

const BRIDGES = [
  [[36, 62], [52, 62]], [[52, 100], [64, 100]], [[60, 124], [69, 124]],
  [[82, 148], [86, 158]], [[87, 166], [87, 172]],       // RFK via Randalls
  [[190, 143], [196, 166]],                              // Whitestone
  [[236, 152], [244, 164]],                              // Throgs Neck
  [[272, 80], [283, 88]],                                // City Island causeway
];

// the els — 1px, official-ish colors, real-ish routes
export const SUBWAY = [
  { name: '1', color: '#ee352e', bullet: [38, 26],
    pts: [[24, 58], [28, 48], [32, 38], [36, 26], [38, 18]] },
  { name: '4', color: '#00933c', bullet: [88, 26],
    pts: [[76, 132], [80, 112], [84, 92], [86, 70], [88, 44], [90, 18]] },
  { name: 'D', color: '#ff6319', bullet: [108, 28],
    pts: [[84, 142], [90, 120], [95, 96], [100, 70], [103, 44], [105, 26], [108, 20]] },
  { name: '2', color: '#ee352e', bullet: [154, 22],
    pts: [[94, 144], [102, 138], [112, 130], [124, 122], [136, 112], [146, 102], [150, 88], [152, 72], [153, 52], [154, 32], [154, 16]] },
  { name: '5', color: '#00933c', bullet: [184, 22],
    pts: [[150, 88], [160, 78], [169, 66], [176, 52], [181, 38], [183, 24], [184, 16]] },
  { name: '6', color: '#00a65c', bullet: [227, 34],
    pts: [[106, 142], [118, 136], [132, 132], [148, 128], [164, 122], [180, 116], [192, 110], [202, 100], [208, 88], [214, 74], [220, 60], [224, 48], [226, 42]] },
];

const YARDS = [[150, 88], [192, 112], [97, 42]]; // E 180th, Westchester, Concourse

function rasterizePoly(region, poly, id) {
  // scanline fill
  const n = poly.length;
  for (let y = 0; y < MAP_H; y++) {
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k])), b = Math.min(MAP_W - 1, Math.floor(xs[k + 1]));
      for (let x = a; x <= b; x++) region[y * MAP_W + x] = id;
    }
  }
}

function carveLine(region, pts, thick) {
  eachLinePixel(pts, (x, y) => {
    for (let dx = 0; dx < thick; dx++) {
      if (x + dx < MAP_W && y >= 0 && y < MAP_H) region[y * MAP_W + x + dx] = WATER;
    }
  });
}

function eachLinePixel(pts, fn) {
  for (let i = 0; i + 1 < pts.length; i++) {
    let [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      fn(x1, y1);
      if (x1 === x2 && y1 === y2) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x1 += sx; }
      if (e2 <= dx) { err += dx; y1 += sy; }
    }
  }
}

function pline(c, pts, color) {
  c.fillStyle = color;
  eachLinePixel(pts, (x, y) => c.fillRect(x, y, 1, 1));
}

function disc(c, cx, cy, r, color) {
  c.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    c.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}

const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function buildBronxMap() {
  const region = new Uint8Array(MAP_W * MAP_H);
  rasterizePoly(region, YONKERS_POLY, YONKERS);
  rasterizePoly(region, BRONX_POLY, BRONX);
  rasterizePoly(region, MANHATTAN_POLY, OTHER);
  rasterizePoly(region, QUEENS_POLY, OTHER);
  rasterizePoly(region, RIKERS, OTHER);
  rasterizePoly(region, CITY_ISLAND, OTHER);
  rasterizePoly(region, RANDALLS, OTHER);
  carveLine(region, BRONX_RIVER, 2);

  const [cv, c] = makeCanvas(MAP_W, MAP_H);
  const img = c.createImageData(MAP_W, MAP_H);
  const d = img.data;
  const rng = makeRng(1985);

  const COLORS = {
    water: hexRGB('#0e1c30'), wave: hexRGB('#152740'),
    bronx: hexRGB('#2a3421'), bronxGrid: hexRGB('#242c1c'), bronxRim: hexRGB('#5d6e4b'),
    yonkers: hexRGB('#1d2417'), yonkersGrid: hexRGB('#191f13'), yonkersRim: hexRGB('#39412e'),
    other: hexRGB('#292c23'), otherGrid: hexRGB('#24271f'), otherRim: hexRGB('#484d3f'),
    lit: hexRGB('#5c4c28'), litDim: hexRGB('#413a28'),
  };

  const hash = (x, y) => ((Math.imul(x + 7, 73856093) ^ Math.imul(y + 3, 19349663)) >>> 0);
  const isWater = i => region[i] === WATER;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      let col;
      if (region[i] === WATER) {
        col = (y % 4 === 1 && (x + y * 7) % 23 < 3) ? COLORS.wave : COLORS.water;
      } else {
        const edge =
          (x > 0 && isWater(i - 1)) || (x < MAP_W - 1 && isWater(i + 1)) ||
          (y > 0 && isWater(i - MAP_W)) || (y < MAP_H - 1 && isWater(i + MAP_W));
        const grid = (x % 5 === 4 || y % 5 === 4);
        const h = hash(x, y);
        if (region[i] === BRONX) {
          col = edge ? COLORS.bronxRim
            : grid ? COLORS.bronxGrid
            : h % 53 === 0 ? COLORS.lit          // a window still burning
            : COLORS.bronx;
        } else if (region[i] === YONKERS) {
          col = edge ? COLORS.yonkersRim : grid ? COLORS.yonkersGrid : COLORS.yonkers;
        } else {
          col = edge ? COLORS.otherRim
            : grid ? COLORS.otherGrid
            : h % 89 === 0 ? COLORS.litDim
            : COLORS.other;
        }
      }
      d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
    }
  }

  // parks & cemetery: painted per-pixel, clipped to Bronx land
  const park = hexRGB('#1f3620'), tree = hexRGB('#2b4a27');
  const cem = hexRGB('#28331f'), stone = hexRGB('#3d4a35');
  for (const [px2, py, pw, ph, kind] of PARKS) {
    for (let y = py; y < py + ph; y++) {
      for (let x = px2; x < px2 + pw; x++) {
        const i = y * MAP_W + x;
        if (region[i] !== BRONX) continue;
        const dot = hash(x, y) % 6 < 2;
        const col = kind ? (dot ? stone : cem) : (dot ? tree : park);
        d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2];
      }
    }
  }
  c.putImageData(img, 0, 0);

  // county line: dashes along the Yonkers border
  c.fillStyle = '#4a4a38';
  for (let x = 22; x < 288; x += 6) c.fillRect(x, 14, 3, 1);

  // highways, then bridges over water
  for (const hw of HIGHWAYS) pline(c, hw, '#4b525a');
  for (const br of BRIDGES) pline(c, br, '#79828c');

  // train yards: little track-bundle pads
  for (const [yx, yy] of YARDS) {
    c.fillStyle = '#1b1f26';
    c.fillRect(yx - 6, yy - 3, 13, 8);
    c.fillStyle = '#868e98';
    for (let t = 0; t < 3; t++) c.fillRect(yx - 4, yy - 1 + t * 2, 9, 1);
  }

  // the els
  for (const line of SUBWAY) {
    pline(c, line.pts, line.color);
    const [bx, by] = line.bullet;
    disc(c, bx, by, 4, line.color);
    text(c, line.name, bx - 2, by - 3, '#fff');
  }

  // labels
  text(c, 'WESTCHESTER', 12, 4, '#4d5340');
  'MANHATTAN'.split('').forEach((ch, i) => text(c, ch, 14, 84 + i * 8, '#4b5142'));
  text(c, 'QUEENS', 228, 168, '#4b5142');
  text(c, 'EAST RIVER', 64, 163, '#28425e');
  text(c, 'THE BRONX', 240, 110, '#5d7a52');
  text(c, '1985', 254, 120, '#39546e');
  text(c, 'PELHAM', 250, 28, '#41633a');
  text(c, 'BAY', 258, 36, '#41633a');
  'ZOO'.split('').forEach((ch, i) => text(c, ch, 130, 50 + i * 8, '#41633a'));
  text(c, 'RIKERS', 152, 161, '#28425e');

  return cv;
}
