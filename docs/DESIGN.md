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

## The six skills

D&D-style point-buy at the start of a run. Each starts at 1, you distribute
12 points, cap 6 per skill.

| Skill  | What it is                    | Mechanical effect |
|--------|-------------------------------|-------------------|
| SKETCH | Line quality, blackbook hours | Bigger spray bursts — a planned piece goes up faster |
| CANS   | Can control — fills, fades    | Less paint wasted per pixel; high CANS adds burst size |
| RACK   | Racking paint from the store  | More cans / more paint in the bag each mission |
| DASH   | The getaway                   | Cops give up sooner, longer grace before a bust |
| CREEP  | Moving unseen                 | Heat builds slower — dogs, security, and transit workers clock you late |
| REP    | Word on the street            | Live pieces earn points faster (multiplier) |

## Partners

Every new piece starts with **the tumbler**: a slot-machine reel of writers
spins, decelerates, and *pops* to lock your partner in. Your tag + theirs
shows in the top-right corner for the rest of the mission. Each partner has a
bio, a signature style you can look at, and one mechanical perk:

| Tag         | Style                        | Perk |
|-------------|------------------------------|------|
| LADY VEX    | Wildstyle royalty            | Finished pieces score a quality bonus |
| CRISPO 149  | Throw-up machine             | Paint flows faster |
| MERC ONE    | Lives in the yards           | Train yard heat builds slower |
| SABLE       | Blockbuster letters          | Bigger spray radius |
| KWIK 12     | The lookout                  | Whistles a warning before the cops arrive |
| TEKO 5      | Can chemist, custom fat caps | +2 spray radius, thicker coverage |
| BUGSY       | The climber                  | Unlocks rooftop spots |
| RONDO       | Old head, knows every wall   | Unlocks hidden wall spots |

All partner characters are fictional.

## The map — where the burner goes

Stylized pixel map of the Bronx: the Harlem River, the els drawn as colored
lines, neighborhoods labeled. You move a target reticle between available
spots. Risk/reward is the core decision:

| Spot type   | Exposure | Heat | How it dies |
|-------------|----------|------|-------------|
| Train yard  | ★★★★★ (it *moves* — whole city sees it) | ★★★★★ | The buff — MTA cleans trains fast |
| Highway / rooftop | ★★★★ | ★★★ | Slow fade, occasional cap |
| Handball court / schoolyard wall | ★★ | ★ | Toy crews cap over it |
| Gallery     | ★ | none | Never — but almost nobody sees it. Worst option for getting up. |

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
- **The clock** is always running (site-dependent, shrinks as the game gets
  harder).
- **Heat** rises with every burst — faster at hot spots, slower with CREEP —
  and cools off while you pace yourself between presses. Pedestrians wander by
  and chirp ("NICE COLORS KID" / "I'M CALLING THE COPS!"), adding heat.
- Heat maxed → **5-0**: a cop rolls in. HIDE (hold SPACE behind the dumpster)
  until he leaves — the clock keeps running — then get back to it. Caught in
  the open and you're **busted**: piece lost, strike earned. Three strikes,
  run over.
- Timer out with ≥60% coverage → the piece goes up at that quality. Under 60%
  and it's a toy piece — barely worth anything.
- Later: dogs in the yards, ladders that competing crews steal mid-piece,
  third-rail scares, flashlight security patterns.

## Racking — the gear economy

Between missions you can go on a **rack run**: hit a store and steal gear.
It's a timing minigame — wait for the clerk to look away, pocket the item at
the right moment. RACK widens the timing window, CREEP slows suspicion.
Getting made means getting chased out empty-handed and burning a day.

Three stores, three upgrade tracks:

| Store           | You steal        | What it does |
|-----------------|------------------|--------------|
| Hardware store  | Better paint     | Higher tiers flow faster and cover thicker — an efficient can is how a burner gets **done on time** |
| Sporting goods  | Better sneakers  | You run faster — cops give up sooner, longer grace before a bust, cleaner getaways |
| Clothing spot   | Fresher gear     | Fits, chains, hats — respect. Better artists show up in the tumbler and your burners are worth more |

Each track has tiers (stock caps → fat caps → imported paint; beat kicks →
fresh shell-toes → unlaced-and-fat-laced; plain → track suit → full rope-chain
fit). Higher tiers are guarded harder.

## The book & the score — the Monopoly engine

Every finished piece earns a page in the black book: the sketch, a **polaroid**
of the finished piece in place, a check mark, and a live points counter.

- Each live piece earns **points per day** = exposure × quality × REP
  multiplier. Trains earn a "still running" bonus.
- Pieces die three ways: **buffed** (cleaned — trains go fast), **capped**
  (another writer paints over you — contested walls), or **fade** (slow,
  honorable, earns the longest).
- More pieces up → more income per day → it compounds. The book shows the
  whole portfolio ticking like rent.

## Difficulty ramp

Classic 80s escalation: every finished piece raises city heat — shorter
timers, faster cops, more decoy cans, stricter coverage. The game is teaching
your hands.

## Later (not in v1)

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
