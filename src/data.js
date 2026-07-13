// data.js — static game data: skills, partners, spots, paint colors, gear.

export const PARTNERS = [
  { tag: 'LADY VEX', style: 'WILDSTYLE ROYALTY',
    bio: 'ARROWS INSIDE ARROWS. NOBODY CAN READ HER LETTERS.',
    perk: 'REGIONS FINISH EASIER', hue: 300 },
  { tag: 'CRISPO 149', style: 'THROW-UP MACHINE',
    bio: 'TWO COLORS, NINETY SECONDS, GONE. HIT EVERY LINE LAST SUMMER.',
    perk: 'BIGGER SPRAY BURSTS', hue: 10 },
  { tag: 'MERC ONE', style: 'YARD RAT',
    bio: 'SLEEPS DAYS. KNOWS THE LAYUPS BETTER THAN THE MTA DOES.',
    perk: 'TROUBLE COMES SLOWER IN THE YARDS', hue: 200 },
  { tag: 'SABLE', style: 'BLOCKBUSTER LETTERS',
    bio: 'LETTERS SO BIG YOU READ THEM FROM THE EXPRESSWAY.',
    perk: 'BIGGER SPRAY BURSTS', hue: 45 },
  { tag: 'KWIK 12', style: 'THE LOOKOUT',
    bio: 'WHISTLES LIKE A BIRD. ONE LONG NOTE MEANS RUN.',
    perk: 'WARNING BEFORE TROUBLE ARRIVES', hue: 120 },
  { tag: 'TEKO 5', style: 'CAN CHEMIST',
    bio: 'SWAPS CAPS OFF OVEN CLEANER. SPRAYS A FIST-WIDE LINE.',
    perk: '+2 SPRAY BURST', hue: 170 },
  { tag: 'BUGSY', style: 'THE CLIMBER',
    bio: 'NO FEAR OF HEIGHTS. NO FEAR OF ANYTHING. DON\'T LOOK DOWN.',
    perk: 'UNLOCKS ROOFTOP SPOTS', hue: 25 },
  { tag: 'RONDO', style: 'OLD HEAD',
    bio: 'WAS UP BEFORE YOU WERE BORN. KNOWS EVERY WALL THE COPS FORGOT.',
    perk: 'UNLOCKS HIDDEN WALL SPOTS', hue: 260 },
];

// Spray can colors. id 0 reserved for "no paint".
export const COLORS = [
  { id: 1, name: 'MIDNIGHT',    hex: '#1a1a2e' },
  { id: 2, name: 'TRUE BLUE',   hex: '#2255cc' },
  { id: 3, name: 'CHERRY',      hex: '#cc2233' },
  { id: 4, name: 'SUNBURST',    hex: '#ffaa22' },
  { id: 5, name: 'JUNGLE',      hex: '#22aa44' },
  { id: 6, name: 'HOT PINK',    hex: '#ff44aa' },
  { id: 7, name: 'PURPLE RAIN', hex: '#8833cc' },
  { id: 8, name: 'ICE',         hex: '#aaddee' },
  { id: 9, name: 'CREAM',       hex: '#f5eed5' },
  { id: 10, name: 'SILVER',     hex: '#c0c4cc' },
];

// x/y are positions on the Bronx map asset (see bronx.js — 320x176).
// danger drives how fast trouble (cops, dogs) shows up while you paint.
export const SPOTS = [
  { id: 'e180', name: 'E 180TH ST YARD', kind: 'train', line: '2/5',
    x: 150, y: 86, danger: 5 },
  { id: 'westy', name: 'WESTCHESTER YARD', kind: 'train', line: '6',
    x: 192, y: 108, danger: 4 },
  { id: 'conc', name: 'CONCOURSE YARD', kind: 'train', line: 'D',
    x: 97, y: 42, danger: 4 },
  { id: 'stmary', name: 'ST MARY\'S HANDBALL', kind: 'wall', line: null,
    x: 92, y: 130, danger: 1 },
  { id: 'hunts', name: 'HUNTS POINT WAREHOUSE', kind: 'wall', line: null,
    x: 112, y: 150, danger: 2 },
  { id: 'cbx', name: 'CROSS BRONX OVERPASS', kind: 'wall', line: null,
    x: 142, y: 100, danger: 3 },
  { id: 'fordham', name: 'FORDHAM SCHOOLYARD', kind: 'wall', line: null,
    x: 118, y: 58, danger: 2 },
  { id: 'roof', name: 'GRAND CONCOURSE ROOF', kind: 'wall', line: null,
    x: 94, y: 80, danger: 2, requires: 'BUGSY' },
  { id: 'sound', name: 'SOUNDVIEW COURTS', kind: 'wall', line: null,
    x: 146, y: 142, danger: 1, requires: 'RONDO' },
  { id: 'nova', name: 'GALLERY NOVA', kind: 'gallery', line: null,
    x: 76, y: 138, danger: 0 },
];

export const PED_LINES = [
  'NICE COLORS KID', 'YO THAT\'S FRESH', 'MY TAXES PAY FOR THAT WALL',
  'I\'M CALLING THE COPS!', 'YOU KIDS AGAIN?', 'CAN YOU DO MY NAME?',
  'BURN IT KID', 'HOODLUMS!', 'IS THAT A V OR A W?',
];
