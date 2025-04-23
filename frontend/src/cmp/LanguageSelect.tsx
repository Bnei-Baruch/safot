import React from 'react';
import { MenuItem, TextField, Box, Typography, Avatar } from '@mui/material';

export interface LanguageOption {
  code: string;
  label: string;
  flag: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: LanguageOption[];
}

const LanguageSelect: React.FC<Props> = ({ label, value, onChange, options }) => {
  return (
   
      <TextField
        select
        size="small"
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        variant="outlined"
        fullWidth
        sx={{ fontFamily: 'Kanit, sans-serif' }}
        InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
      >
        {options.map((lang) => (
          <MenuItem key={lang.code} value={lang.code}>
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar src={lang.flag} sx={{ width: 20, height: 20 }} />
              <Typography sx={{ fontFamily: 'inherit' }}>{lang.label}</Typography>
            </Box>
          </MenuItem>
        ))}
      </TextField>
  
  );
};

export default LanguageSelect;
