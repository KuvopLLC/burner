---
title: Tap-to-paint core - unified gesture input, auto-can, mouse returns
type: feature
created: "2026-07-15T09:58:00Z"
modified: "2026-07-15T10:38:56Z"
author: Matthew Reider
status: accepted
estimate: "8"
project: burner
started: "2026-07-15T10:30:48Z"
finished: "2026-07-15T10:38:56Z"
delivered: "2026-07-15T10:38:56Z"
accepted: "2026-07-15T10:38:56Z"
---

## Problem statement

Mobile needs the game playable with gestures only; the current scheme is ~10 keyboard inputs, and can-cycling is pure friction (the hint tag already tells you the answer). PM directive: mobile-first, and let the simplification flow back to desktop (mouse may return).

## Possible solution

THE MODEL — painting has only three real decisions: where to work, and which evasion (over/behind). Everything else automates.

- TAP the wall = a work order: kid walks there, AUTO-SELECTS the right can (rattle sfx as he switches), sprays on arrival (flood when powered). One gesture = move + color + paint. Tap gear = walk to collect (contact pickup already works).
- SWIPE UP = jump. SWIPE DOWN = duck behind nearest dumpster; swipe down again / new tap breaks cover.
- New src/input.js: pointer events unify touch + mouse into game actions {tapAt, swipeUp, swipeDown}. Swipe = >24px vertical within 300ms; else tap. Desktop mouse click = tap (mouse is BACK as the primary pointer). Keyboard kept as aliases (arrows walk, SPACE jump, H hide, X spray-at-aim) but nothing requires it.
- Manual can selection REMOVED everywhere (up/down keys, clickable bag). The bag row becomes a slim status strip: remaining colors as swatches, current can highlighted. Frees ~30px of vertical space in the paint scene.
- Work-order queue: one pending order; tapping again replaces it. Kid abandons order to obey jump/hide instantly.
- Drivers/probes/demo AI move to the tap pipeline (demo becomes literally 'watch the AI tap').

RISKS to confirm with PM: (1) color puzzle becomes automatic — the game is now fully about placement + survival + flow upkeep; (2) X/aim keyboard play kept but secondary.

## Comments

## Attachments
