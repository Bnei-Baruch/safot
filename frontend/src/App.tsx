import React, { useState } from 'react';
import './App.css';
import { useKeycloak } from '@react-keycloak/web';

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
			const formData = new FormData();
      formData.append('file', file);
			try {
        const result = await fetch('https://babylon.bbdev1.kbb1.com/backend/docx2text', {
          method: 'POST',
          body: formData,
        });

        const data = await result.json();
        console.log(data);
				setParagraphs(data);
      } catch (error) {
        console.error(error);
      }
		}
  };

  return (
    <div className="App">
			<h1>Safot</h1>
      <div>
        {!keycloak.authenticated && (
          <button onClick={() => keycloak.login()}>Login</button>
        )}
        {keycloak.authenticated && (
          <button onClick={() => keycloak.logout()}>Logout</button>
        )}
      </div>
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
