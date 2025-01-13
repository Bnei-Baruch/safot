

import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './cmp/Header';
import SourceIndex from './pages/SourceIndex';
import SourceEdit from './pages/SourceEdit';

function App() {
    return (
        <BrowserRouter>
            <div className="App">
                <Header />
                <Routes>
                    <Route path="/" element={<SourceIndex />} />
                    <Route path="/source-edit" element={<SourceEdit />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
