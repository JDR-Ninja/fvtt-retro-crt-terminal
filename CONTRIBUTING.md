# Contributing

Notes for working on the module itself. Gamemasters only need the [README](README.md).

## Development setup

Requires Node.js 20 or later and Foundry VTT v14.

```sh
npm install
npm run build:packs
```

The two Compendiums are compiled from `packs-src/` into `packs/`, which is build output and stays out of version control: run `npm run build:packs` after cloning the repository and after changing a source so both development Compendiums stay current. Then place or link the repository in Foundry's `Data/modules/retro-crt-terminal` directory and enable the module in a v14 world.

## Checks

```sh
npm run check
npm test
```

`check` validates JavaScript syntax, manifest paths, pack sources, and localization completeness in both languages. The test suite covers parser behavior, release-state filtering, automatic menus, navigation sessions, synchronized presentation, theme merging, and registration against a mocked Foundry v14 public surface. A final interactive pass in Foundry is still required for sheet rendering and hook behavior.

## Compendium sources

Editable pack sources live in `packs-src/gm-guide` (bilingual guides and terminal templates) and `packs-src/gm-macros` (GM macros). The release build always recompiles both packs with the official Foundry VTT CLI.

## Documentation screenshots

Screenshots live in `assets/screenshots` and are regenerated with `scripts/dev/Capture-Screenshot.ps1`, which captures a viewport region straight to WebP through `cwebp` (`winget install --id Google.Libwebp --exact`). The script refuses to write anything unless it finds the guard swatch the page paints at its top-left corner, so a window that steals focus cannot be captured by mistake. Run it with `-Calibrate -ExpectWidth <viewport width>` first to locate the viewport on screen.
