# Bar Drink Props v1.0

A lightweight immersion fix for **Grand Theft Auto: San Andreas Classic**.

Ambient customers in bars already perform Rockstar's receive/drink animations, but the drink prop can be missing from their hands. **Bar Drink Props** restores the visible bottle without replacing the bar AI or injecting new ped tasks.

## Features

- Adds a visible bottle when an ambient bar customer receives a drink.
- Detects `Barcustom_get` early so the bottle appears during the handoff rather than halfway through drinking.
- Keeps the bottle visible through:
  - `dnk_stndF_loop`
  - `dnk_stndM_loop`
- Uses vanilla model **1484 `CJ_BEAR_BOTTLE`**.
- Attaches to the GTA HAnim **right-hand bone (24)**.
- Removes the bottle automatically after the drinking sequence ends.
- Deletes the visual prop if the ped dies or disappears.
- Does **not** modify the pedestrian's AI or drinking task.
- Uses a conservative one-ped-per-tick nearby scan.

## Why CLEO+ is used

Earlier prototypes used `TASK_PICK_UP_OBJECT`. Injecting that task into Rockstar-controlled ambient bar customers could crash GTA while their existing bar behavior was active.

v1.0 instead uses CLEO+'s render-object attachment system:

- `CREATE_RENDER_OBJECT_TO_CHAR_BONE`
- `DELETE_RENDER_OBJECT`

The bottle is therefore a **visual attachment only**. Rockstar's original bar behavior stays in control of the ped.

## Requirements

- GTA San Andreas Classic (PC)
- CLEO Redux
- CLEO+ with render-object commands

## Installation

1. Remove any older test versions of Bar Drink Props.
2. Copy `BarDrinkProps.js` into your GTA San Andreas `CLEO` folder.
3. Start the game normally.

## Compatibility / Scope

The mod only reacts to the vanilla bar customer receive/drink animations listed above. It does not create new drinkers, alter bartenders, replace animations, or modify bar interaction logic.

## Performance

- Scan radius: **35 m**
- Scan interval: **35 ms**
- Processes **one ped per tick**
- Maximum tracked drinkers: **12**

This keeps the script responsive enough to catch the drink handoff early while avoiding a heavy bulk ped scan.

## Version History

### v1.0

- First stable release.
- Early `Barcustom_get` detection.
- Vanilla handheld bottle model 1484.
- CLEO+ visual bone attachment.
- Right-hand bone attachment.
- Safe cleanup after the drinking sequence.
- No ped task injection.
