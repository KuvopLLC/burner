// data.js — static game data: skills, partners, spots, paint colors, gear.

export const SKILLS = [
  { key: 'sketch', name: 'SKETCH', desc: 'LINE QUALITY. NEAR-MISSES STILL COUNT.' },
  { key: 'cans',   name: 'CANS',   desc: 'CAN CONTROL. FASTER, THICKER FILLS.' },
  { key: 'rack',   name: 'RACK',   desc: 'STEALING GEAR. WIDER POCKET WINDOW.' },
  { key: 'dash',   name: 'DASH',   desc: 'THE GETAWAY. COPS GIVE UP SOONER.' },
  { key: 'creep',  name: 'CREEP',  desc: 'MOVE UNSEEN. HEAT BUILDS SLOWER.' },
  { key: 'rep',    name: 'REP',    desc: 'WORD TRAVELS. PIECES EARN FASTER.' },
];

export const SKILL_POINTS = 12; // distributed on top of base 1 each, cap 6

export const PARTNERS = [
  { tag: 'LADY VEX', style: 'WILDSTYLE ROYALTY',
    bio: 'ARROWS INSIDE ARROWS. NOBODY CAN READ HER LETTERS.',
    perk: 'QUALITY BONUS ON FINISHED PIECES', hue: 300, minFit: 2 },
  { tag: 'CRISPO 149', style: 'THROW-UP MACHINE',
    bio: 'TWO COLORS, NINETY SECONDS, GONE. HIT EVERY LINE LAST SUMMER.',
    perk: 'PAINT FLOWS FASTER', hue: 10, minFit: 0 },
  { tag: 'MERC ONE', style: 'YARD RAT',
    bio: 'SLEEPS DAYS. KNOWS THE LAYUPS BETTER THAN THE MTA DOES.',
    perk: 'YARD HEAT BUILDS SLOWER', hue: 200, minFit: 0 },
  { tag: 'SABLE', style: 'BLOCKBUSTER LETTERS',
    bio: 'LETTERS SO BIG YOU READ THEM FROM THE EXPRESSWAY.',
    perk: 'BIGGER SPRAY RADIUS', hue: 45, minFit: 0 },
  { tag: 'KWIK 12', style: 'THE LOOKOUT',
    bio: 'WHISTLES LIKE A BIRD. ONE LONG NOTE MEANS RUN.',
    perk: 'EARLY WARNING BEFORE THE COPS ROLL UP', hue: 120, minFit: 0 },
  { tag: 'TEKO 5', style: 'CAN CHEMIST',
    bio: 'SWAPS CAPS OFF OVEN CLEANER. SPRAYS A FIST-WIDE LINE.',
    perk: '+2 SPRAY RADIUS', hue: 170, minFit: 1 },
  { tag: 'BUGSY', style: 'THE CLIMBER',
    bio: 'NO FEAR OF HEIGHTS. NO FEAR OF ANYTHING. DON\'T LOOK DOWN.',
    perk: 'UNLOCKS ROOFTOP SPOTS', hue: 25, minFit: 1 },
  { tag: 'RONDO', style: 'OLD HEAD',
    bio: 'WAS UP BEFORE YOU WERE BORN. KNOWS EVERY WALL THE COPS FORGOT.',
    perk: 'UNLOCKS HIDDEN WALL SPOTS', hue: 260, minFit: 2 },
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

export const SPOTS = [
  { id: 'e180', name: 'E 180TH ST YARD', kind: 'train', line: '2/5',
    x: 232, y: 78, exposure: 5, heat: 5, buff: 0.14, cap: 0.0, time: 80 },
  { id: 'westy', name: 'WESTCHESTER YARD', kind: 'train', line: '6',
    x: 272, y: 108, exposure: 5, heat: 4, buff: 0.12, cap: 0.0, time: 85 },
  { id: 'conc', name: 'CONCOURSE YARD', kind: 'train', line: 'D',
    x: 128, y: 44, exposure: 4, heat: 4, buff: 0.11, cap: 0.0, time: 85 },
  { id: 'stmary', name: 'ST MARY\'S HANDBALL', kind: 'wall', line: null,
    x: 148, y: 148, exposure: 2, heat: 1, buff: 0.01, cap: 0.05, time: 110 },
  { id: 'hunts', name: 'HUNTS POINT WAREHOUSE', kind: 'wall', line: null,
    x: 208, y: 142, exposure: 2, heat: 2, buff: 0.01, cap: 0.03, time: 105 },
  { id: 'cbx', name: 'CROSS BRONX OVERPASS', kind: 'wall', line: null,
    x: 178, y: 96, exposure: 4, heat: 3, buff: 0.02, cap: 0.07, time: 90 },
  { id: 'fordham', name: 'FORDHAM SCHOOLYARD', kind: 'wall', line: null,
    x: 152, y: 58, exposure: 3, heat: 2, buff: 0.01, cap: 0.10, time: 100 },
  { id: 'roof', name: 'GRAND CONCOURSE ROOF', kind: 'wall', line: null,
    x: 120, y: 96, exposure: 4, heat: 2, buff: 0.0, cap: 0.02, time: 95,
    requires: 'BUGSY' },
  { id: 'sound', name: 'SOUNDVIEW COURTS', kind: 'wall', line: null,
    x: 240, y: 132, exposure: 2, heat: 1, buff: 0.01, cap: 0.04, time: 110,
    requires: 'RONDO' },
  { id: 'nova', name: 'GALLERY NOVA', kind: 'gallery', line: null,
    x: 132, y: 168, exposure: 1, heat: 0, buff: 0.0, cap: 0.0, time: 130 },
];

// Gear tracks — racked between missions. Tier 0 is what you start with.
export const GEAR = {
  paint: {
    name: 'PAINT', store: 'HARDWARE STORE',
    tiers: ['STOCK CANS', 'FAT CAPS', 'PRO CANS', 'IMPORTED'],
    blurb: 'BETTER PAINT FLOWS FASTER. FINISH BEFORE THE CLOCK.',
  },
  kicks: {
    name: 'KICKS', store: 'SPORTING GOODS',
    tiers: ['BEAT KICKS', 'FRESH SHELLS', 'FAT LACES', 'UNTOUCHED PAIRS'],
    blurb: 'RUN FASTER. COPS GIVE UP. CLEANER GETAWAYS.',
  },
  fit: {
    name: 'FIT', store: 'CLOTHING SPOT',
    tiers: ['PLAIN', 'TRACK SUIT', 'ROPE CHAIN', 'FULL FIT'],
    blurb: 'RESPECT. BETTER ARTISTS SHOW UP. PIECES WORTH MORE.',
  },
};

export const PED_LINES = [
  'NICE COLORS KID', 'YO THAT\'S FRESH', 'MY TAXES PAY FOR THAT WALL',
  'I\'M CALLING THE COPS!', 'YOU KIDS AGAIN?', 'CAN YOU DO MY NAME?',
  'BURN IT KID', 'HOODLUMS!', 'IS THAT A V OR A W?',
];
