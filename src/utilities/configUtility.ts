export interface HotkeyEntry {
  action: string;
  // A single key ("v") or a space-separated key sequence ("v e").
  hotkey: string;
  disabled: boolean;
}

export function parseSequence(hotkey: string): string[] {
  return hotkey.split(" ").filter((key) => key.length > 0);
}

export function formatSequence(keys: string[]): string {
  return keys.join(" ");
}

// Actions added in newer versions won't exist in configs stored by older
// installs; append their defaults so upgrades pick them up automatically.
function mergeWithDefaults(stored: HotkeyEntry[]): HotkeyEntry[] {
  const known = new Set(stored.map((entry) => entry.action));
  const missing = getDefaultHotkeys().filter(
    (entry) => !known.has(entry.action),
  );
  return missing.length > 0 ? [...stored, ...missing] : stored;
}

export async function loadHotkeysConfig(): Promise<HotkeyEntry[]> {
  return new Promise<HotkeyEntry[]>((resolve) => {
    chrome.storage.sync.get({ hotkeysConfig: [] }, (data) => {
      const hotkeys =
        data.hotkeysConfig.length > 0
          ? mergeWithDefaults(data.hotkeysConfig)
          : getDefaultHotkeys();
      resolve(hotkeys);
    });
  });
}

export async function saveHotkeysConfig(hotkeys: HotkeyEntry[]): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.sync.set({ hotkeysConfig: hotkeys }, () => {
      // notify content scripts that hotkeys have changed
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id !== undefined) {
            chrome.tabs.sendMessage(
              tab.id,
              {
                type: "HOTKEYS_CHANGED",
                payload: hotkeys,
              },
              () => {
                // only DuelingBook tabs have a receiver; reading lastError
                // swallows the "Receiving end does not exist" rejection
                // for every other tab
                void chrome.runtime.lastError;
              },
            );
          }
        }
      });
      resolve();
    });
  });
}

// don't forget to update the actionsFunctionMap in content_script.tsx
// each object needs a prop called disable, auto set to false
export function getDefaultHotkeys(): HotkeyEntry[] {
  return [
    { action: "Close View Menu", hotkey: "escape", disabled: false },
    { action: "View Graveyard", hotkey: "g", disabled: false },
    { action: "View Banish", hotkey: ",", disabled: false },
    { action: "View Main Deck", hotkey: "v", disabled: false },
    { action: "Banish T.", hotkey: "m", disabled: false },
    { action: "View Extra Deck", hotkey: "e", disabled: false },
    { action: "Think", hotkey: "t", disabled: false },
    { action: "Thumbs Up", hotkey: "f", disabled: false },
    { action: "Toggle Chat Box", hotkey: "enter", disabled: false },
    { action: "Declare", hotkey: "d", disabled: false },
    { action: "To Hand", hotkey: "h", disabled: false },
    { action: "To Extra Deck", hotkey: "h", disabled: false },
    { action: "To Extra Deck FU", hotkey: "u", disabled: false },
    { action: "Activate", hotkey: "a", disabled: false },
    { action: "To S/T", hotkey: "a", disabled: false },
    { action: "Overlay", hotkey: "o", disabled: false },
    { action: "S. Summon ATK", hotkey: "s", disabled: false },
    { action: "SS ATK", hotkey: "s", disabled: false },
    { action: "OL ATK", hotkey: "i", disabled: false },
    { action: "S. Summon DEF", hotkey: "x", disabled: false },
    { action: "SS DEF", hotkey: "x", disabled: false },
    { action: "OL DEF", hotkey: "p", disabled: false },
    { action: "Normal Summon", hotkey: "n", disabled: false },
    { action: "Set", hotkey: "j", disabled: false },
    { action: "Detach", hotkey: "q", disabled: false },
    { action: "To Graveyard", hotkey: "q", disabled: false },
    { action: "To Grave", hotkey: "q", disabled: false },
    { action: "Banish", hotkey: "w", disabled: false },
    { action: "Banish FD", hotkey: "b", disabled: false },
    { action: "To Bottom of Deck", hotkey: "z", disabled: false },
    { action: "To B. Deck", hotkey: "z", disabled: false },
    { action: "Mill 1", hotkey: "1", disabled: false },
    { action: "Mill 2", hotkey: "2", disabled: false },
    { action: "Mill 3", hotkey: "3", disabled: false },
    { action: "Mill 4", hotkey: "4", disabled: false },
    { action: "Mill 5", hotkey: "5", disabled: false },
    { action: "Mill 6", hotkey: "6", disabled: false },
    { action: "Sub LP", hotkey: "-", disabled: false },
    { action: "Add LP", hotkey: "+", disabled: false },
    { action: "Target", hotkey: "r", disabled: false },
    { action: "Show Hotkey Hints", hotkey: "f1", disabled: false },
  ];
}
