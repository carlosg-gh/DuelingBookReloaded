import React, { useEffect, useRef, useState } from "react";
import {
  loadHotkeysConfig,
  saveHotkeysConfig,
  parseSequence,
  ContextHotkeyEntry,
} from "../utilities/configUtility";
import {
  findConflicts,
  hardConflicts,
  SequenceConflict,
} from "../utilities/hotkeyValidation";
import {
  catalogIndex,
  getCatalogEntry,
  GROUP_LABELS,
  ContextGroup,
} from "../data/actionCatalog";
import { HotkeySectionData } from "../data/hotkeySections";
import { HotkeyRecorder } from "./HotkeyRecorder";
import { displaySequence } from "../utilities/keyNormalization";

interface HotkeySectionProps {
  section: HotkeySectionData;
  /** The full config, owned by CustomizeHotkeys and shared by all sections. */
  entries: ContextHotkeyEntry[];
  onEntriesChanged: (entries: ContextHotkeyEntry[]) => void;
  toggleSavedMessage: () => void;
}

interface RowMessage {
  kind: "error" | "warning";
  text: string;
}

// action name | recorder | disable toggle — shared template so every row
// in every section lines up.
const ROW_GRID = "grid grid-cols-[14rem_22rem_auto] items-center gap-4";

function isLocked(action: string): boolean {
  return getCatalogEntry(action)?.locked === true;
}

function describeHardConflict(
  context: ContextGroup,
  conflict: SequenceConflict,
): string {
  const other = `${conflict.action} (${displaySequence(conflict.hotkey)})`;
  if (conflict.context === "global" && context !== "global") {
    return `Error! ${other} works anywhere, so this group can't reuse its key. Rebind one of them first!`;
  }
  if (context === "global" && conflict.context !== "global") {
    return `Error! ${other} uses that key in ${GROUP_LABELS[conflict.context]} — an anywhere-key can't reuse it. Rebind one of them first!`;
  }
  return `Error! That binding overlaps with ${other} — one sequence is a prefix of the other. Rebind one of them first!`;
}

function describeWarnings(
  action: string,
  warnings: SequenceConflict[],
): string {
  const parts = warnings.map((warning) => {
    const winner =
      catalogIndex(action) < catalogIndex(warning.action)
        ? action
        : warning.action;
    return `${warning.action} shares this key; when a menu offers both, ${winner} acts`;
  });
  return `Saved — ${parts.join("; ")}.`;
}

export const HotkeySection: React.FC<HotkeySectionProps> = ({
  section,
  entries,
  onEntriesChanged,
  toggleSavedMessage,
}) => {
  const { context } = section;
  // Messages from edits in this section. A save from ANOTHER section
  // invalidates them (they describe an outdated config); our own save
  // must not wipe the warning it just produced, hence the skip flag.
  const [rowMessages, setRowMessages] = useState<{
    [action: string]: RowMessage | undefined;
  }>({});
  const skipNextClear = useRef(false);

  useEffect(() => {
    if (skipNextClear.current) {
      skipNextClear.current = false;
      return;
    }
    setRowMessages({});
  }, [entries]);

  const setRowMessage = (action: string, message: RowMessage | undefined) => {
    setRowMessages((prev) => ({ ...prev, [action]: message }));
  };

  const entryFor = (action: string) =>
    entries.find((row) => row.context === context && row.action === action);

  const toggleDisable = async (action: string) => {
    try {
      const currentRows = await loadHotkeysConfig();
      const target = currentRows.find(
        (row) => row.context === context && row.action === action,
      );
      if (!target) return;

      // Re-enabling brings the binding back into play: reject it if the
      // key was hard-reassigned in this group while the row was disabled.
      // Disabling is always fine.
      let warnings: SequenceConflict[] = [];
      if (target.disabled && target.hotkey.length > 0) {
        const conflicts = findConflicts(
          parseSequence(target.hotkey),
          context,
          action,
          currentRows,
        );
        const hard = hardConflicts(conflicts);
        if (hard.length > 0) {
          setRowMessage(action, {
            kind: "error",
            text: describeHardConflict(context, hard[0]),
          });
          return;
        }
        warnings = conflicts;
      }

      target.disabled = !target.disabled;
      await saveHotkeysConfig(currentRows);
      skipNextClear.current = true;
      onEntriesChanged(currentRows);
      toggleSavedMessage();
      setRowMessage(
        action,
        warnings.length > 0
          ? { kind: "warning", text: describeWarnings(action, warnings) }
          : undefined,
      );
    } catch (error) {
      console.error("Error loading or updating hotkeys:", error);
    }
  };

  const handleHotkeyChange = async (action: string, hotkey: string) => {
    try {
      const currentRows = await loadHotkeysConfig();

      const conflicts = findConflicts(
        parseSequence(hotkey),
        context,
        action,
        currentRows,
      );
      const hard = hardConflicts(conflicts);
      if (hard.length > 0) {
        setRowMessage(action, {
          kind: "error",
          text: describeHardConflict(context, hard[0]),
        });
        return;
      }

      for (const row of currentRows) {
        if (row.context === context && row.action === action) {
          row.hotkey = hotkey;
        }
      }

      await saveHotkeysConfig(currentRows);
      skipNextClear.current = true;
      onEntriesChanged(currentRows);
      toggleSavedMessage();
      setRowMessage(
        action,
        conflicts.length > 0
          ? { kind: "warning", text: describeWarnings(action, conflicts) }
          : undefined,
      );
    } catch (error) {
      console.error("Error loading or updating hotkeys:", error);
    }
  };

  let lastSubhead: string | undefined;

  return (
    <div className="container">
      <h1 className="text-2xl text-center font-bold bg-gray-200 rounded-lg mb-4">
        {section.title}
      </h1>
      <div className="flex flex-col gap-2">
        {section.note && <h1 className="opacity-80">({section.note})</h1>}
        {section.rows.map(({ action, subhead }) => {
          const entry = entryFor(action);
          const isActionDisabled = entry?.disabled === true;
          const locked = isLocked(action);
          const message = rowMessages[action];
          const showSubhead = subhead !== undefined && subhead !== lastSubhead;
          lastSubhead = subhead;

          return (
            <div key={`${context}:${action}`}>
              {showSubhead && (
                <h2 className="text-lg font-semibold mt-2">{subhead}</h2>
              )}
              <div
                className={`${ROW_GRID} ${isActionDisabled ? "opacity-50" : ""}`}
              >
                <h2 className="truncate" title={action}>
                  {action}
                </h2>
                <HotkeyRecorder
                  value={entry?.hotkey ?? ""}
                  disabled={isActionDisabled || locked}
                  onChange={(sequence) => handleHotkeyChange(action, sequence)}
                />
                {!locked ? (
                  <div className="flex items-center">
                    <label
                      className="mx-2"
                      htmlFor={`${context} ${action} checkbox`}
                    >
                      Disable
                    </label>
                    <input
                      type="checkbox"
                      id={`${context} ${action} checkbox`}
                      onChange={() => toggleDisable(action)}
                      checked={isActionDisabled}
                    />
                  </div>
                ) : (
                  <span />
                )}
              </div>
              {message && (
                <p
                  className={`text-sm font-bold ${message.kind === "error" ? "text-red-500" : "text-amber-600"}`}
                >
                  {message.text}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
