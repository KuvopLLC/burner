# BURNER

**An 8-bit graffiti game set in the 1980s Bronx.**

You're a kid with a black book, a duffel bag of rattling cans, shell-toes, a
sideways cap, and a name nobody knows yet. Pick your writer, roll your skills,
partner up with another artist, and get your burners up all over the city —
train yards, handball courts, rooftops — while the cops, the yard dogs, the
buff, and every toy crew in the borough try to take you down or cap over your
work.

The longer a piece stays up and the more people see it, the more fame you
earn. Fame compounds. Get enough pieces running and the whole city knows your
name.

## Play

No build step, no dependencies. Serve the folder and open it:

```sh
cd burner
python3 -m http.server 8080
# open http://localhost:8080
```

Keyboard + mouse. Full controls on the title screen.

## The loop

1. **Name yourself** — enter your tag, arcade style.
2. **Roll your skills** — distribute points D&D-style across six writer skills.
3. **The tumbler** — a slot-machine reel of partners spins and *pops* on the
   writer you're teaming with. Read their bio, peep their style.
4. **The sketch** — you and your partner work up a piece in the black book.
5. **The map** — move the target across the Bronx. Train yard? Handball court?
   Rooftop? A gallery wants you too, but nobody real will see it there.
6. **Paint** — the arcade heart of the game. Right cans, right spots, against
   the clock, while heat builds. Hide when the cops roll up. Get back to work.
7. **The book** — every finished piece gets a check mark, a sketch page, and a
   polaroid. Live pieces earn points every day until they're buffed, capped,
   or fade with honor.

See [docs/DESIGN.md](docs/DESIGN.md) for the full design document.

## Headless smoke test

`test/drive.html` is a self-playing build: it enters a tag, spends the skill
points, rides the tumbler, paints a full piece with the right cans (hiding
when the cops roll up), flips the book, and does a rack run — logging every
scene transition to the console. Run it with headless Chromium:

```sh
chromium --headless --mute-audio --autoplay-policy=no-user-gesture-required \
  --enable-logging=stderr --window-size=1280,800 \
  --virtual-time-budget=120000 --screenshot=out.png \
  http://localhost:8080/test/drive.html
```

Vary `--virtual-time-budget` to screenshot any scene on the timeline.

## Status

Early. Core loop playable: name → skills → partner tumbler → sketch → map →
paint scene (timer, heat, cops, hiding) → polaroid → black book scoring.
High scores in localStorage. Leaderboard comes later.
