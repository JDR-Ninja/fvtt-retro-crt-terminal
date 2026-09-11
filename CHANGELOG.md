# Changelog

All notable changes to Retro CRT Terminal are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] — 2026-09-11

### Fixed

- Keyboard navigation no longer dies after the password prompt: the terminal takes focus back once the dialog is torn down, whether the code was accepted or refused.
- Observers now see a controller who disconnects (and one who returns): connection changes arrive through `userConnected`, not as User updates, and every window showing the controller repaints from that hook too.
- The "Password Archive" templates asked for a theme that does not exist (`amber-crt`) and silently rendered green; they use `amber-mainframe`.
- The guides' markup samples collapsed onto a single line under Foundry v14's inline `code` styling; each sample now keeps its line breaks.
- `api.open()` refuses a Journal the user cannot observe instead of opening an empty "file unavailable" window.
- The launcher's synchronized-session banner was clipped to Foundry's fixed button height.
- The terminal footer wrapped its buttons under wider fonts such as Share Tech Mono; the key legend now shortens instead.
- Pressing a digit moves the menu highlight to the activated row, so a lock prompt no longer opens over a stale cursor.
- The screen's accessible name no longer spells out the name of a hidden page opened by UUID.

### Changed

- The Structure tab lists pages in the terminal's own order — each page under its parent, indented — instead of a flat list sorted by sort value.
- The guides and the README state that hidden and locked states only govern the terminal window: an Observer can still read every page by opening the Journal itself, so content that must stay secret belongs in a Journal the players cannot observe.
- The README now addresses Gamemasters only, with installation by manifest URL; development setup, checks, Compendium sources and screenshots moved to `CONTRIBUTING.md`.

### Removed

- The residual `launcher.audience` field from the six Compendium templates.
- The compiled Compendium packs from version control. `packs/` is build output: `npm run build:packs` produces it from `packs-src/` for development, and the release build compiles the packs again into `dist/`. `npm run check` now validates each manifest pack against its source rather than its compiled files.

## [0.2.0] — 2026-09-06

### Added

- The ten curated terminal fonts now load, declared against Google Fonts. No font files ship with the module; a world without internet access falls back to `monospace`.
- `terminal:<pageId>` works as a start page and as the `page` option of `api.open()`.

### Changed

- Hidden and locked states are inherited by descendant pages; unlocking an ancestor releases the branch.
- Menu entries and bare inline links a player cannot reach are redacted. Gamemasters still see the real label.
- GM debug visibility is suspended during a synchronized session.
- Theme edits are saved once the controls settle, not on every colour and slider event.
- Opening an already-open terminal brings its window forward instead of stacking a second one.
- Escape no longer closes the window for an observer of a synchronized session.

### Fixed

- The English guide quoted the demo password as `ORPHEUS-79`; it is `ORPHEE-79`.
- Any Journal named "Orpheus Security Console" could be mistaken for the demo and overwritten.
- Unlocking a page guarded by an ancestor unlocked the wrong page.
- The "file unavailable" screen rendered without its theme.

### Removed

- Three unreferenced applications and four dead templates, superseded by the tabbed configuration window.
- The unread `launcher.audience` field. A residual value on an existing world is ignored; no migration needed.
- Four orphaned localization keys.

### Security

- Synchronized presentation no longer trusts socket packets, which Foundry relays unauthenticated: any player could forge a controller packet and push arbitrary unlocks to the table. The socket now carries only the menu cursor; navigation, history and unlocks travel on the controller's User document.

## [0.1.0] — 2026-08-22

- Initial release.
