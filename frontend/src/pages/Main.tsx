import React, { useState } from 'react';

import SourceIndex from './SourceIndex';
import Dictionaries from '../cmp/Dictionaries';
import TranslateForm from '../cmp/TranslateForm';

import { Box, Button, Collapse, Container, Tabs, Tab } from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown } from "@mui/icons-material";

const MAIN_TAB_SELECTED = 'main_tab_selected';

const Main: React.FC = () => {
	const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState(Number(localStorage.getItem(MAIN_TAB_SELECTED)) || 0);

  return (
    <>
			<Box maxWidth="xl" sx={{ margin: 'auto', position: 'relative' }}>
				<Button sx={{ position: 'absolute', top: '-30px' }} onClick={() => setOpen(!open)}>
					{open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
				</Button>
			</Box>
			<Collapse in={open} timeout="auto" unmountOnExit>
				<Box sx={{ backgroundColor: '#f5f5f5', p: 5 }}>
					<Container maxWidth={false} sx={{ width: "fit-content" }}>
						<TranslateForm />
					</Container>
				</Box>
			</Collapse>
      <Box maxWidth="xl" sx={{ margin: 'auto' }}>
        <Tabs
          value={selected}
          onChange={(_, v) => {
            setSelected(v);
            localStorage.setItem(MAIN_TAB_SELECTED, v);
          }} >
          <Tab label="Sources" />
          <Tab label="Dictionaries" />
        </Tabs>

        {selected === 0 && <SourceIndex />}
        {selected === 1 && <Dictionaries />}
      </Box>
    </>
  );
};

export default Main;
