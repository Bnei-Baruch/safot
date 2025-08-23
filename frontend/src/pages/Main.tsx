import React, { useState } from 'react';

import SourceIndex from './SourceIndex';
import Dictionaries from '../cmp/Dictionaries';
import TranslateForm from '../cmp/TranslateForm';

import { Box, Container, Tabs, Tab } from '@mui/material';


const Main: React.FC = () => {
  const [selected, setSelected] = useState(0);

  return (
    <>
      <Box sx={{ backgroundColor: '#f5f5f5', p: 5 }}>
        <Container maxWidth={false} sx={{ width: "fit-content" }}>
          <TranslateForm />
        </Container>
      </Box>
      <Box>
        <Tabs value={selected} onChange={(_, v) => setSelected(v)} >
          <Tab label="Sources" />
          <Tab label="Dictionaries" disabled />
        </Tabs>

        {selected === 0 && <SourceIndex />}
        {selected === 1 && <Dictionaries />}
      </Box>
    </>
  );
};

export default Main;
