import React, { useEffect, useState } from "react";
import {
  loadHotkeysConfig,
  saveHotkeysConfig,
  parseSequence,
} from "../utilities/configUtility";
import { findSequenceConflict } from "../utilities/hotkeyValidation";
import { splitActions } from "../utilities/actionsManipulations";
import { defaultDisabledActions } from "../data/hotkeySections";
import { HotkeyRecorder } from "./HotkeyRecorder";
import { displaySequence } from "../utilities/keyNormalization";

interface HotkeySectionProps {
  title: string;
  actions: string[];
  note: string | null;
  selectedHotkeys: { [key: string]: string };
  setSelectedHotkeys: React.Dispatch<
    React.SetStateAction<{ [key: string]: string }>
  >;
  resetCounter: number;
  toggleSavedMessage: () => void;
}

export const HotkeySection: React.FC<HotkeySectionProps> = ({
  title,
  actions,
  note,
  selectedHotkeys,
  setSelectedHotkeys,
  resetCounter,
  toggleSavedMessage,
}) => {
  const [isHotkeyInvalid, setIsHotkeyInvalid] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictState>({
    action: "",
    hotkey: "",
  });
  const [disabledActions, setDisabledActions] = useState<string[]>([]);

  type ConflictState = {
    action: string;
    hotkey: string;
  };

  useEffect(() => {
    async function initializeSelectedHotkeys() {
      try {
        const currentHotkeys = await loadHotkeysConfig();

        const initialSelectedHotkeys: { [key: string]: string } = {};
        actions.forEach((action) => {
          const hotkey = findHotkeyByAction(action, currentHotkeys);
          initialSelectedHotkeys[action] = hotkey;
        });

        // merge: every section shares this state, and they all load
        // concurrently — replacing would blank out the other sections
        setSelectedHotkeys((prev) => ({ ...prev, ...initialSelectedHotkeys }));

        const newDisabledActions = currentHotkeys
          .filter((hotkeyItem) => hotkeyItem.disabled)
          .map((hotkeyItem) => hotkeyItem.action as string);

        setDisabledActions(newDisabledActions);
      } catch (error) {
        console.error("Error loading hotkeys:", error);
      }
    }

    initializeSelectedHotkeys();
  }, [actions, resetCounter]);

  const toggleDisable = async (action: string) => {
    try {
      const currentHotkeys = await loadHotkeysConfig();

      const actionParts = splitActions(action);
      const actions = [];

      if (actionParts.length > 1) {
        actions.push(...actionParts);
      } else {
        actions.push(action);
      }

      for (const hotkeyItem of currentHotkeys) {
        if (actions.includes(hotkeyItem.action)) {
          hotkeyItem.disabled = !hotkeyItem.disabled;
        }
      }

      await saveHotkeysConfig(currentHotkeys);

      const newDisabledActions = currentHotkeys
        .filter((hotkeyItem) => hotkeyItem.disabled)
        .map((hotkeyItem) => hotkeyItem.action as string);

      setDisabledActions(newDisabledActions);
      toggleSavedMessage();
    } catch (error) {
      console.error("Error loading or updating hotkeys:", error);
    }
  };

  const handleHotkeyChange = async (action: string, hotkey: string) => {
    try {
      const currentHotkeys = await loadHotkeysConfig();
      const editedActions = splitActions(action);

      // Reject bindings the matcher couldn't distinguish: equal sequences or
      // one being a prefix of the other (compound rows edit their own group).
      const conflict = findSequenceConflict(
        parseSequence(hotkey),
        editedActions,
        currentHotkeys,
      );
      if (conflict) {
        setIsHotkeyInvalid(true);
        setConflictState({ action: conflict.action, hotkey: conflict.hotkey });
        return;
      }

      for (const hotkeyItem of currentHotkeys) {
        if (editedActions.includes(hotkeyItem.action)) {
          hotkeyItem.hotkey = hotkey;
        }
      }

      setSelectedHotkeys((prev) => ({ ...prev, [action]: hotkey }));
      await saveHotkeysConfig(currentHotkeys);
      toggleSavedMessage();
      setIsHotkeyInvalid(false);
      setConflictState({ action: "", hotkey: "" });
    } catch (error) {
      console.error("Error loading or updating hotkeys:", error);
    }
  };

  type HotkeyEntry = {
    action: string | string[];
    hotkey: string;
    disabled: boolean;
  };

  function checkIfDisabled(action: string) {
    const actionParts = splitActions(action);
    return actionParts.some((part) => disabledActions.includes(part));
  }

  function findHotkeyByAction(
    action: string,
    hotkeysConfig: HotkeyEntry[],
  ): string {
    for (const hotkeyItem of hotkeysConfig) {
      const actions = hotkeyItem.action;
      if (actions === action) {
        return hotkeyItem.hotkey;
      } else if (action.includes("/")) {
        const actionParts = splitActions(action);
        if (typeof actions === "string" && actionParts.includes(actions)) {
          return hotkeyItem.hotkey;
        } else if (
          Array.isArray(actions) &&
          actionParts.some((part) => actions.includes(part))
        ) {
          return hotkeyItem.hotkey;
        }
      }
    }
    return "";
  }

  return (
    <div className="container justify-center">
      <h1 className="text-2xl text-center font-bold bg-gray-200 rounded-lg mb-4">
        {title}
      </h1>
      <div className="flex flex-col gap-2">
        {isHotkeyInvalid && conflictState && (
          <h1 className="text-base font-bold text-red-500">
            Error! That binding overlaps with {conflictState.action} (
            {displaySequence(conflictState.hotkey)})! Pick another hotkey!
          </h1>
        )}
        {note && <h1 className="opacity-80">({note})</h1>}
        {actions.map((action, index) => {
          const isActionDisabled = checkIfDisabled(action);
          const containerClassName = `flex gap-4 items-center ${isActionDisabled ? "opacity-50" : ""}`;

          return (
            <>
              <div key={index} className={containerClassName}>
                <h2 className="inline">{action}</h2>
                <HotkeyRecorder
                  value={selectedHotkeys[action] || ""}
                  disabled={
                    isActionDisabled || defaultDisabledActions.includes(action)
                  }
                  onChange={(sequence) => handleHotkeyChange(action, sequence)}
                />
                {!defaultDisabledActions.includes(action) && (
                  <div className="flex items-center">
                    <label className="mx-2" htmlFor={`${action} checkbox`}>
                      Disable
                    </label>
                    <input
                      type="checkbox"
                      id={`${action} checkbox`}
                      onChange={() => toggleDisable(action)}
                      checked={checkIfDisabled(action)}
                    />
                  </div>
                )}
              </div>
            </>
          );
        })}
      </div>
    </div>
  );
};
