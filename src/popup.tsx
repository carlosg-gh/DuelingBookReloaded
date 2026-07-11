import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import Button from "./components/Button";
import logo from "./assets/images/dbe_logo.png";
import { HiOutlineCog8Tooth } from "react-icons/hi2";
import {
  getOptionsFromStorage,
  saveOptionsToStorage,
  OptionsTypes,
  TouchMode,
} from "./utilities/optionsUtility";

type InputItem =
  | {
      type: "checkbox";
      id: string;
      label: string;
      checked: boolean;
      onChange: () => void;
    }
  | {
      type: "select";
      id: string;
      label: string;
      value: string;
      choices: { value: string; label: string }[];
      onSelect: (value: string) => void;
    };

const touchModeChoices = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
  { value: "auto", label: "Auto (touch device)" },
];

const Popup = () => {
  const [options, setOptions] = useState<OptionsTypes>({
    disableAllOptions: false,
    disableHotkeys: false,
    skipIntro: false,
    autoConnect: false,
    isNightMode: false,
    touchMode: "auto",
  });

  // Load options from storage when the popup is opened
  useEffect(() => {
    getOptionsFromStorage((savedOptions) => {
      setOptions(savedOptions);
      console.log("inside getoptionsfromstorage");
    });
  }, []);

  // Use useEffect to save options whenever they change
  useEffect(() => {
    if (options) {
      saveOptionsToStorage(options);
      console.log("latest options", options);
    }
  }, [options]);

  const handleSettingsButtonClick = () => {
    chrome.runtime.openOptionsPage();
  };

  const inputItems: InputItem[] = [
    {
      type: "checkbox",
      id: "allOptions",
      label: "Disable All Options",
      checked: options.disableAllOptions,
      onChange: () =>
        setOptions({
          ...options,
          disableAllOptions: !options.disableAllOptions,
        }),
    },
    {
      type: "checkbox",
      id: "disableHotkeys",
      label: "Disable Hotkeys",
      checked: options.disableHotkeys,
      onChange: () =>
        setOptions({ ...options, disableHotkeys: !options.disableHotkeys }),
    },
    {
      type: "checkbox",
      id: "skipIntro",
      label: "Skip Intro",
      checked: options.skipIntro,
      onChange: () => setOptions({ ...options, skipIntro: !options.skipIntro }),
    },
    {
      type: "checkbox",
      id: "autoConnect",
      label: "Auto-Connect (must be logged in!)",
      checked: options.autoConnect,
      onChange: () =>
        setOptions({ ...options, autoConnect: !options.autoConnect }),
    },
    {
      type: "checkbox",
      id: "nightMode",
      label: "Night Mode",
      checked: options.isNightMode,
      onChange: () =>
        setOptions({ ...options, isNightMode: !options.isNightMode }),
    },
    {
      type: "select",
      id: "touchMode",
      label: "Touchscreen Mode",
      value: options.touchMode,
      choices: touchModeChoices,
      onSelect: (value) =>
        setOptions({ ...options, touchMode: value as TouchMode }),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center gap-6">
        <div className="flex items-center">
          <div className="w-12">
            <img src={logo} alt="DBR Logo" />
          </div>
          <h2 className="font-normal text-xl">
            DuelingBook<span className="font-bold">Reloaded</span>
          </h2>
        </div>
        <button
          id="settings-button"
          className="group bg-transparent border-none cursor-pointer hover:bg-transparent hover:shadow-none p-0 flex justify-center items-center min-w-0"
          onClick={handleSettingsButtonClick}
        >
          <HiOutlineCog8Tooth className="w-9 h-9 group-hover:text-blue-400" />
        </button>
      </div>
      <div id="input_container" className="p-5 flex flex-col gap-4">
        {inputItems.map((item, index) => (
          <div
            className={`flex items-center ${options.disableAllOptions && index > 0 ? "opacity-50" : ""}`}
            key={item.id}
          >
            {item.type === "checkbox" ? (
              <input
                id={item.id}
                type="checkbox"
                className={`w-4 h-4 border-2 border-blue-500 rounded-4 bg-transparent outline-none transition duration-300 ease-in text-white ${index > 0 && options.disableAllOptions ? "" : "cursor-pointer"}`}
                checked={item.checked}
                onChange={item.onChange}
                disabled={index > 0 && options.disableAllOptions}
              />
            ) : (
              <select
                id={item.id}
                className={`border-2 border-blue-500 rounded bg-transparent outline-none ${index > 0 && options.disableAllOptions ? "" : "cursor-pointer"}`}
                value={item.value}
                onChange={(e) => item.onSelect(e.target.value)}
                disabled={index > 0 && options.disableAllOptions}
              >
                {item.choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            )}
            <label
              className={`ml-5 ${index > 0 && options.disableAllOptions ? "" : "cursor-pointer"}`}
              htmlFor={item.id}
            >
              {item.label}
            </label>
          </div>
        ))}
        <div id="button-container" className="flex justify-around w-full">
          <Button
            buttonText="Bugs & Feedback"
            buttonUrl="https://github.com/carlosg-gh/DuelingBookReloaded/issues"
          />
          <Button
            buttonText={"Open DB"}
            buttonUrl="http://www.DuelingBook.com/html5"
          />
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
