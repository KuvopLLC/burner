---
title: Mario-style play - contact enemies, jumping, power states, gear pickups, hearts
type: feature
created: "2026-07-13T20:42:01Z"
modified: "2026-07-13T20:57:40Z"
author: Matthew Reider
status: delivered
estimate: "8"
started: "2026-07-13T20:42:01Z"
delivered: "2026-07-13T20:57:40Z"
project: burner
---

## Problem statement

PM: still not fun. Cop/dog should be physical — touch you and you're hit — running on the player's level so you can JUMP over or dodge them, with several on screen at once. Painting isn't fun either. Wants Mario power states: powered = fill whole letters at once (a color at a time); getting hit drops you to tedious spraying; gear pickups (gold chains, Courvoisier bottles, game tickets) restore the power like mushrooms. Life hearts instead of one-touch strikes.

## Possible solution

Replace hide/vision mechanics entirely: enemies[] walk/run on the sidewalk plane, contact = hit (with i-frames); SPACE jumps an arc. Powered state floods an entire region per press (right can required); unpowered = the old burst spray. Items spawn on the street: collect to re-power (or +1 heart if already powered). 3 hearts, persist across nights; 0 = game over. Partner keeps painting, hops when enemies pass. Demo/driver AIs jump instead of hiding.

## Comments

## Attachments

## Rejection notes

- 2026-07-13: PM: jump arc does not clear the cop sprite (apex 23px vs 30px cop) so jumps still register/read as hits; wants multiple dumpsters along the board with H-to-hide near one; also keyboard-only controls (delivered mid-review).
