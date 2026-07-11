import { HotkeyEntry, parseSequence } from "./configUtility";

export type StepResult =
  | { type: "fire"; actions: string[] }
  | { type: "prefix" }
  | { type: "nomatch" };

interface TrieNode {
  actions: string[];
  children: Map<string, TrieNode>;
}

function makeNode(): TrieNode {
  return { actions: [], children: new Map() };
}

/**
 * Matches incoming keys against configured hotkey sequences.
 *
 * Bindings are tries built from the enabled hotkey entries; duplicate
 * sequences accumulate multiple actions on one node (context-dependent
 * card-menu actions intentionally share keys — playCard tries each in turn).
 *
 * The caller owns timing: on "prefix" it should arm a timeout and call
 * reset() when it expires.
 */
export class SequenceMatcher {
  private root: TrieNode = makeNode();
  private current: TrieNode = this.root;

  constructor(entries: HotkeyEntry[]) {
    for (const entry of entries) {
      if (entry.disabled) continue;
      const keys = parseSequence(entry.hotkey);
      if (keys.length === 0) continue;
      let node = this.root;
      for (const key of keys) {
        let child = node.children.get(key);
        if (!child) {
          child = makeNode();
          node.children.set(key, child);
        }
        node = child;
      }
      node.actions.push(entry.action);
    }
  }

  reset(): void {
    this.current = this.root;
  }

  /**
   * Advance the matcher with a key.
   * - "fire": a full sequence completed; matcher is reset.
   * - "prefix": the key starts/continues a longer sequence; wait for more.
   * - "nomatch": the key is not part of any binding; matcher is reset.
   * A key that dead-ends mid-sequence is retried from the root, so e.g.
   * "v" then "g" fires the standalone "g" binding if "v g" isn't bound.
   */
  step(key: string): StepResult {
    const next = this.current.children.get(key);
    if (!next) {
      if (this.current !== this.root) {
        this.reset();
        return this.step(key);
      }
      return { type: "nomatch" };
    }

    // The options UI forbids prefix conflicts, so a node is normally either
    // terminal or a prefix. If hand-edited storage contains both, fire
    // immediately for deterministic behavior.
    if (next.actions.length > 0) {
      this.reset();
      return { type: "fire", actions: [...next.actions] };
    }

    this.current = next;
    return { type: "prefix" };
  }
}
