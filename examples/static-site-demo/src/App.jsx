import React from "react";
import { ReactKeycloakProvider } from "@react-keycloak/web";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import SecurityGuy from "./SecurityGuy";
import SecurePage from "./SecurePage";
import Keycloak from "keycloak-js";

// Keycloak configuration - matching our MATRIC setup
const keycloak = new Keycloak({
    url: "http://localhost:8081",
    realm: "matric-dev",
    clientId: "matric-web",
});

function App() {
    return (
        <ReactKeycloakProvider 
            authClient={keycloak}
            initOptions={{
                onLoad: 'check-sso',
                checkLoginIframe: false,
                pkceMethod: 'S256'
            }}
        >
            <div className="app">
                <header className="app-header">
                    <h1>🔐 MATRIC Auth Demo</h1>
                    <p>React + Keycloak Integration (Working Pattern)</p>
                </header>
                <main className="app-main">
                    <BrowserRouter>
                        <Routes>
                            <Route
                                path="/"
                                element={
                                    <SecurityGuy>
                                        <SecurePage />
                                    </SecurityGuy>
                                }
                            />
                        </Routes>
                    </BrowserRouter>
                </main>
            </div>
        </ReactKeycloakProvider>
    );
}

export default App;