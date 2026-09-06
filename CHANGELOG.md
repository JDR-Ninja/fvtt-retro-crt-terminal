# Changelog

All notable changes to Retro CRT Terminal are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
