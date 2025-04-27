import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
  Avatar
} from '@mui/material';
import { SourceFilterProps } from '../types/frontend-types';
import { LANGUAGES } from '../constants/languages'; 

const SourceFilter: React.FC<SourceFilterProps> = ({
  filterType,
  setFilterType,
  languageFilter,
  setLanguageFilter,
  fileNameFilter,
  setFileNameFilter,
  fromLanguageFilter,
  setFromLanguageFilter,
}) => {
  const handleFilterTypeChange = (event: SelectChangeEvent) => {
    setFilterType(event.target.value as any);
    setLanguageFilter(null);
    setFromLanguageFilter(null);
    setFileNameFilter('');
  };

  const handleLanguageChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    setLanguageFilter(value === '' ? null : value);
  };

  const handleFromLanguageChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    setFromLanguageFilter(value === '' ? null : value);
  };

  return (
    <Box sx={{ display: 'flex', gap: 3, mb: 3, alignItems: 'center' }}>
      {/* Filter type selector */}
      <FormControl size="small">
        <InputLabel id="filter-type-label">Filter by</InputLabel>
        <Select
          labelId="filter-type-label"
          value={filterType}
          onChange={handleFilterTypeChange}
          label="Filter by"
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="mine">My documents</MenuItem>
          <MenuItem value="file">File name</MenuItem>
          <MenuItem value="from_language">From language</MenuItem>
          <MenuItem value="language">To language</MenuItem>
        </Select>
      </FormControl>

      {/* File name filter */}
      {filterType === 'file' && (
        <TextField
          label="File name"
          value={fileNameFilter}
          onChange={(e) => setFileNameFilter(e.target.value)}
          size="small"
        />
      )}

      {/* From language filter */}
      {filterType === 'from_language' && (
        <FormControl size="small">
          <InputLabel id="from-language-select-label" >From language</InputLabel>
          <Select
            labelId="from-language-select-label"
            value={fromLanguageFilter || ''}
            onChange={handleFromLanguageChange}
            label="From language"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            {LANGUAGES.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar src={lang.flag} sx={{ width: 20, height: 20 }} />
                  <Typography>{lang.label}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* To language filter */}
      {filterType === 'language' && (
        <FormControl size="small">
          <InputLabel id="language-select-label" >To language</InputLabel>
          <Select
            labelId="language-select-label"
            value={languageFilter || ''}
            onChange={handleLanguageChange}
            label="To language"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            {LANGUAGES.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar src={lang.flag} sx={{ width: 20, height: 20 }} />
                  <Typography>{lang.label}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  );
};

export default SourceFilter;
