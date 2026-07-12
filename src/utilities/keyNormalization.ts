import { validHotkeys } from "../data/validHotkeys";

/**
 * A binding step ("token") is stored as `["shift+"] base`, e.g. "b",
 * "shift+b", "f1". Shift is only meaningful on letters and digits:
 * shifted punctuation produces a different character entirely (Shift+/ is
 * "?"), and the "+" binding is itself typed as Shift+= — so for anything
 * that isn't a letter or digit the shift state is deliberately dropped.
 */

export interface TokenParts {
  key: string;
  shift: boolean;
}

const SHIFT_PREFIX = "shift+";

export function parseToken(token: string): TokenParts {
  if (token.startsWith(SHIFT_PREFIX)) {
    return { key: token.slice(SHIFT_PREFIX.length), shift: true };
  }
  return { key: token, shift: false };
}

export function formatToken(parts: TokenParts): string {
  return parts.shift ? `${SHIFT_PREFIX}${parts.key}` : parts.key;
}

/**
 * Normalize a keyboard event to a binding token, or null for presses that
 * can never be part of a binding (modifier keys themselves).
 * Letters and digits normalize via e.code so the result is immune to
 * Shift ("B") and CapsLock; everything else uses the produced key.
 */
export function normalizeKeyEvent(e: {
  key: string;
  code: string;
  shiftKey: boolean;
}): string | null {
  const key = e.key.toLowerCase();
  if (key === "shift" || key === "control" || key === "alt" || key === "meta") {
    return null;
  }

  const letter = /^Key([A-Z])$/.exec(e.code);
  if (letter) {
    return formatToken({ key: letter[1].toLowerCase(), shift: e.shiftKey });
  }

  const digit = /^Digit([0-9])$/.exec(e.code);
  if (digit) {
    return formatToken({ key: digit[1], shift: e.shiftKey });
  }

  // e.key for the space bar is a literal " ", which can't live in a
  // space-separated sequence string.
  return formatToken({ key: key === " " ? "space" : key, shift: false });
}

export function isAssignableToken(token: string): boolean {
  return validHotkeys.includes(parseToken(token).key);
}

const DISPLAY_ALIASES: Record<string, string> = {
  space: "Space",
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  arrowdown: "↓",
};

export function displayToken(token: string): string {
  const { key, shift } = parseToken(token);
  return `${shift ? "⇧" : ""}${DISPLAY_ALIASES[key] ?? key.toUpperCase()}`;
}

export function displaySequence(sequence: string): string {
  const tokens = sequence.split(" ").filter((token) => token.length > 0);
  return tokens.length > 0 ? tokens.map(displayToken).join(" → ") : "unset";
}
