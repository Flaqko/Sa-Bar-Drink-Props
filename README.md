# Bar Drink Props v1.1

Stable transition-safe update for GTA San Andreas Classic + CLEO Redux + CLEO+.

Bar Drink Props gives ambient bar customers a visible `CJ_BEAR_BOTTLE` prop while they receive/drink at bars. v1.1 keeps the original prop behavior and fixes the fast-interior-exit crash discovered with Quick Entry/Exit Skip.

## What changed in v1.1

- Keeps the original early `Barcustom_get` detection and male/female standing drink loops.
- Keeps model 1484 (`CJ_BEAR_BOTTLE`) attached to the right hand.
- Keeps the 1.2-second receive -> drink grace period.
- Adds an early Entry/Exit transition guard using GTA SA 1.0 US `CEntryExitManager` state.
- The instant an Entry/Exit starts, tracked CLEO+ render-object handles are abandoned **without** calling `DELETE_RENDER_OBJECT`.
- Scanning/prop creation stays suspended during the transition and for 1.5 seconds afterward.
- Removes the old distance-based fast-exit delete path.
- If the host ped has vanished, died, or is being removed, the cached render handle is forgotten rather than deleted.
- `DELETE_RENDER_OBJECT` is now reserved for normal stable animation-end cleanup only.

This prevents the race where Quick Leave streams a bar ped/interior out while CLEO+ is simultaneously deleting the attached render object.

## Installation

Choose **ONE** version. Do not run both.

### Standalone
Copy:

`Standalone/BarDrinkProps_v1.1[mem].js`

into your GTA SA `CLEO` folder.

Requires CLEO Redux + CLEO+. The `[mem]` filename tag is required.

### SA Enhancement Pack
Remove/replace the old:

`SA-Enhancement-Pack/Modules/BarDrinkProps.js`

and copy:

`SA-Enhancement-Pack/Modules/BarDrinkProps[mem][fs].js`

into the Enhancement Pack `Modules` folder.

The module still uses the existing INI setting:

```ini
[BarDrinkProps]
Enabled=1
```

The `[mem][fs]` filename tags are required because v1.1 reads the Entry/Exit pointer and the Enhancement Pack INI.

## Compatibility / safety

- Target: GTA San Andreas Classic 1.0 US.
- Designed for CLEO Redux and CLEO+.
- Compatible with Quick Entry/Exit Skip / fast interior transition mods.
- Do not install two BarDrinkProps scripts at the same time.

## Confirmed test result

The transition-safe standalone build was tested with repeated bar drinking, fast Quick Leave exits, and the Bar Drinking Redux system. Bottle props remained functional and the previously reproducible exit crash stopped occurring.
