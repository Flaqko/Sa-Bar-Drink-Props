# Changelog

## v1.1

- Promoted the transition-safe cleanup design to stable release.
- Fixed crash/freeze risk when fast interior-exit mods stream bar peds out while a CLEO+ bottle render object is tracked.
- Added per-frame Entry/Exit detection.
- During Entry/Exit, render-object handles are abandoned without `DELETE_RENDER_OBJECT`.
- Added a 1500 ms post-transition settle window before scanning resumes.
- Removed distance-based fast-exit deletion.
- Vanished/dead/removing host peds no longer trigger render-object deletion.
- Normal stable animation-end cleanup remains unchanged.

## v1.0

- Initial release: ambient bar customers receive visible bottle props during bar drinking animations.
