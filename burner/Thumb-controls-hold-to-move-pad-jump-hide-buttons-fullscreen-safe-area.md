---
title: Thumb controls - hold-to-move pad, jump-hide buttons, fullscreen, safe area
type: feature
created: "2026-07-15T12:44:00Z"
modified: "2026-07-15T12:44:00Z"
author: Matthew Reider
status: started
estimate: "5"
started: "2026-07-15T12:44:00Z"
---

## Problem statement

PM mobile playtest: wants standard runner controls — hold right to move, tap left to jump/duck — with opaque thumb rests; fullscreen on rotate with an X to restore the browser; bottom UI gets covered by the phone's home-indicator slider.

## Possible solution

- input.js multi-pointer: pointerDown routed to scene.pointerDown (button zones consume the pointer; held buttons track id), tap/swipe unchanged for un-consumed pointers.
- paint scene touch UI: right pad = held < > buttons (move), left pad = JUMP + HIDE buttons; semi-opaque panels with pixel-triangle glyphs, pressed states. Wall taps still work above the pads.
- AUTO-SPRAY: standing still with work in reach fires bursts/floods automatically (0.35s cadence) — on all platforms; movement is now the whole game, X/click stay as manual overrides.
- Fullscreen API on first touch (navigationUI hide) + DOM ✕ chip (fullscreen-only) to exit; iOS Safari lacks the API — degrade silently.
- Safe area: body env(safe-area-inset) padding; raise strip/message a few px on touch.

## Comments

## Attachments
