import React from "react";
import { createRoot } from "react-dom/client";

/* Plugin registration happens via import side-effects.
   Community plugins would be imported (or dynamically loaded) here too. */
import "./modules.jsx";
import "./views/board.jsx";
import "./views/kanban.jsx";
import "./views/sheet.jsx";
import "./views/draw.jsx";
import "./views/code.jsx";

import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
