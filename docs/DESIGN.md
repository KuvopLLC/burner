# BURNER — Design Document

An 8-bit graffiti game. 1980s Bronx. You get up, you stay up.

## Tone & aesthetics

- **Look:** 320×200 internal resolution, chunky pixels, scanline-era palette.
  Everything reads like a 1985 arcade cabinet found in a bodega.
- **The kids:** hip hop heads — caps on sideways, shell-toed sneakers with the
  fat laces, striped hoodies and track suits, gold rope chains. Character
  sprites are procedurally assembled from those parts so every writer looks
  like themself.
- **The art:** burners in the style of classic NYC subway pieces — chunky
  wildstyle-leaning letters, two-tone fills, hard outlines, drop shadows,
  cloud/forcefield backgrounds. (Reference vibes: r/blackbookgraffiti, subway
  art photography, *Spray Nation*.)
- **Music:** WebAudio chiptune boom-bap — 808-ish kick/snare/hats plus square
  wave bass and lead, the way an 80s sound chip would play a hip hop beat.
  Every scene gets its own seeded pattern.

## The core (current focus)

The game is deliberately lean right now: **paint the piece, avoid what comes
down the street, survive as many nights as you can.** No clocks, no meters,
no economy — one verb for trouble (SPACE = hide) and one verb for paint
(point + X). Score is the count of burners you got up before three strikes.

## The four skills

D&D-style point-buy at the start of a run. Each starts at 1, you distribute
8 points, cap 6 per skill.

| Skill  | What it is                    | Mechanical effect |
|--------|-------------------------------|-------------------|
| SKETCH | Line quality, blackbook hours | Bigger spray bursts — a planned piece goes up faster |
| CANS   | Can control — fills, fades    | Burst size bonus at 5+ |
| DASH   | The getaway                   | Trouble gives up sooner, longer grace before a bust |
| CREEP  | Moving unseen                 | Trouble comes slower |

## Partners

Every new piece starts with **the tumbler**: a slot-machine reel of writers
spins, decelerates, and *pops* to lock your partner in. Your tag + theirs
shows in the top-right corner for the rest of the mission. Each partner has a
bio, a signature style you can look at, and one mechanical perk:

| Tag         | Style                        | Perk |
|-------------|------------------------------|------|
| LADY VEX    | Wildstyle royalty            | Regions finish easier |
| CRISPO 149  | Throw-up machine             | Bigger spray bursts |
| MERC ONE    | Lives in the yards           | Trouble comes slower in the yards |
| SABLE       | Blockbuster letters          | Bigger spray bursts |
| KWIK 12     | The lookout                  | Whistles a warning before trouble arrives |
| TEKO 5      | Can chemist, custom fat caps | +2 spray burst |
| BUGSY       | The climber                  | Unlocks rooftop spots |
| RONDO       | Old head, knows every wall   | Unlocks hidden wall spots |

All partner characters are fictional.

## The map — where the burner goes

Hand-rasterized pixel map of the Bronx: the Harlem River, Manhattan and
Queens across the water, the peninsulas, parks, expressways, and all the els
on true-ish routes. You move a target reticle between available spots. Each
spot has a **danger** rating — how fast trouble finds you there:

| Spot type   | Danger | The trade |
|-------------|--------|-----------|
| Train yard  | ★★★★+  | The whole city sees a train — and the yards have dogs |
| Highway / rooftop wall | ★★★ | Seen from the expressway, watched by the street |
| Handball court / schoolyard | ★–★★ | Quiet, good for finding your feet |
| Gallery     | none   | Safe and warm. Nobody real sees it. Practice. |

Launch spots: E 180th St Yard (2/5), Westchester Yard (6), Concourse Yard (D),
St Mary's Park handball court, Hunts Point warehouse, Cross Bronx overpass,
Fordham schoolyard, Grand Concourse rooftop (BUGSY), Soundview courts (RONDO),
Gallery Nova in Mott Haven.

## The paint scene — the arcade heart

- The sketch appears as a faint outline on the surface, divided into **regions**
  (fill top, fill bottom, outline, shadow, cloud) each wanting a specific color.
- Your bag holds the cans the sketch needs plus decoys. Pick a can (1-7 or
  click it), **point the mouse and hit X** (or click) — one press, one spray
  burst. Paint ONLY lands inside the region that wants that color; it is
  impossible to paint outside the designated areas. Aim badly or hold the
  wrong can and nothing sticks — you just rattled the can and drew attention.
  The region pulses while its can is selected, an aiming ring shows the burst
  size, and a finished region flashes with a pop.
- **No clock.** You stay at the wall until the piece is finished — or until
  the street takes you. The pressure is what comes at you:
- **Trouble arrives in waves** that come faster (1) the more dangerous the
  spot, (2) the longer you've been standing at this wall, and (3) the deeper
  into the run you are — night 5 is meaner than night 1. CREEP slows the
  waves; KWIK 12 whistles before each one lands.
  - **The 5-0**: a cop walks in slow and lingers. HIDE (hold SPACE behind the
    dumpster) until he leaves, then get back to work. Later nights: he walks
    faster and stays longer.
  - **The yard dog**: fast, low, no siren — just a bark and a red eye. Hop
    the dumpster (SPACE) before he crosses your spot. Later nights: faster.
  - Pedestrians wander through and chirp ("NICE COLORS KID" / "I'M CALLING
    THE COPS!") — neighborhood flavor, keeping you honest.
- Caught in the open — cop or dog — and it's a **strike**: piece lost. Three
  strikes and the run is over.
- Finish **every color region** and the piece goes up: polaroid, check mark,
  page in the book, next night. Every burner you land makes the city meaner.
- Later hazards: flashlight security sweeps, ladders that rival crews steal
  mid-piece, third-rail scares.

## The book

Every finished piece earns a page in the black book: the sketch, a
**polaroid** of the finished piece in place, and a check mark. Old pieces
eventually get buffed (which frees the spot back up). Your score is simple
and honest: **how many burners you got up.**

## Difficulty ramp

Classic 80s escalation, driven by one number — how many nights you've
survived. Trouble spawns sooner, cops walk faster and stay longer, dogs run
faster and show up more often. Within a single wall session the waves also
tighten the longer you stand there. The game is teaching your hands.

## Later (parked for now, by design)

- The points/fame economy: pieces earning per day while they run, compounding
  Monopoly-style; quality scoring
- Racking: stealing paint / kicks / fits between missions (better gear,
  better partners, more valuable pieces)
- Online leaderboard (high scores are localStorage for now)
- Whole-car and end-to-end train pieces, multi-night burners
- Crew system, beef, and cap wars with rival AI writers
- More boroughs

## Tech

Vanilla JS ES modules + Canvas 2D + WebAudio. Zero dependencies, no build
step, GitHub Pages-deployable. Internal 320×200 canvas integer-scaled with
`image-rendering: pixelated`. Pixel text is real-font-rendered once, alpha
thresholded, and cached, so all type lands on the pixel grid. Burner artwork
and character sprites are procedural (seeded RNG), so every run's pieces are
different.
