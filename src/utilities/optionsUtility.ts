// "auto" enables touchscreen mode only when the device reports a coarse
// pointer (matchMedia("(pointer: coarse)")).
export type TouchMode = "on" | "off" | "auto";

export interface OptionsTypes {
  disableAllOptions: boolean;
  disableHotkeys: boolean;
  skipIntro: boolean;
  autoConnect: boolean;
  isNightMode: boolean;
  touchMode: TouchMode;
  /** The replay-page controls bar (speed/step/timeline). */
  replayControls: boolean;
}

const defaultOptions: OptionsTypes = {
  disableAllOptions: false,
  disableHotkeys: false,
  skipIntro: false,
  autoConnect: false,
  isNightMode: false,
  touchMode: "auto",
  replayControls: true,
};

export const getOptionsFromStorage = (
  callback: (options: OptionsTypes) => void,
) => {
  chrome.storage.sync.get(["options"], (result) => {
    // spread order backfills fields missing from configs stored by older
    // versions without clobbering what the user has set
    const options = { ...defaultOptions, ...(result.options || {}) };
    callback(options);
  });
};

export const saveOptionsToStorage = (options: OptionsTypes) => {
  chrome.storage.sync.set({ options }, () => {
    // notify content scripts that settings have changed
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          chrome.tabs.sendMessage(tab.id, {
            type: "SETTINGS_CHANGED",
            payload: options,
          });
        }
      }
    });
  });
};

export function skipIntro(skipIntroButton: HTMLElement) {
  if (skipIntroButton.style.display !== "none") {
    console.log("Intro is visible, skipping...");
    skipIntroButton.click();
  }
}

export function autoConnect(
  skipIntroButton: HTMLElement,
  enterButton: HTMLElement,
) {
  // Create a MutationObserver to wait for skipIntroButton to become hidden
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.attributeName === "style") {
        const newStyle = (mutation.target as HTMLElement).style.display;
        const oldStyle = mutation.oldValue;
        if (newStyle === "none" && oldStyle !== "none") {
          enterButton.click();
          // Disconnect the observer since we only need to trigger this once
          observer.disconnect();
          break;
        }
      }
    }
  });

  // Start observing the skipIntroButton
  observer.observe(skipIntroButton, {
    attributes: true,
    attributeOldValue: true,
  });
}
