# Changelog

## 0.6.0

The hotkey system was rebuilt around **hover contexts**: bindings now
belong to the thing your mouse is on.

- **Per-context hotkeys**: 14 binding groups (hand monsters, hand
  spells/traps, your face-up/face-down monsters, your backrow, the deck
  and Extra Deck piles, graveyard/banished/deck/Extra Deck views, xyz
  materials, opponent's GY/banished, plus "Anywhere"). The same key can
  do different things per context — `d` draws while hovering your deck,
  declares on a card, detaches on an xyz material.
- **Many new actions**: Attack, Attack Directly, Flip Summon, Flip,
  To ATK/DEF, Move, Overlay ATK/DEF, Attach, Reveal, To Top of Deck,
  Draw, Shuffle, Mill Deck, Resolve Effect, Choose, and more — every
  generic action DuelingBook's menus offer.
- **New default keymap**, prefix-based and mnemonic: `v`+key opens views,
  `t`+key sends cards (t h → To Hand, t g → To Graveyard…), `s a`/`s d`
  special summons, `o a`/`o d` overlay-summons; `a` attacks/activates/
  attaches by context.
- **Smarter conflicts**: keys only clash within their own group; equal
  keys in one group are allowed with a warning (prefix overlaps and
  "Anywhere" keys still block).
- **Import/Export**: back up and share configs as JSON from the settings
  page.
- **Instant action menu**: DuelingBook's slow menu-unroll animation is
  replaced with a snappy fade.
- **Fixes**: hotkeys work immediately on a freshly summoned card (no
  more mouse wiggle); "Banish T." no longer clicks the wrong deck button
  in multiplayer; only one hotkey recorder can capture keys at a time;
  sequence timeout raised to 1.5s; settings page realigned with a fixed
  sidebar.
- Existing configs migrate automatically; use Reset Defaults to adopt
  the new keymap.

## 0.5.0

- Catalog-driven hotkeys with context-aware key sharing; ~30 new
  bindable actions.

## 0.4.x

- Touchscreen mode (radial action fan), hotkey hints overlay (F1),
  shift-modifier keys, multi-key sequences, press-to-record editor,
  GitHub corner; project renamed to DuelingBookReloaded.
