import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import "./app/theme";
import "./styles/app.css";
import App from "./app/App";
import PresentWindow from "./present/PresentWindow";

// Presentation windows load the same bundle with #audience or #presenter.
const view = location.hash.slice(1);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {view === "audience" || view === "presenter" ? <PresentWindow role={view} /> : <App />}
  </React.StrictMode>,
);
