import React from 'react';
import {
  Box,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
} from '@mui/icons-material';

import { LANGUAGES } from '../constants/languages';

const LANG_STYLE = {
  width: 150,
  fontFamily: 'Kanit, sans-serif',
};

interface LanguageSelectorProps {
  sourceLang: string;
  targetLang: string;
  onSourceLangChange: (lang: string) => void;
  onTargetLangChange: (lang: string) => void;
  submitAttempted?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  sourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  submitAttempted = false,
  disabled = false,
  size = 'small',
}) => {
  return (
    <Box display="flex" alignItems="center" gap={2}>
      <TextField
        select
        label="From Language"
        value={sourceLang}
        onChange={(e) => onSourceLangChange(e.target.value)}
        variant="outlined"
        error={submitAttempted && !sourceLang}
        helperText={submitAttempted && !sourceLang ? 'Required' : ' '}
        disabled={disabled}
        sx={LANG_STYLE}
        InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
        size={size}
      >
        {LANGUAGES.map((lang) => (
          <MenuItem key={lang.code} value={lang.code}>
            <Typography sx={{ fontFamily: 'inherit' }}>{lang.label}</Typography>
          </MenuItem>
        ))}
      </TextField>

      <ArrowForward sx={{ color: '#ccc', pb: 3 }} />

      <TextField
        select
        label="To Language"
        value={targetLang}
        onChange={(e) => onTargetLangChange(e.target.value)}
        variant="outlined"
        error={submitAttempted && !targetLang}
        helperText={submitAttempted && !targetLang ? 'Required' : ' '}
        disabled={disabled}
        sx={LANG_STYLE}
        InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
        size={size}
      >
        {LANGUAGES.map((lang) => (
          <MenuItem key={lang.code} value={lang.code}>
            <Typography sx={{ fontFamily: 'inherit' }}>{lang.label}</Typography>
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
};

export default LanguageSelector;
