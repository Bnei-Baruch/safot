import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './cmp/Header';
import SourceIndex from './pages/SourceIndex';
import SourceEdit from './pages/SourceEdit';
import { ToastProvider } from './cmp/Toast';

function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <div className="App">
                    <Header />
                    <Routes>
                        <Route path="/" element={<SourceIndex />} />
                        <Route path="/source-edit/:id" element={<SourceEdit />} />
                    </Routes>
                </div>
            </ToastProvider>
        </BrowserRouter>
    );
}

export default App;
