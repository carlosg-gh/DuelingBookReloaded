import React, { useEffect, useRef, useState } from "react";
import { HotkeySection } from "./components/HotkeySection";
import {
  getDefaultRows,
  loadHotkeysConfig,
  saveHotkeysConfig,
  ContextHotkeyEntry,
} from "./utilities/configUtility";
import { serializeConfig, parseConfigImport } from "./utilities/configTransfer";
import { hotkeySections } from "./data/hotkeySections";

interface CustomizeHotkeysTypes {
  toggleSavedMessage: () => void;
}

interface TransferNotice {
  kind: "error" | "info";
  text: string;
}

const CustomizeHotkeys: React.FC<CustomizeHotkeysTypes> = ({
  toggleSavedMessage,
}) => {
  // Single copy of the config for every section, so cross-section badges
  // ("same key in…") update the moment any section saves.
  const [entries, setEntries] = useState<ContextHotkeyEntry[]>([]);
  const [transferNotice, setTransferNotice] = useState<TransferNotice | null>(
    null,
  );
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadHotkeysConfig().then(setEntries).catch(console.error);
  }, []);

  const resetDefaults = async () => {
    const defaults = getDefaultRows();
    await saveHotkeysConfig(defaults);
    setEntries(defaults);
    setTransferNotice(null);
    toggleSavedMessage();
  };

  const exportConfig = () => {
    const blob = new Blob([serializeConfig(entries)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "duelingbook-reloaded-hotkeys.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setTransferNotice(null);
  };

  const importConfig = async (file: File) => {
    try {
      const result = parseConfigImport(await file.text());
      if (!result.ok) {
        setTransferNotice({ kind: "error", text: result.error });
        return;
      }
      await saveHotkeysConfig(result.rows);
      setEntries(result.rows);
      toggleSavedMessage();
      setTransferNotice(
        result.dropped.length > 0
          ? {
              kind: "info",
              text: `Imported — ${result.dropped.length} binding(s) skipped (unknown or conflicting): ${result.dropped.join("; ")}`,
            }
          : null,
      );
    } catch (error) {
      console.error("Error importing hotkeys:", error);
      setTransferNotice({ kind: "error", text: "Could not read that file." });
    }
  };

  return (
    <div className="flex flex-col justify-center gap-2 mb-10">
      <h1 className="text-3xl font-bold">Customize Hotkeys</h1>
      {hotkeySections.map((section) => (
        <HotkeySection
          key={section.context}
          section={section}
          entries={entries}
          onEntriesChanged={setEntries}
          toggleSavedMessage={toggleSavedMessage}
        />
      ))}
      <hr />
      {transferNotice && (
        <p
          className={`text-sm font-bold text-center ${transferNotice.kind === "error" ? "text-red-500" : "text-amber-600"}`}
        >
          {transferNotice.text}
        </p>
      )}
      <div className="flex justify-center gap-4">
        <button
          onClick={resetDefaults}
          className="inline-block w-32 bg-blue-500 text-white text-sm cursor-pointer transition-transform duration-200 ease-in h-[40px] rounded px-3 py-2 hover:bg-blue-400"
        >
          Reset Defaults
        </button>
        <button
          onClick={exportConfig}
          className="inline-block w-32 bg-gray-500 text-white text-sm cursor-pointer transition-transform duration-200 ease-in h-[40px] rounded px-3 py-2 hover:bg-gray-400"
        >
          Export
        </button>
        <button
          onClick={() => importInputRef.current?.click()}
          className="inline-block w-32 bg-gray-500 text-white text-sm cursor-pointer transition-transform duration-200 ease-in h-[40px] rounded px-3 py-2 hover:bg-gray-400"
        >
          Import
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importConfig(file);
            // allow re-importing the same file
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
};

export default CustomizeHotkeys;
