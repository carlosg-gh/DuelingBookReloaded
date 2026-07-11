import { OptionsTypes } from "./utilities/optionsUtility";
import {
  injectStylesheet,
  applyDarkMode,
  removeDarkMode,
} from "./utilities/darkModeUtility";
import { autoConnect, skipIntro } from "./utilities/optionsUtility";
import { loadHotkeysConfig, HotkeyEntry } from "./utilities/configUtility";
import { SequenceMatcher } from "./utilities/sequenceMatcher";

let view: HTMLElement | null;
let closeViewButton: HTMLElement | null;
let deck: HTMLElement | null;
let extraDeck: HTMLElement | null;
let deckMenu: HTMLElement | null;
let deckViewButton: HTMLElement | null;
let deckViewSpan: HTMLElement | null;
let deckBanishButton: HTMLElement | null;
let deckBanishSpan: HTMLElement | null;
let LPInput: HTMLElement | null;
let subButton: HTMLElement | null;
let addButton: HTMLElement | null;
let chatOption: HTMLElement | null;

function closeViewMenu() {
  closeViewButton?.click();
}

function handleDeckView(deckType: string) {
  const mouseOverEvent = new MouseEvent("mouseover", {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  if (deckType === "Main") {
    deck?.dispatchEvent(mouseOverEvent);
  } else if (deckType === "Extra") {
    extraDeck?.dispatchEvent(mouseOverEvent);
  }

  deckMenu = document.getElementById("card_menu_content") as HTMLElement;
  deckViewButton = deckMenu?.getElementsByClassName(
    "card_menu_btn",
  )[0] as HTMLElement;
  deckViewSpan = deckViewButton?.getElementsByTagName("span")[0] as HTMLElement;

  if (deckViewSpan && deckViewSpan.textContent === "View") {
    deckViewSpan.click();
  } else if (deckViewSpan && deckViewSpan.textContent === "Show") {
    deckViewButton = deckMenu?.getElementsByClassName(
      "card_menu_btn",
    )[1] as HTMLElement;
    deckViewSpan = deckViewButton?.getElementsByTagName(
      "span",
    )[0] as HTMLElement;
    deckViewSpan.click();
  } else {
    closeViewMenu();
  }
}

function handleDeckOptions(deckType: string, action: string) {
  const mouseOverEvent = new MouseEvent("mouseover", {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  if (deckType === "Main") {
    deck?.dispatchEvent(mouseOverEvent);
  }

  deckMenu = document.getElementById("card_menu_content") as HTMLElement;

  if (action === "banish") {
    deckBanishButton = deckMenu?.getElementsByClassName(
      "card_menu_btn",
    )[2] as HTMLElement;
    deckBanishSpan = deckBanishButton?.getElementsByTagName(
      "span",
    )[0] as HTMLElement;
    console.log("banish button", deckBanishButton);
    console.log("banish span", deckBanishSpan);
    deckBanishSpan.click();
  }
}

window.onload = async function () {
  view = document.getElementById("view") as HTMLElement;
  closeViewButton = view?.getElementsByClassName("exit_btn")[0] as HTMLElement;
  deck = document.getElementById("deck_hidden") as HTMLElement;
  extraDeck = document.getElementById("extra_hidden") as HTMLElement;
  deckMenu = document.getElementById("card_menu_content") as HTMLElement;
  deckViewButton = deckMenu?.getElementsByClassName(
    "card_menu_btn",
  )[0] as HTMLElement;
  deckViewSpan = deckViewButton?.getElementsByTagName("span")[0] as HTMLElement;
  LPInput = document.getElementById("life_txt") as HTMLElement;
  subButton = document.getElementById("plus_btn") as HTMLElement;
  addButton = document.getElementById("minus_btn") as HTMLElement;

  let options: OptionsTypes;

  const actionFunctionMap: Record<string, () => void> = {
    "Close View Menu": closeViewMenu,
    "View Graveyard": toggleGraveYardView,
    "View Banish": toggleBanishedView,
    "View Main Deck": () => handleDeckView("Main"),
    "View Extra Deck": () => handleDeckView("Extra"),
    Think: handleThinkButton,
    "Thumbs Up": thumbsUpPress,
    "Toggle Chat Box": handleChatBox,
    Declare: () => playCard("Declare"),
    "To Hand": () => playCard("To Hand"),
    "To Extra Deck": () => playCard("To Extra Deck"),
    "To Extra Deck FU": () => playCard("To Extra Deck FU"),
    "To S/T": () => playCard("To S/T"),
    Activate: () => playCard("Activate"),
    Overlay: () => playCard("Overlay"),
    "S. Summon ATK": () => playCard("S. Summon ATK"),
    "SS ATK": () => playCard("SS ATK"),
    "OL ATK": () => playCard("OL ATK"),
    "S. Summon DEF": () => playCard("S. Summon DEF"),
    "SS DEF": () => playCard("SS DEF"),
    "OL DEF": () => playCard("OL DEF"),
    "Normal Summon": () => playCard("Normal Summon"),
    Set: () => playCard("Set"),
    Detach: () => playCard("Detach"),
    "To Graveyard": () => playCard("To Graveyard"),
    "To Grave": () => playCard("To Grave"),
    Banish: () => playCard("Banish"),
    "Banish T.": () => handleDeckOptions("Main", "banish"),
    "Banish FD": () => playCard("Banish FD"),
    "To B. Deck": () => playCard("To B. Deck"),
    "To Bottom of Deck": () => playCard("To Bottom of Deck"),
    "Mill 1": () => saySomething("/mill 1"),
    "Mill 2": () => saySomething("/mill 2"),
    "Mill 3": () => saySomething("/mill 3"),
    "Mill 4": () => saySomething("/mill 4"),
    "Mill 5": () => saySomething("/mill 5"),
    "Mill 6": () => saySomething("/mill 6"),
    "Sub LP": () => subLP(),
    "Add LP": () => addLP(),
    Target: () => playCard("Target"),
  };

  let hotkeyHashMap: HotkeyEntry[] = [];
  let matcher = new SequenceMatcher([]);
  let sequenceTimer: number | undefined;

  function setHotkeys(entries: HotkeyEntry[]) {
    hotkeyHashMap = entries;
    matcher = new SequenceMatcher(entries);
    window.clearTimeout(sequenceTimer);
  }

  setHotkeys(await loadHotkeysConfig());

  async function fetchHotKeyHashMap() {
    setHotkeys(await loadHotkeysConfig());
    console.log("Loaded hotkeys configuration:", hotkeyHashMap);
  }

  injectStylesheet("dark-mode.css");

  chrome.storage.sync.get("options", (result) => {
    options = result.options as OptionsTypes;
    if (options && options.disableAllOptions) {
      // set all options to false, ensure dark mode is off, and don't run other functions
      options.disableHotkeys = true;
      options.skipIntro = false;
      options.autoConnect = false;
      options.isNightMode = false;
      removeDarkMode();
      setHotkeys([]);
    } else {
      if (options.disableHotkeys) {
        setHotkeys([]);
      } else {
        fetchHotKeyHashMap();
      }
      if (options && options.skipIntro && options.autoConnect)
        autoConnect(skipIntroButton, enterButton);
      if (options && options.skipIntro) skipIntro(skipIntroButton);
      if (options && options.autoConnect)
        autoConnect(skipIntroButton, enterButton);
      if (options && options.isNightMode) applyDarkMode();
      if (options && !options.isNightMode) removeDarkMode();
    }
    chrome.storage.onChanged.addListener(handleOptionsChange);
  });

  function handleOptionsChange(
    changes: { [key: string]: any },
    namespace: string,
  ) {
    if (namespace === "sync") {
      if (changes.options && "newValue" in changes.options) {
        const newOptions = changes.options.newValue as OptionsTypes;
        console.log("Options have changed:", newOptions);

        if (newOptions.disableAllOptions) {
          // set all options to false, ensure dark mode is off, and don't run other functions
          newOptions.skipIntro = false;
          newOptions.autoConnect = false;
          newOptions.isNightMode = false;
          removeDarkMode();
          setHotkeys([]);
        } else {
          if (newOptions.disableHotkeys) {
            setHotkeys([]);
          } else {
            fetchHotKeyHashMap();
          }
          if (newOptions.skipIntro && newOptions.autoConnect)
            autoConnect(skipIntroButton, enterButton);
          if (newOptions.skipIntro) skipIntro(skipIntroButton);
          if (newOptions.autoConnect) autoConnect(skipIntroButton, enterButton);
          if (newOptions.isNightMode) applyDarkMode();
          if (!newOptions.isNightMode) removeDarkMode();
        }
      }
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "HOTKEYS_CHANGED") {
      console.log("Received updated hotkeys:", message.payload);
      setHotkeys(message.payload);
      return true;
    }
  });

  chrome.storage.onChanged.addListener(handleOptionsChange);

  const chatInput = document.querySelectorAll(
    "input.cin_txt",
  )[1] as HTMLInputElement;
  // True only while the user deliberately types in a text field (opened chat,
  // clicked an input, adjusting LP). DuelingBook auto-focusing the chat input
  // on a stray keypress does NOT set this.
  let typingIntent = false;
  const thunk = document.getElementById("think_btn");
  const thumbsUp = document.getElementById("good_btn");
  const graveyard = document.getElementById("grave_hidden");
  const banished = document.getElementById("banished_hidden");
  const skipIntroButton = document.getElementById(
    "skip_intro_btn",
  ) as HTMLElement;
  const enterButton = document.getElementById("duel_btn") as HTMLElement;

  function saySomething(message: string) {
    chatInput.value = message;
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
    });

    chatInput.focus();
    typingIntent = true;
    setTimeout(() => {
      chatInput.dispatchEvent(enterEvent);
      chatInput.blur();
      typingIntent = false;
    }, 10);
  }

  function subLP() {
    if (subButton) subButton.click();
    typingIntent = true;
  }

  function addLP() {
    if (addButton) addButton.click();
    typingIntent = true;
  }

  function toggleGraveYardView() {
    if (view && view.style.display === "block") {
      closeViewMenu();
    } else {
      graveyard?.click();
    }
  }

  function toggleBanishedView() {
    if (view && view.style.display === "block") {
      closeViewMenu();
    } else {
      banished?.click();
    }
  }

  function handleThinkButton() {
    thunk?.click();
  }

  function thumbsUpPress() {
    thumbsUp?.click();
    const mouseDownEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window,
    });

    thumbsUp?.dispatchEvent(mouseDownEvent);
  }

  function thumbsUpRelease() {
    const mouseUpEvent = new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      view: window,
    });

    thumbsUp?.dispatchEvent(mouseUpEvent);
  }

  function handleChatBox() {
    const active = document.activeElement;
    if (typingIntent || active === chatInput || active === LPInput) {
      if (active instanceof HTMLElement) active.blur();
      typingIntent = false;
    } else {
      chatInput.focus();
      typingIntent = true;
    }
  }

  function playCard(action: string | [string] | [string, string]) {
    const cardHoverMenuDiv = document.getElementById(
      "card_menu_content",
    ) as HTMLElement;
    const cardHoverMenuActions = cardHoverMenuDiv?.getElementsByClassName(
      "card_menu_btn",
    ) as HTMLCollectionOf<HTMLElement>;

    const actions = Array.isArray(action) ? action : [action];
    console.log(action);
    for (const act of actions) {
      console.log(act);
      console.log(actions);
      for (const element of cardHoverMenuActions) {
        const span = element?.getElementsByTagName("span")[0];
        if (span && span.textContent === action) {
          span.click();
          return;
        }
      }
    }
  }

  // max pause between the keys of a sequence before it resets
  const SEQUENCE_TIMEOUT_MS = 800;

  function isTextField(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    );
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!e.isTrusted || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();

    if (typingIntent) {
      // The user is deliberately typing (chat message, LP amount): never
      // intercept. Enter sends / Escape cancels — both end typing mode, but
      // only after the page has processed the key against the input.
      if (key === "enter" || key === "escape") {
        typingIntent = false;
        setTimeout(() => {
          const active = document.activeElement;
          if (isTextField(active)) (active as HTMLElement).blur();
        }, 0);
      }
      return;
    }

    const result = matcher.step(key);
    window.clearTimeout(sequenceTimer);

    if (result.type === "nomatch") {
      // Unbound key: let DuelingBook have it. If the page responds by
      // focusing the chat input (its type-to-chat feature), the user is now
      // typing a message — stop treating keys as hotkeys.
      setTimeout(() => {
        if (document.activeElement === chatInput) typingIntent = true;
      }, 0);
      return;
    }

    // The key matches (or starts) a binding: swallow it before the page's
    // own handler can steal focus into the chat input.
    e.preventDefault();
    e.stopImmediatePropagation();
    const active = document.activeElement;
    if (isTextField(active)) (active as HTMLElement).blur();

    if (result.type === "prefix") {
      sequenceTimer = window.setTimeout(
        () => matcher.reset(),
        SEQUENCE_TIMEOUT_MS,
      );
      return;
    }

    for (const action of result.actions) {
      if (action in actionFunctionMap) {
        actionFunctionMap[action]();
      } else {
        console.log("Action function not found for:", action);
      }
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (!e.isTrusted || typingIntent) return;
    const key = e.key.toLowerCase();
    const isThumbsUpKey = hotkeyHashMap.some(
      (entry) =>
        !entry.disabled && entry.action === "Thumbs Up" && entry.hotkey === key,
    );
    if (isThumbsUpKey) thumbsUpRelease();
  }

  // Capture phase on window so these run before DuelingBook's own handlers
  // (which auto-focus the chat input on any keypress).
  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("keyup", handleKeyUp, true);

  // Clicking into a text field (chat, LP box, search) is deliberate typing.
  window.addEventListener(
    "mousedown",
    (e) => {
      if (isTextField(e.target)) typingIntent = true;
    },
    true,
  );

  // Leaving a text field by any means ends typing mode.
  window.addEventListener(
    "focusout",
    (e) => {
      if (isTextField(e.target)) typingIntent = false;
    },
    true,
  );
};
