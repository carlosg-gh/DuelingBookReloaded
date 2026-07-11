import React from "react";
import ReactDOM from "react-dom";
import dbr_logo from "../public/dbe_logo_64.png";

export const NewFeatures = () => {
  const features: string[] = [
    "Hotkeys now work reliably: keypresses no longer get swallowed by the chat box, so you never have to click away before using a hotkey",
    'Multi-key hotkey sequences: bind combos like "v e" (View Extra) alongside single keys',
    "New press-to-record hotkey editor in the settings page, with smarter conflict detection for sequences",
    "The extension is now DuelingBookReloaded, a community fork of DuelingBookEnhanced",
    "Removed donation and Discord banners; feedback now goes through GitHub issues",
    "Under the hood: updated dependencies, fixed the extension manifest, and added automated builds/releases",
  ];

  return (
    <div className="bg-white w-1/4 container mx-auto flex-col flex h-auto p-4 items-center rounded mt-6">
      <div className="bg-gray-700 rounded flex w-full justify-center items-center text-white px-4 py-2 my-4">
        <img src={dbr_logo} />
        <h1 className="text-2xl">What's New</h1>
      </div>
      <p>
        Thank you for using DuelingBookReloaded, here are the updates for
        0.3:{" "}
      </p>
      <div className="my-6">
        {features.map((feature, index) => (
          <li key={index} className="text-gray-600">
            {feature}
          </li>
        ))}
      </div>
    </div>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <NewFeatures />
  </React.StrictMode>,
  document.getElementById("root"),
);
