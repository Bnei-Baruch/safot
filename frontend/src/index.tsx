import React from 'react';
import ReactDOM from 'react-dom/client';
import { ReactKeycloakProvider } from '@react-keycloak/web';
import { Provider } from "react-redux";
import { ToastContainer } from "react-toastify";

import './index.css';
import "react-toastify/dist/ReactToastify.css";

import App from './App';
import keycloak from './keycloak';
import reportWebVitals from './reportWebVitals';
import store from "./store";

const onKeycloakTokens = (tokens: { token: string; refreshToken: string }) => {
 console.log('Tokens refreshed:', tokens);
 localStorage.setItem('token', tokens.token);
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
    <ToastContainer />
    <Provider store={store}>
      <App />
    </Provider>
  </ReactKeycloakProvider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
