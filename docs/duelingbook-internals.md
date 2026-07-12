# DuelingBook client internals (menu actions)

How `src/data/actionCatalog.ts` was derived, and how to re-audit it when
DuelingBook ships a new client version.

## Getting readable source

DuelingBook's duel client is `duel.js`, obfuscated with
javascript-obfuscator (string array + rotator). [webcrack](https://github.com/j4k0xb/webcrack)
restores it to readable JS with all string literals inlined:

```sh
curl -s -o duel.js 'https://static.duelingbook.com/duel.js?v=926'
npx --yes webcrack duel.js -o duel-deob   # → duel-deob/deobfuscated.js
```

The `?v=` version is in the `<script>` tags of `https://www.duelingbook.com/`.
The catalog was last audited against **v=926** (July 2026). To re-audit,
deobfuscate the new version and diff the functions below against the
catalog; the label census is a quick smoke test:

```sh
grep -oE 'label: "[^"]+"' deobfuscated.js | sort | uniq -c | sort -rn
```

## Where menus are built (v=926 line numbers)

| Function | ~Line | Builds |
|---|---|---|
| `cardMenuE()` | 9650 | The card menu. One branch per context: own hand (`isIn(player1.hand_arr)`), field monster (`isMonster`, with `face_down`/`inDEF` sub-branches), S/T + field spell + pendulum zones (`isST`, `fieldSpell`, `pendulumLeft/Right`), graveyard (`grave_arr`), banished (`banished_arr`), extra deck (`extra_arr`), viewing own deck (`main_arr` + `viewing`), xyz materials (`.hasClass("xyzmaterial")` — resets the menu to Detach/Banish), opponent's grave/banished cards, and battle-phase Attack (`currentPhase == "BP"`). |
| `showMenu(card, items)` | 10888 | Renders any menu. **Reverses** the pushed items, and at card scale < 0.2 (view lists, piles, opponent cards) **aliases labels**: `S. Summon ATK→SS ATK`, `S. Summon DEF→SS DEF`, `To Graveyard→To Grave`, `To Top of Deck→To T. Deck`, `To Bottom of Deck→To B. Deck`. Each full/abbreviated pair therefore lives in disjoint contexts — that's why they can share hotkeys. |
| `showDeckMenu()` | 11158 | Main-deck pile menu, pushed as `[Draw, Shuffle, Mill, Banish T., (Banish B.), Banish FD, View, (Show), (Flip Deck), …]` then reversed by `showMenu`. Opens on `mouseenter` of `#deck_hidden`. The old index-based "Banish T." click hit "Banish FD" in multiplayer because of this reversal — click by label. |
| `showExtraDeckMenu()` | 11590 | Extra-deck pile menu: `View`, `Show` (non-solo), plus card-gated banish entries. Opens via `#extra_hidden`. |
| `cardMenuE2` | — | Automatic-duel menus; not in `duel.js` (separate script). Out of scope for the extension. |

Grave/banished piles have **no pile menu** — hovering previews, clicking
opens the view (`graveOver`/`banishedOver`, ~4062).

Useful page globals when probing live: `menu_reason` /
`remove_menu_reason` explain why the menu refused to open or closed.

## View window titles (`viewingE`, ~4247)

`$("#view .title_txt").text("Viewing " + name)` — plain DOM, readable
from the isolated world. Known names (switch in `viewingE`): `Deck`,
`Deck (Top Card)`, `Deck (Picking Card)`, `Deck (Picking 2/3/4 Cards)`,
`Deck (Choosing 2 Cards)`, `Graveyard`, `Banished`, `Extra Deck`,
`Host's Public Extra Deck`, `Xyz Materials`, `Opponent's Graveyard`,
`Opponent's Banished`, `Opponent's Extra Deck (partial)`, plus
opponent-hand/deck variants. `contextDetection.viewTitleGroup` maps these
to binding groups; unknown titles yield no card group (global keys only).

## Menu open animation (`showMenu`, ~11077)

`TweenMax.fromTo(menu.find("#card_menu_content"), labels.length * 0.03,
{top: menuHeight}, {top: 0})` — ~30ms per row. The extension pins
`#card_menu_content { top: 0 !important }` (`src/styles/menu-tweaks.css`)
so the menu is usable the instant it attaches; hotkey context detection
reads it synchronously.

## Fingerprint dependency

`contextDetection.fingerprintCardMenu` intersects the catalog's
label→groups index over the open menu's labels. It is only as accurate as
the catalog's placement data, which mirrors `cardMenuE`'s branches — when
re-auditing a new duel.js version, update placements and the detection
fixtures together. The handMonster/handST split hinges on: monsters get
Normal Summon/Set(monster)/S. Summons/Set (To S/T) (effect-text-gated)/
pendulum Activates; spells get Activate/Set(ST or field spell); traps get
Set and To S/T (`card_type != "Spell"`); Declare/Reveal/sends are shared.

## What the catalog includes

Every label reachable through generic play, plus the single
`Resolve Effect` label (one label shared by ~33 card-specific gates).
Labels only reachable through `findCard([...])` gates for specific cards,
moderator flags, or debug query params are excluded — the list is in the
comment block at the bottom of `src/data/actionCatalog.ts`.

## Context model

`cardMenuE`'s branches map to the `ContextTag` values in the catalog. Two
context-conditional actions can share a hotkey because the extension
fires every action bound to a sequence and each handler only clicks its
label if the open menu contains it (`clickMenuAction`); when contexts
overlap, the action earlier in catalog order clicks first and the click
closes the menu, so the rest no-op. `pileHover` actions extend this to
pile menus: they only act when the open menu passes the pile's label
signature (`isPileMenuLabels`), so their pile contexts are disjoint from
every card context by construction.

Two hover quirks matter for hotkeys: DuelingBook opens menus on
`mouseover` only, and browsers don't re-fire it when a card *moves under*
a stationary pointer (a freshly summoned card tweens to the field and the
menu stays gone until the mouse wiggles) — and `showMenu` silently
refuses while the card is still tweening. The content script tracks the
pointer and re-opens the menu via `elementFromPoint` before clicking.
