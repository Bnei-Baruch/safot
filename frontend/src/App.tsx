import React, { useEffect } from 'react';
import '../src/assets/style/style.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './cmp/Header';
import Main from './pages/Main';
import SourceEdit from './pages/SourceEdit';
import { ToastProvider, useToast } from './cmp/Toast';
import { useKeycloak } from '@react-keycloak/web';
import { httpService } from './services/http.service';

const HttpErrorSetup: React.FC = () => {
  const { showToast } = useToast();

  useEffect(() => {
    httpService.setErrorCallback((message, details) => {
      showToast(message, 'error', details);
    });
  }, [showToast]);

  return null;
};

const App = () => {
  const { keycloak } = useKeycloak();

  return (
    <BrowserRouter>
      <ToastProvider>
        <HttpErrorSetup />
        <div className="App">
          <Header />
          {keycloak.authenticated &&
          <Routes>
            <Route path="/" element={<Main />} />
            <Route path="/source-edit/:id" element={<SourceEdit />} />
          </Routes>
          }
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
