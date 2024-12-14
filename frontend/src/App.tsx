import React, { useState } from 'react';
import './App.css';
import { useKeycloak } from '@react-keycloak/web';
import LoginButton from './LoginButton';
import Dictionaries from './Dictionaries';
import { Box } from '@mui/material';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [paragraphs, setParagraphs] = useState<string[] | null>(null);
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) {
    return <div>Loading...</div>;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleDocx2Text = async () => {
    if (file) {

      if (!keycloak?.token) {
        console.error('Keycloak token is missing.');
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      try {
        const result = await fetch('http://0.0.0.0:7392/docx2text', {
          // const result = await fetch('https://safot.bbdev1.kbb1.com/backend/docx2text', {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${keycloak.token}`, // Add the token
          },
        });

        const data = await result.json();
        console.log('API Response:', data); // Add this line
        setParagraphs(data);
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div className="App">
      <h1>Safot</h1>
      <Box sx={{ position: 'absolute', top: '10px', right: '10px' }}>
        <LoginButton />
      </Box>
      <Dictionaries />
      <p>
        <input type="file" onChange={handleFileChange} />
        <button disabled={!file} onClick={handleDocx2Text}>docx2text</button>
      </p>
      {paragraphs && <div>
        {paragraphs.map((p, idx) => <p key={idx}>{p}</p>)}
      </div>}
    </div>
  );
}

export default App;
