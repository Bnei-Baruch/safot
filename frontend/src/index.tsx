import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import keycloak from './keycloak';
import { ReactKeycloakProvider } from '@react-keycloak/web';

const onKeycloakTokens = (tokens: { token: string; refreshToken: string }) => {
 console.log('Tokens refreshed:', tokens);
};

const onKeycloakEvent = async (event: string, error?: Error) => {
	console.log('Keycloak event:', event, error);
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <ReactKeycloakProvider
      authClient={keycloak}
      onTokens={onKeycloakTokens}
      onEvent={onKeycloakEvent}
			initOptions={{
				checkLoginIframe: false,  // This disables iframe checking for session status
			}}>
    <App />
  </ReactKeycloakProvider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
