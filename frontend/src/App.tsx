import React from 'react';
import '../src/assets/style/style.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './cmp/Header';
import Main from './pages/Main';
import SourceEdit from './pages/SourceEdit';
import { ToastProvider } from './cmp/Toast';
import { UserProvider } from './contexts/UserContext';
import { useKeycloak } from '@react-keycloak/web';

const App = () => {
  const { keycloak } = useKeycloak();

  return (
    <BrowserRouter>
      <ToastProvider>
        <UserProvider>
          <div className="App">
            <Header />
            {keycloak.authenticated &&
            <Routes>
              <Route path="/" element={<Main />} />
              <Route path="/source-edit/:id" element={<SourceEdit />} />
            </Routes>
            }
          </div>
        </UserProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;