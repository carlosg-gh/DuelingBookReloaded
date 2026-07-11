# Project Extension Version History

## Version 0.4.0 (2026-07-11)

### New Features
- **Shift-modifier hotkeys**: every step of a binding can require Shift, e.g. `S → B` for Banish and `S → ⇧B` for Banish FD. Recorded per key in the settings editor (shown as ⇧B). Letters and digits only; Ctrl/Alt combos remain reserved for the browser.
- **Hotkey hints overlay**: press F1 (rebindable "Show Hotkey Hints" action) to see all enabled hotkeys grouped by section. While a sequence is pending the overlay narrows to the possible continuations — and a small corner hint shows them even when the overlay is closed. Escape or F1 closes it.
- Updated the extension icon with a golden "R".

### Bug Fixes
- Thumbs Up now releases correctly when Shift is let go before the key.
- Hotkey actions added in new versions now appear automatically for existing installs.

## Version 0.3.2 (2026-07-11)

### Bug Fixes
- Saving hotkeys no longer floods the settings-page console with "Receiving end does not exist" errors (the change broadcast now ignores tabs without the content script).
- Fixed the What's New page rendering its bullet list without list styling in a too-narrow container.
- Removed leftover debug logging from the settings page.

## Version 0.3.1 (2026-07-11)

### Project Changes
- Renamed the project to **DuelingBookReloaded** (a fork of DuelingBookEnhanced by alexjraymond).
- Added fork attribution to the settings page and README.
- Removed Discord banners, the donation footer, and the old feedback form; feedback now goes through GitHub issues.
- Removed the placeholder "Advanced" settings section.

### Bug Fixes
- Fixed the settings page showing most hotkeys as "unset" on a fresh install.

## Version 0.3.0 (2026-07-11)

### Bug Fixes
- Hotkeys no longer lose the race against DuelingBook's chat box: keypresses used to auto-focus the chat input, so hotkeys only worked right after clicking outside it. Hotkey presses are now intercepted before the page sees them, while normal chat typing is left untouched.
- Fixed a crash when reading options on a fresh install.
- Fixed the "Activate/To S/T" settings row only ever editing "Activate".

### New Features
- **Multi-key hotkey sequences**: bind combos like `V → E` alongside single keys (800ms window between keys).
- **Press-to-record hotkey editor** in the settings page, replacing the dropdowns.
- Smarter conflict detection: a binding is rejected when it equals or is a prefix of another action's binding.

### Under the Hood
- Updated dependencies and fixed the extension manifest (removed a broken content-script reference and malformed host permissions).
- Repaired CI (it never ran from its old location) and added an automated build/release pipeline.
- Added unit tests for the new hotkey engine.

## Version 0.2.2 (2023-11-17)

### New Hotkeys
- "To Extra Deck" and "To Hand" now share a hotkey.
- "To Extra Deck FU" (default: U).
- "Banish T" (default: M).
- "Target" (default: R).

### Bug Fixes and Changes
- "Keep Going" changed to a toggle function.
- Removed hotkeys (tab, shift, ctrl, etc.) due to conflicts.
- Updated configuration notes for clarity.
- Introduced a "What's New" page for updates and installation.

## Version 0.2.1 (2023-11-07)

### New Hotkeys
- SS Def. (default: X)
- Detach (mapped with To Graveyard/To Grave).
- Overlay. (default: O)
- OL ATK. (default: I)
- OL DEF. (default: P)

### New Features
- Holding the Thumbs Up hotkey triggers "Keep Going!" message.
- Option to disable all hotkeys.
- Easter egg in the Advanced settings section.

## Version 0.2.0 (2023-11-03)

### New Features
- Customizable hotkeys.
- Toggle for individual hotkeys.
- Real-time settings changes.

### New Hotkeys
- Milling 1-6 cards (defaulted to num row keys 1-6).
- Add/sub LP (defaulted to +/-).
- "To Bottom of Deck" and "To B. Deck" (defaulted to z).

## Version 0.1.1 (2023-09-27)

### Bug Fixes
- Adjusted error with extension running on non-targeted websites.

## Version 0.1.0 (2023-09-21)

### Initial Features

#### Hotkeys for Immediate Actions
- **Close View Menu (Escape)**: Closes the view menu.
- **View Graveyard (G)**: Toggles the display of your graveyard.
- **View Main Deck (V)**: Toggles the display of your main deck.
- **View Extra Deck (E)**: Toggles the display of your extra deck.
- **Think (T)**: Press the thinking button and send a chat message indicating that you're thinking.
- **Thumbs Up (F)**: Press the thumbs-up button.
- **Toggle Chat Box (Enter)**: Start or finish typing in the chat box with a single keypress.

#### Hotkeys for Card Actions (Require Hovering Over a Card)
- **To Graveyard (Q)**: Sends a card to the graveyard.
- **To Hand (H)**: Sends a card to your hand.
- **Activate (A)**: Activates a card.
- **S. Summon ATK / SS ATK (S)**: Special Summons a card in attack position.
- **Normal Summon (N)**: Special Summons a card in attack position.
- **Set (J)**: Sets a card.
- **Declare (D)**: Declares a card.
- **Banish (W)**: Banishes a card.

### Other Features
- **Dark Mode**: Implement a dark mode interface.
- **Skip Intro**: Option to automatically skip the intro movie.
- **AutoConnect**: Automatically connects to the main menu or last screen if already logged in.
