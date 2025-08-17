import { createRoot } from "react-dom/client";
import "./App.css";
import OfficialApp from "./OfficialApp.jsx";

// Simple initialization - exactly as per official docs
// No StrictMode to avoid double init
createRoot(document.getElementById("root")).render(<OfficialApp />);