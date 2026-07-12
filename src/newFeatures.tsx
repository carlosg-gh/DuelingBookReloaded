import React from "react";
import ReactDOM from "react-dom";
import dbr_logo from "../public/dbe_logo_64.png";

export const NewFeatures = () => {
  const features: string[] = [
    "Replay controls: watching a replay now gets a full player bar — a timeline you can click to jump anywhere, with turn and game markers",
    "Event icons on the timeline: summons, effect activations, attacks, phase changes and LP swings, each with a card-name tooltip — click one to jump straight to that play",
    "Step Backward: rewind a replay one play at a time (new Prev/Next buttons sit right in DuelingBook's panel)",
    "Playback speed from 0.5× to 4×, and Jump to Game 1/2/3 buttons for multi-game matches",
    "Replay hotkeys: Space play/pause, ←/→ step, ↑/↓ speed, [ ] previous/next turn, g 1/2/3 game jumps — all customizable in the new Replay Viewer section in settings",
    "Space and the arrow keys are now assignable to any hotkey",
    "A Replay Controls toggle in the popup if you prefer DuelingBook's stock viewer",
  ];

  return (
    <div className="bg-white w-full max-w-xl container mx-auto flex-col flex h-auto p-6 items-center rounded mt-6">
      <div className="bg-gray-700 rounded flex w-full justify-center items-center text-white px-4 py-2 my-4">
        <img src={dbr_logo} />
        <h1 className="text-2xl">What's New</h1>
      </div>
      <p>
        Thank you for using DuelingBookReloaded, here are the updates for
        0.7:{" "}
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
