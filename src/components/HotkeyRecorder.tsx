import React, { useEffect, useState } from "react";
import { validHotkeys } from "../data/validHotkeys";
import { parseSequence, formatSequence } from "../utilities/configUtility";

interface HotkeyRecorderProps {
  // stored binding: a single key ("v") or space-separated sequence ("v e")
  value: string;
  disabled: boolean;
  onChange: (sequence: string) => void;
}

const MAX_SEQUENCE_LENGTH = 3;

export function displaySequence(sequence: string): string {
  const keys = parseSequence(sequence);
  return keys.length > 0
    ? keys.map((key) => key.toUpperCase()).join(" → ")
    : "unset";
}

/**
 * Press-to-record binding editor. Click Record, type up to three keys
 * (filtered against the assignable-key whitelist), then confirm with the
 * Done button. Confirmation is a button rather than a key because Enter and
 * Escape are themselves assignable.
 */
export const HotkeyRecorder: React.FC<HotkeyRecorderProps> = ({
  value,
  disabled,
  onChange,
}) => {
  const [recording, setRecording] = useState(false);
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!recording) return;
    const capture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const key = e.key.toLowerCase();
      if (!validHotkeys.includes(key)) return;
      setKeys((prev) =>
        prev.length >= MAX_SEQUENCE_LENGTH ? prev : [...prev, key],
      );
    };
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [recording]);

  const startRecording = () => {
    setKeys([]);
    setRecording(true);
  };

  const cancel = () => {
    setRecording(false);
    setKeys([]);
  };

  const confirm = () => {
    setRecording(false);
    if (keys.length > 0) onChange(formatSequence(keys));
    setKeys([]);
  };

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <span className="border border-blue-500 rounded-md px-2 min-w-[5rem] text-center text-blue-600 animate-pulse">
          {keys.length > 0
            ? displaySequence(formatSequence(keys))
            : "press keys…"}
        </span>
        <button
          onClick={confirm}
          disabled={keys.length === 0}
          className="bg-blue-500 text-white text-sm rounded px-2 py-0.5 hover:bg-blue-400 disabled:opacity-50"
        >
          Done
        </button>
        <button
          onClick={cancel}
          className="bg-gray-300 text-gray-700 text-sm rounded px-2 py-0.5 hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="border rounded-md px-2 min-w-[5rem] text-center text-gray-600">
        {displaySequence(value)}
      </span>
      <button
        onClick={startRecording}
        disabled={disabled}
        className="bg-gray-500 text-white text-sm rounded px-2 py-0.5 hover:bg-gray-400 disabled:opacity-50"
      >
        Record
      </button>
    </div>
  );
};
