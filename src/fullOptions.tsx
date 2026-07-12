import React, { useEffect, useState, useRef } from "react";
import Button from "./components/Button";
import logo from "./assets/images/dbe_logo.png";
import {
  getOptionsFromStorage,
  saveOptionsToStorage,
  OptionsTypes,
  TouchMode,
} from "./utilities/optionsUtility";
import ReactDOM from "react-dom";
import CustomizeHotkeys from "./CustomizeHotkeys";
import KnownIssues from "./KnownIssues";
import Attribution from "./components/Attribution";
import GithubCorner from "./components/GithubCorner";

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

export const Options = () => {
  const [currentSection, setCurrentSection] = useState("General");
  const [isSavedVisible, setIsSavedVisible] = useState(false);
  const [options, setOptions] = useState<OptionsTypes>({
    disableAllOptions: false,
    disableHotkeys: false,
    skipIntro: false,
    autoConnect: false,
    isNightMode: false,
    touchMode: "auto",
  });

  // load options from storage when the popup is opened
  useEffect(() => {
    getOptionsFromStorage((savedOptions) => {
      setOptions(savedOptions);
    });
  }, []);

  // save options whenever they change
  useEffect(() => {
    saveOptionsToStorage(options);
  }, [options]);

  const settingsSavedMessageTimer = useRef<NodeJS.Timeout | null>(null);

  const toggleSavedMessage = () => {
    setIsSavedVisible(false);
    if (settingsSavedMessageTimer.current)
      clearTimeout(settingsSavedMessageTimer.current);

    settingsSavedMessageTimer.current = setTimeout(() => {
      setIsSavedVisible(true);
    }, 1);
  };

  const renderMainContent = () => {
    switch (currentSection) {
      case "General":
        return (
          <>
            <h1 className="text-3xl font-bold">General</h1>
            <p className="text-gray-600 mt-2">
              Determine how DuelingBookReloaded can improve your experience
            </p>
            <hr className="border-gray-300 mb-4" />
            <div className="flex flex-col gap-4">
              {inputItems.map((item, index) => (
                <div
                  className={`flex items-center ${options.disableAllOptions && index > 0 ? "opacity-50" : ""}`}
                  key={item.id}
                >
                  {item.type === "checkbox" ? (
                    <input
                      id={item.id}
                      type="checkbox"
                      className={`mr-2 ${index > 0 && options.disableAllOptions ? "" : "cursor-pointer"}`}
                      checked={item.checked}
                      onChange={() => {
                        item.onChange();
                        toggleSavedMessage();
                      }}
                      disabled={index > 0 && options.disableAllOptions}
                    />
                  ) : (
                    <select
                      id={item.id}
                      className={`mr-2 border rounded ${index > 0 && options.disableAllOptions ? "" : "cursor-pointer"}`}
                      value={item.value}
                      onChange={(e) => {
                        item.onSelect(e.target.value);
                        toggleSavedMessage();
                      }}
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
                    className={`flex items-center w-max ${index > 0 && options.disableAllOptions ? "" : "cursor-pointer"}`}
                    htmlFor={item.id}
                  >
                    {item.label}
                  </label>
                </div>
              ))}
            </div>
            <hr className="border-gray-300 my-4" />
            <div className="flex justify-evenly items-center">
              <div className="flex items-center">
                <span className="mr-2">
                  Noticed a bug or want to request a feature? Open an issue!
                </span>
                <Button
                  buttonText="Bugs & Feedback"
                  buttonUrl="https://github.com/carlosg-gh/DuelingBookReloaded/issues"
                />
              </div>
              <div className="flex items-center">
                <span className="mr-2">Ready to play? It's time to duel!</span>
                <Button
                  buttonText="Open DB"
                  buttonUrl="http://www.DuelingBook.com/html5"
                />
              </div>
            </div>
          </>
        );
      case "Customize Hotkeys":
        return <CustomizeHotkeys toggleSavedMessage={toggleSavedMessage} />;
      case "Help":
        return <KnownIssues />;
      default:
        return null;
    }
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
    <div className="container mx-auto flex items-stretch h-auto p-4">
      <GithubCorner />
      {/* fixed width so the sidebar never resizes between sections and
          always fits the full header */}
      <div className="flex flex-col w-72 shrink-0 bg-gray-300 rounded-lg shadow-lg mb-8 self-start">
        <div className="flex items-center mb-4 bg-gray-700 justify-center p-2">
          <img src={logo} alt="DBR Logo" className="w-12 h-12" />
          <h2 className="text-xl font-bold text-white">
            DuelingBook
            <span className="text-gray-400">Reloaded</span>
          </h2>
        </div>
        <p className="text-xl font-semibold text-center">SETTINGS</p>
        <nav className="mt-4 text-white">
          <button
            className="bg-gray-700 hover:bg-gray-500 w-full py-2 mb-2"
            onClick={() => setCurrentSection("General")}
          >
            General
          </button>
          <button
            className="bg-gray-700 hover:bg-gray-500 w-full py-2 mb-2"
            onClick={() => setCurrentSection("Customize Hotkeys")}
          >
            Customize Hotkeys
          </button>
          <button
            className="bg-gray-700 hover:bg-gray-500 w-full py-2 mb-2"
            onClick={() => setCurrentSection("Help")}
          >
            Known Issues
          </button>
        </nav>
      </div>
      <div className="flex-grow p-4 pt-0 rounded-lg">
        <main className="relative">
          {renderMainContent()}
          {isSavedVisible && (
            <div className="flex justify-center">
              <div className="saved-settings-message bg-green-500 text-white px-4 py-2 rounded-md absolute top-0 animate-slide-down opacity-0 text-lg transition-transform duration-500">
                Settings Saved!
              </div>
            </div>
          )}
        </main>
        <Attribution />
      </div>
    </div>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
  document.getElementById("root"),
);
