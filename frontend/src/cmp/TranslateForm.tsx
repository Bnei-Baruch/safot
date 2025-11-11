import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";

import {
  Select,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowDropDown,
  ArrowForward,
  InsertDriveFileOutlined,
} from '@mui/icons-material';

import { LANGUAGES } from '../constants/languages'
import { useToast } from './Toast';
import { useFlow } from '../useFlow';
import { useAppDispatch, useAppSelector, RootState } from '../store/store';
import { fetchDictionaries } from '../store/DictionarySlice';

const LANG_STYLE = {
  width: 150,
  fontFamily: 'Kanit, sans-serif',
};

const TranslateForm: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState<string>('');
  const [targetLang, setTargetLang] = useState<string>('');
  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);
  const {showToast} = useToast();
  const [stepByStep, setStepByStep] = useState<boolean>(true);
  const {translateFile, loadingCount} = useFlow();
  const {dictionaries, loading, error} = useAppSelector((state: RootState) => state.dictionaries);
  const [selectedDictionary, setSelectedDictionary] = useState<{id: null|number, timestamp: null|string}>({id: null, timestamp: null});
  const anythingLoading = !!loadingCount || loading;

  useEffect(() => {
    dispatch(fetchDictionaries());
  }, [dispatch]);

  const handleFileClick = () => {
    document.getElementById('fileInput')?.click();
  };

  const processUploadedFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      showToast('Only .docx files are supported.', 'error');
      setFile(null);
      return;
    }
    setFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processUploadedFile(e.target.files?.[0] || null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    processUploadedFile(e.dataTransfer.files?.[0] || null);
  };

  const handleSubmit = async (all: boolean) => {
    setSubmitAttempted(true);
    if (!file || !sourceLang || !targetLang) return;
    const name = file.name.replace(/\.docx$/, '');
    showToast('Processing file...', 'info');
    try {
      const { translatedSourceId } = await translateFile( 
        file, 
        name, 
        /*source_language*/ sourceLang, 
        /*target_language*/ targetLang,
        /*step_by_step*/ !all,
        selectedDictionary.id,
        selectedDictionary.timestamp,
      );
      showToast('Translation completed', 'success');
      navigate(`/source-edit/${translatedSourceId}`);
    } catch (error) {
      if (error instanceof Error) {
        showToast('Error translating file: ' + error.message, 'error');
      } else {
        showToast('Error translating file', 'error');
      }
    }
  };

  if (error) {
    showToast(`Error loading dictionaries: ${error}`, 'error');
  }

  return (
    <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2, fontFamily: 'Kanit, sans-serif' }}>
      <Box display="flex" alignItems="center" gap={2}>
        <Box display="flex" alignItems="center" flexDirection="column">
          {/* Language Selection */}
          <Box display="flex" alignItems="center" gap={2}>
            <TextField
              select
              label="From Language"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              variant="outlined"
              error={submitAttempted && !sourceLang}
              helperText={submitAttempted && !sourceLang ? 'Required' : ' '}
              disabled={!!anythingLoading}
              sx={LANG_STYLE}
              InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
              size="small"
            >
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  <Typography sx={{ fontFamily: 'inherit' }}>{lang.label}</Typography>
                </MenuItem>
              ))}
            </TextField>

            <ArrowForward sx={{ color: '#ccc', pb:3 }} />
            
            <TextField
              select
              label="To Language"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              variant="outlined"
              error={submitAttempted && !targetLang}
              helperText={submitAttempted && !targetLang ? 'Required' : ' '}
              disabled={!!anythingLoading}
              sx={LANG_STYLE}
              InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
              size="small"
            >
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  <Typography sx={{ fontFamily: 'inherit' }}>{lang.label}</Typography>
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Upload Area */}
          <Box
            onClick={!!anythingLoading ? undefined : handleFileClick}
            onDrop={!!anythingLoading ? undefined : handleDrop}
            onDragOver={(e) => e.preventDefault()}
            sx={{
              width: '100%',
              height: 120,
              border: '2px dashed #bbb',
              borderRadius: 2,
              backgroundColor: !!anythingLoading ? '#f0f0f0' : '#f5f5f5',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !!anythingLoading ? 'not-allowed' : 'pointer',
              opacity: !!anythingLoading ? 0.6 : 1,
            }}
          >
            <InsertDriveFileOutlined sx={{ mb: 1, fontSize: 36, color: '#777' }} />
            <Typography sx={{ fontFamily: 'inherit' }}>
              {!!anythingLoading ? 'Translation in progress...' : 'Click to Upload or Drag File'}
            </Typography>
          </Box>

          <input
            id="fileInput"
            type="file"
            accept=".docx"
            hidden
            onChange={handleFileChange}
          />

          {file && (
            <Box sx={{ mt: 1, textAlign: 'left' }}>
              <Typography variant="body2" sx={{ fontFamily: 'inherit' }}>
                {file.name}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Translate Section */}
        <Divider orientation="vertical" flexItem sx={{ borderColor: '#ccc', mx: 1 }} />

        <Box gap={2}>
          {!anythingLoading ? (
            <Box gap={2} display="flex" flexDirection="column" alignItems="center">
              <Select
                id="simple-select"
                value={selectedDictionary.id || 0}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedDictionary({id: id || null, timestamp: dictionaries[id].timestamp || null});
                }}
                sx={{ minWidth: 200, maxWidth: 400 }}
              >
                <MenuItem value={0}>Default</MenuItem>
                {Object.entries(dictionaries).map(([id, dictionary]) =>
                  <MenuItem key={id} value={id}>{dictionary.name}</MenuItem>
                )}
              </Select>

              <Button
                variant={stepByStep ? "contained" : "outlined"}
                onClick={() => handleSubmit(!stepByStep)}
                sx={{ width: 200, height: '4em', fontFamily: 'inherit' }}
              >
                <Typography sx={{ flexGrow: 1, textAlign: "center" }}>
                  {stepByStep ? "Translate" : "Translate ALL!"}
                </Typography>
                <ArrowDropDown
                  sx={{ ml: "auto" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setStepByStep(!stepByStep);
                  }}
                />
              </Button>
            </Box>
          ) : (
            <>
              <CircularProgress size={20} />
              <Typography sx={{ fontFamily: 'inherit', color: '#444', mt: 1 }}>
                Translating your file, please wait...
              </Typography>
            </>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default TranslateForm;
