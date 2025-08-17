import React from 'react';
import ReactDOM from 'react-dom/client';
import WorkingApp from './WorkingApp';
import UserService from './services/UserService';

// Initialize Keycloak BEFORE rendering the app
// This is the key to making it work!
const renderApp = () => {
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  
  root.render(
    <WorkingApp />
  );
};

// Start the app by initializing Keycloak first
UserService.initKeycloak(renderApp);