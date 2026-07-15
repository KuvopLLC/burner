---
title: Mobile presentation - scaling, orientation, tap menus, letter-grid name entry
type: feature
created: "2026-07-15T09:58:00Z"
modified: "2026-07-15T10:39:10Z"
author: Matthew Reider
status: started
estimate: "5"
project: burner
started: "2026-07-15T10:39:10Z"
---

## Problem statement

384x216 @5x targets desktop; on a phone the canvas letterboxes tiny, portrait is unusable, menus need ENTER, name entry needs a keyboard, and [G] github is a keypress. Turnstile/audio need first-touch unlock.

## Possible solution

- Viewport meta + touch-action:none + overscroll containment; audio unlock on first pointerdown (exists for click, extend to touch).
- Scaling: integer scale when it fits, else fill-scale with CSS transform + image-rendering:pixelated (slight softness beats a postage stamp). Canvas centered, black bars ok.
- LANDSCAPE ONLY on phones: portrait shows a 'ROTATE YOUR PHONE' card (drawn in-game, same font).
- Every menu prompt becomes tap-aware: detect touch → 'TAP' text instead of '[ENTER]'; whole screen is the button. Book: swipe left/right flips. Map: tap spot selects, tap selected spot / GO chip confirms. Doors/tumbler/sketch/result: tap = advance. Title: tappable GITHUB footer chip replaces [G].
- Name entry on touch: arcade letter grid (A-Z 0-9, DEL, END) with fat tap targets; typing still works on desktop.
- HUD: message chip enlarged, hearts/star/piece meter unchanged. Fewer background pedestrians on narrow screens if noisy.
- Test: drive.html gains a tap-driver mode; new mobileprobe.html at 844x390 for screenshots.

## Comments

## Attachments
