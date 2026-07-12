# DuelingBookReloaded

A Chrome extension (Manifest V3) adding quality-of-life features to
[duelingbook.com](https://www.duelingbook.com): configurable hotkeys (single
keys or multi-key sequences), dark mode, auto-connect, and intro skipping.

## Commands

- `npm run build` — typecheck (`tsc`), webpack production build, Tailwind CSS. Output goes to `dist/`.
- `npm test` — jest unit tests (`src/**/*.test.ts`).
- `npm run start` / `npm run watch` — webpack dev watch builds.
- `npm run style` — prettier over `src/`.
- `npm run clean` — remove `dist/`.

To try the extension: build, then load `dist/` as an unpacked extension at
`chrome://extensions` (Developer mode → "Load unpacked").

## Architecture

Stack: React 18 + TypeScript, webpack 5 (`webpack/webpack.*.js`), Tailwind.
Webpack entry points are declared in `webpack/webpack.common.js`; the
manifest lives in `public/manifest.json` and is copied into `dist/` verbatim.

- `src/data/actionCatalog.ts` — **single source of truth** for every
  bindable action. The binding unit is **(context group, action)**: each
  entry has `placements` (one per hover-context group it appears in, each
  with its own default hotkey; `""` = unbound) plus a kind (`cardMenu`
  clicks a label in the open card menu, `pileHover` clicks in a pile's
  menu only while the pointer hovers that pile, `pileMenu` opens a pile
  menu remotely then clicks — Global group, `global` fires
  unconditionally — Global group) and the exact menu label. The 13 card/
  pile groups + Global are ordered by `GROUP_ORDER`/`GROUP_LABELS`.
  Context data derives from DuelingBook's client source — see
  `docs/duelingbook-internals.md`. Defaults, handlers, options sections,
  hints, conflict rules, and context detection all derive from this file.
- `src/utilities/contextDetection.ts` — pure: decides which group(s) a
  keypress belongs to from a DOM snapshot: pile-menu label signature →
  pile groups; `#view .title_txt` ("Viewing Graveyard"…) → view-card
  groups; otherwise a fingerprint intersecting `buildCardLabelIndex()`
  over the open menu's labels. Returns a candidate LIST — ambiguous menus
  (hand monster vs trap with all zones full) return several groups and
  the content script matches against their merged bindings, which is
  exactly the old click-if-present behavior.
- `src/content_script.tsx` — injected into duelingbook.com. Owns all in-game
  behavior: the context-scoped key matching (see "Key handling"), the
  derived action→function map (`buildActionFunctionMap(actionCatalog, …)`
  with custom handlers for `global` actions), and DOM manipulation of
  DuelingBook's UI (clicking its buttons/menus by id/class, reusing
  `touchNativeMenu.ts` helpers for card/pile menus).
- `src/background.ts` — MV3 service worker; only opens the "new features"
  page on install/update.
- `src/popup.tsx`, `src/fullOptions.tsx` — toolbar popup and options page
  (options page is where hotkeys are customized via `CustomizeHotkeys.tsx` →
  `components/HotkeySection.tsx` → `components/HotkeyRecorder.tsx`).
- `src/utilities/configUtility.ts` — hotkey persistence. Working shape is
  `ContextHotkeyEntry[]` (`{context, action, hotkey, disabled}`,
  `src/utilities/hotkeySequence.ts`); `hotkey` is a space-separated token
  sequence, a token is `["shift+"] base` (`"v"`, `"shift+b"`,
  `"s shift+b"`, `"f1"`); Shift is meaningful only on letters/digits.
  Storage is **sparse**: `hotkeysConfigV2` holds only deviations from the
  catalog defaults (`expandOverrides`/`diffAgainstDefaults` — the full
  ~140-row config would exceed chrome.storage.sync's 8KB item quota, and
  sparseness lets improved defaults propagate on upgrade unless the user
  customized that row; `expandOverrides` also blanks any shipped default
  that would collide with a user override). Legacy per-action
  `hotkeysConfig` is migrated best-effort on first load (`migrateV1`:
  fan out to placements, skip conflicting ones) then removed.
  `saveHotkeysConfig` broadcasts a `HOTKEYS_CHANGED` message whose
  payload is the expanded sorted rows. `src/utilities/configTransfer.ts`
  exports/imports the same overrides shape as versioned JSON
  (`{format: "dbr-hotkeys", version: 2, overrides}`) — import is
  forgiving (unknown/malformed/colliding entries dropped with a notice)
  and consistent with upgrade semantics (imported keys beat shipped
  defaults).
- `src/utilities/keyNormalization.ts` — the single place keyboard events
  become tokens (`normalizeKeyEvent`, via `e.code` for letters/digits so
  Shift/CapsLock can't skew them) and tokens become UI text
  (`displaySequence` → `S → ⇧B`). Content script, recorder, and overlay all
  use it.
- `src/utilities/hintsData.ts` + `src/utilities/hintsOverlay.ts` — the
  in-game hotkey hints popup ("Show Hotkey Hints" action, default F1).
  `hintsData` groups enabled bound rows per context group in `GROUP_ORDER`
  (pure/testable); `hintsOverlay` is a vanilla-DOM singleton
  (`#dbr-hints-overlay`, styled by `src/styles/hints-overlay.css`) with no
  focusable elements. The active matcher's
  `pendingPrefix()`/`continuations()` drive live narrowing while a
  sequence is pending.
- `src/utilities/sequenceMatcher.ts` — pure trie-based matcher for key
  sequences. `fire` runs actions, `prefix` waits (1.5s inter-key
  timeout), `nomatch` lets the key fall through. Duplicate sequences map
  to multiple actions — only reachable via merged (ambiguous-context)
  matchers, where the first present menu label (catalog order) wins.
- `src/utilities/hotkeyValidation.ts` — group-scoped conflict rules.
  Hard (blocked): prefix relations within a group, and anything involving
  the Global group (its actions fire everywhere). Warning (saved, amber
  note): equal keys between two actions of one non-global group — both
  fire, handlers click-if-present, and when a menu offers both labels the
  action earlier in the catalog acts. Across groups anything goes —
  matching is context-scoped, so `d` is Draw while hovering the deck and
  Declare on a card, and group A may bind `t` while group B binds `t h`.
- Touchscreen mode (option `touchMode`: on/off/auto, auto =
  `matchMedia("(pointer: coarse)")`): tapping a duel card or pile opens a
  radial fan of large action buttons that drives DuelingBook's own (CSS-hidden)
  card menu. Modules: `src/utilities/touchMenuData.ts` (pure: action→group
  table, `buildFanModel`, `resolveTouchActive`), `touchFanLayout.ts` (pure:
  ring/grid geometry in viewport px), `touchNativeMenu.ts` (opens/reads/
  clicks/closes `#card_menu` via synthetic MouseEvents), `touchFanOverlay.ts`
  (DOM singleton `#dbr-touch-fan`, hintsOverlay pattern, divs only),
  `touchInput.ts` (window capture-phase touch classifier: fan → interactive
  elements → cards/piles → generic tap-to-hover shim; toggles `dbr-touch` on
  `<html>`), styled by `src/styles/touch-mode.css`. Mouse clicks open the fan
  too (the native menu is invisible while the mode is on), with a capture-phase
  guard that swallows trusted card/pile mouseover/mouseout while the fan is
  open — otherwise mousing toward a fan button across neighboring cards would
  swap DuelingBook's menu underneath it and a fan click would act on the
  wrong card.
- Replay controls (`src/replay_main.ts`, a **MAIN-world** content script
  on `/replay*` only — the replay engine's state is page globals the
  isolated world can't touch): speed presets (0.5×–4×, `timer.millis` ÷
  speed + `TweenMax.globalTimeScale`, re-enforced on a poll because DB's
  `playE`/`fastE` reset the timer and the native buttons hold direct
  references), step backward / jump-to-any-point via DB's own per-action
  `GAMESTATES` snapshots + `restoreGamestate` (plus `gotoDuel` and turn
  bookkeeping, which restore skips) keyed by a self-recorded
  play→snapshot map, forward seeks through the engine's own
  `gotoSeconds`/`skipping` path (accelerated: board tweens snapped every
  10ms — but never DB's watcher/chat panel tweens, whose forced
  onCompletes crash against half-initialized scrollbars and can jam the
  queue — plus `setTimeout` delays ≤1.5s clamped to 0 and sound muted for
  the duration, ≈3× faster; a 5s no-progress watchdog aborts a jammed
  seek by restoring the nearest snapshot, which clears the queue), and a
  bottom timeline bar (`#dbr-replay-bar`, hintsOverlay pattern, divs
  only, `src/styles/replay-controls.css`) with turn/game markers and an
  event-icon strip (summons/activations/attacks/phases/LP, classified by
  `eventKind`; hover shows the play's own `log.public_log` line, click
  jumps there), plus
  native-looking Prev/Next buttons replacing DB's "Next Play" in its
  panel slot (DB's visible buttons are `.button.proxy` divs with
  `pointer-events: none` over invisible real inputs — ours re-enable
  pointer events in the CSS). Restores are hardened: snapshots can
  reference cards absent from the live pools (destroyed tokens,
  sided-out cards after a game boundary) and duel.js's restore both
  crashes on the null lookup and strands `resetting=true` (killing
  endAction forever) — a `getDuelCard` wrapper resurrects misses via
  `newDuelCard` (owner tracked through an `initCards` wrapper, faces from
  play payloads injected as `entry.data`), snapshot lists are sanitized
  of transient nulls (field's positional nulls stay), and `initDuel` is
  try/catch-wrapped with a `resetting` unstick timer as backstops. Pure
  timeline math lives in
  `src/utilities/replayTimeline.ts` (tested). Never restore a pre-deal
  game-1 snapshot — opening hands are dealt by intro *actions*, not
  plays, so replaying from one crashes duel.js (game 2+ deals are
  play-driven); `isUsableGamestate` filters those. The isolated world
  bridges hotkeys (catalog group `replay`, kind `replay`, matched only on
  `/replay`; its rows are dropped on every other page so space/arrows
  never get swallowed from type-to-chat) and the `replayControls` option
  via `window.postMessage` (`dbr: "replay-command"` / `"replay-enable"`).
- `src/data/validHotkeys.ts` — whitelist of assignable keys.
- `src/data/hotkeySections.ts` — options-page sections: one per context
  group in `GROUP_ORDER`; the catalog's `section` field only provides
  subheads inside the Global section.
- `src/styles/menu-tweaks.css` — always-injected: pins
  `#card_menu_content { top: 0 !important }` to defeat DuelingBook's
  ~30ms-per-row menu unroll tween (stylesheet `!important` beats
  TweenMax's inline styles) and replaces it with an 80ms fade. Hotkeys
  and context detection read this menu, so it must appear instantly.
- `docs/duelingbook-internals.md` — how to deobfuscate DuelingBook's
  `duel.js` (webcrack) and where its menu builders live; read it before
  touching the catalog's context data.

## Key handling (why it's shaped this way)

DuelingBook auto-focuses its chat input on any keypress. The content script
therefore listens on `window` in the **capture phase, synchronously** —
never debounce these handlers or move them to bubble phase, or the page
steals focus before the extension sees the key. Keys that match (or start)
a binding get `preventDefault()` + `stopImmediatePropagation()`. A
`typingIntent` flag tracks whether the user is deliberately typing (clicked
an input, toggled the chat box, adjusting LP); while set, nothing is
intercepted.

Matching is **context-scoped**: `setHotkeys` builds one `SequenceMatcher`
per group (that group's rows + the Global rows — validation guarantees no
overlap), a Global-only matcher, and a union matcher. Keydown order:
1. A pending sequence steps only the **locked matcher** that started it
   (hints/timeout logic target it; every reset site releases the lock).
2. Fast path: keys that begin no binding anywhere (`firstTokens`) fall
   through with zero DOM reads.
3. Otherwise `ensureCardMenuOpen()` (pointer tracking), build the
   detection snapshot, `detectContextGroups` → one matcher, or a cached
   **merged matcher** when candidates tie, or Global-only when nothing is
   hovered.
4. On nomatch the **union matcher is a swallow oracle**: a key bound in
   ANY group is swallowed (and locks swallow-only if it starts a
   sequence) so bound keys never leak into type-to-chat; only truly
   unbound keys reach the page.

## Gotchas

- DuelingBook DOM selectors are fragile and undocumented (e.g. the chat box
  is `document.querySelectorAll("input.cin_txt")[1]`, card menus are
  `#card_menu_content .card_menu_btn`). If the site updates, these break
  silently.
- New actions are added **only** in `src/data/actionCatalog.ts` — defaults,
  handlers, options rows, hints, conflict rules, and context detection
  all derive from it. `findHandlerGaps` reports globals missing a handler
  and handlers naming no catalog action (console.error at startup — never
  a throw, which would abort `window.onload` and kill every feature). Get
  a placement's group right or both the conflict checker and the
  fingerprint detector misbehave (context data comes from DuelingBook's
  source — `docs/duelingbook-internals.md`). The pinned per-group default
  table + no-conflict invariant live in `actionCatalog.test.ts`.
- Context detection fingerprints menus against the catalog's label data —
  re-audit both together when DuelingBook ships a new `duel.js`.
- Row order is behavior wherever one key maps to several actions (merged
  ambiguous-context matchers, warning-level in-group shares): the first
  action whose label is present acts. `loadHotkeysConfig`,
  `saveHotkeysConfig`, and the content script's `setHotkeys` all sort
  into catalog order — don't feed matchers unsorted rows.
- `hotkey: ""` means unbound (skipped by matcher, hints, and validation).
  Storage keeps only overrides; `expandOverrides` blanks a shipped
  default that would collide with a user override — an upgrade must
  never break or shadow a user's keys.
- DuelingBook never re-fires `mouseover` when a card moves under a
  stationary pointer (post-summon tween), and `showMenu` refuses while a
  card is tweening — so card hotkeys track the pointer (`mousemove`
  capture) and re-open the menu for the card under it before clicking.
- The deck pile menu opens on mere hover of `#deck_hidden`, and its DOM
  order is the *reverse* of `showDeckMenu`'s push order (and differs
  between solo and multiplayer) — always click pile buttons by label,
  never by index.
- Options-page keys captured by `HotkeyRecorder` must be confirmed with the
  Done **button** — Enter and Escape are themselves assignable keys.
- In touch mode the native `#card_menu` is hidden with `opacity: 0` but MUST
  stay in the DOM with real layout — `playCard` and the fan click its spans,
  and DuelingBook's `:visible` checks must keep passing. Never `display:none`
  it. When closed, DuelingBook *detaches* `#card_menu` from the DOM
  (presence = open). The content script is isolated-world: DuelingBook is
  driven only via synthetic MouseEvents (`mouseover` on a card's `.content`
  opens the menu synchronously; `mouseout` with clientY *below* the card's
  bottom closes it — coords above are treated as moving into the menu), and
  `showMenu` can silently refuse (card tweening, overlay up), so success is
  verified by reading `#card_menu` back.
- Testing anything that touches `chrome.*` requires mocks; prefer keeping
  logic in pure modules (like the matcher/validator) instead.

## CI

- `.github/workflows/build.yml` — build + test on pushes/PRs to `main`.
- `.github/workflows/release.yml` — on push to `main`: builds, zips `dist/`,
  uploads it as an artifact, and publishes a GitHub Release tagged
  `v<version>` when `public/manifest.json`'s version changes.
