import React from "react";

/**
 * Fork acknowledgement shown at the bottom of the options page.
 */
const Attribution = () => (
  <footer className="text-sm text-gray-500 text-center mt-8 mb-2">
    DuelingBookReloaded is a fork of{" "}
    <a
      className="text-blue-500 hover:underline"
      href="https://github.com/alexjraymond/DuelingBookEnhanced"
      target="_blank"
      rel="noreferrer"
    >
      DuelingBookEnhanced
    </a>{" "}
    by{" "}
    <a
      className="text-blue-500 hover:underline"
      href="https://github.com/alexjraymond"
      target="_blank"
      rel="noreferrer"
    >
      alexjraymond
    </a>
    . All credit for the original extension goes to Alex &amp; Joseph.
  </footer>
);

export default Attribution;
