import React from "react";
import ReactDOM from "react-dom";
import dbr_logo from "../public/dbe_logo_64.png";

export const NewFeatures = () => {
  const features: string[] = [
    "Context-sensitive hotkeys: bindings now belong to what your mouse is on — the same key can Draw on your deck, Declare on a card, and Detach on an xyz material",
    "Way more actions: Attack, Flip Summon, To ATK/DEF, Move, Overlay ATK/DEF, Attach, Reveal, Draw, Shuffle, Mill Deck, Resolve Effect and more",
    "New mnemonic defaults: v+key opens views (v g → Graveyard), t+key sends cards (t h → To Hand, t g → To Graveyard), s a / s d special summons",
    "Import/Export: back up and share your hotkey config as JSON from the settings page",
    "Instant action menu: no more waiting for DuelingBook's menu to unroll",
    "Fixes: hotkeys work right after summoning a card, deck actions can't hit the wrong button, and the settings page got a cleanup",
    "Your existing bindings migrate automatically — hit Reset Defaults in settings to adopt the new keymap",
  ];

  return (
    <div className="bg-white w-full max-w-xl container mx-auto flex-col flex h-auto p-6 items-center rounded mt-6">
      <div className="bg-gray-700 rounded flex w-full justify-center items-center text-white px-4 py-2 my-4">
        <img src={dbr_logo} />
        <h1 className="text-2xl">What's New</h1>
      </div>
      <p>
        Thank you for using DuelingBookReloaded, here are the updates for
        0.6:{" "}
      </p>
      <ul className="my-6 list-disc pl-6 space-y-2 self-start">
        {features.map((feature, index) => (
          <li key={index} className="text-gray-600">
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <NewFeatures />
  </React.StrictMode>,
  document.getElementById("root"),
);
