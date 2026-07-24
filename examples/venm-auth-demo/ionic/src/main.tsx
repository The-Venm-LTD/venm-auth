import React from "react";
import ReactDOM from "react-dom/client";

/* Core Ionic CSS — required for Ionic components to render properly */
import "@ionic/react/css/core.css";

/* Ionic base stylesheets */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Ionic optional utility stylesheets */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/* Ionic dark theme */
import "@ionic/react/css/palettes/dark.system.css";

/* App styles */
import "./App.css";

import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
