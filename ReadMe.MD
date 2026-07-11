# DuelingBookReloaded

## Fork acknowledgement

DuelingBookReloaded is a fork of
[DuelingBookEnhanced](https://github.com/alexjraymond/DuelingBookEnhanced) by
[alexjraymond](https://github.com/alexjraymond). All credit for the original
extension goes to Alex & Joseph — this fork exists to keep the project alive,
fix outstanding issues, and add new features.

## Overview

Duelists — are you tired of clicking through all your actions on [DuelingBook](https://www.duelingbook.com/html5)?

DuelingBookReloaded is a collection of quality-of-life features for DuelingBook: fully customizable hotkeys (including multi-key sequences), dark mode, intro skipping, and auto-connect. It's a Chrome extension built with a TypeScript content script and a React popup/options UI.

## Features

1. **Fully Customizable Hotkeys**: Trigger actions with a single key or a multi-key sequence (e.g. bind `V → E` to View Extra Deck). Rebind anything with the press-to-record editor in the settings page; individual hotkeys can also be disabled. Default hotkeys below:

---
| Feature | Default Hotkey | Description |
| ------- | -------------- | ----------- |
| Close View Menu | Escape | Closes the view menu |
| View Graveyard | G | Toggles the display of your graveyard |
| View Main Deck | V | Toggles the display of your main deck |
| View Extra Deck | E | Toggles the display of your extra deck |
| View Banish | , | Toggles the display of your banished cards |
| Think | T | Presses the thinking button and sends a message in chat saying that you're thinking |
| Thumbs Up | F | Presses the thumbs up button |
| Toggle Chat Box | Enter | Start or finish typing in the chat box with a single keypress |
| Mill 1–6 | 1–6 | Send that many cards from the top of your deck to the graveyard |
| Add LP | + | Focuses the LP textbox. Just type the number to add to your LP and then push enter |
| Sub LP | - | Focuses the LP textbox. Just type the number to subtract from your LP and then push enter |

---

   ***The hotkeys below require you to hover over a card.***
---
| **Feature** | **Default Hotkey** | **Description** |
| ------- | -------------- | ----------- |
| Activate / To S/T | A | Activates a card, or places it in the S/T zone |
| Banish | W | Banishes a card |
| Banish FD | B | Banishes a card face down |
| Banish T. | M | Banishes the top card of your deck (no hover needed) |
| Declare | D | Declares a card |
| Normal Summon | N | Normal summon a card in attack position |
| S. Summon ATK / SS ATK | S | Special summon a card in attack position |
| S. Summon DEF / SS DEF | X | Special summon a card in defense position |
| Overlay | O | Overlays a card |
| OL ATK / OL DEF | I / P | Overlay summon in attack / defense position |
| Set | J | Sets a card |
| Target | R | Targets a card |
| To Bottom of Deck / To B. Deck | Z | Places a card to the bottom of your deck |
| To Graveyard / To Grave / Detach | Q | Sends a card to the graveyard |
| To Hand / To Extra Deck | H | Sends a card to your hand or extra deck |
| To Extra Deck FU | U | Sends a card to your extra deck face up |

---

2. **Dark Mode**: Apply a dark mode.
3. **Skip Intro**: Automatically skip the intro movie.
4. **AutoConnect**: Automatically connect to the main menu or last screen if you're already logged in.

## Installation

1. Grab the latest `DuelingBookReloaded-v*.zip` from the [Releases page](https://github.com/carlosg-gh/DuelingBookReloaded/releases) and unzip it — or clone this repo and run `npm install && npm run build` to produce the `dist/` folder yourself.

2. Go to `chrome://extensions`, enable **Developer mode**, and click **Load unpacked**.

3. Select the unzipped folder (or `dist/`).

4. Visit [DuelingBook](https://www.duelingbook.com/html5) and have fun!

## Usage

1. **Extension Icon**: Click the extension icon in your browser to open the popup. (Consider pinning it to your frequently used extensions! <3)

2. **General Settings**: Enable/disable the general options from the popup.

3. **Full Settings**: Open the options page via the gear icon in the popup, or by right-clicking the extension and choosing `Options`. Customize hotkeys (single keys or sequences) in the **Customize Hotkeys** section.

4. **Feedback**: Found a bug or want a feature? [Open an issue](https://github.com/carlosg-gh/DuelingBookReloaded/issues).

## Compatibility

The content script is designed for DuelingBook using Google Chrome (Manifest V3).

## License

DuelingBookReloaded is under the [MIT License](LICENSE).

## Disclaimer

Use DuelingBookReloaded responsibly and respect the rights of Yu-Gi-Oh! owned by its respective copyright holders, as well as [DuelingBook](https://www.duelingbook.com/html5)'s terms of use. The authors are not responsible for the misuse or unauthorized use of these scripts.
