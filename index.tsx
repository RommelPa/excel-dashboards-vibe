import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import App from './App';
import { msalConfig } from './services/authConfig';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const msalInstance = new PublicClientApplication(msalConfig);

const MsalReady: React.FC = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    msalInstance.initialize().then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return <div className=\"p-6 text-center text-gray-500\">Inicializando autenticación...</div>;
  }

  return (
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  );
};

root.render(
  <React.StrictMode>
    <MsalReady />
  </React.StrictMode>
);
