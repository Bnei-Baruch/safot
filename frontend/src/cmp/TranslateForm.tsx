import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";

import {
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  TextField,
  Typography,
  Radio,
  IconButton,
} from '@mui/material';
import {
  ArrowDropDown,
  InsertDriveFileOutlined,
  Delete,
} from '@mui/icons-material';

import { LANGUAGES } from '../constants/languages'
import { useToast } from './Toast';
import { useFlow } from '../useFlow';
import { useAppDispatch, useAppSelector, RootState } from '../store/store';
import {
  fetchDictionaries,
  getDictionaryIds,
  getLatestDictionary,
} from '../store/DictionarySlice';
import { Dictionary } from '../types/frontend-types';

const LANG_STYLE = {
  width: 150,
  fontFamily: 'Kanit, sans-serif',
};

interface FileWithLanguage {
  file: File;
  sourceLanguage: string;
  id: string; // unique identifier for the file
}

const TranslateForm: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [files, setFiles] = useState<FileWithLanguage[]>([]);
  const [originalSourceIndex, setOriginalSourceIndex] = useState<number | null>(null);
  const [targetLang, setTargetLang] = useState<string>('');
  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);
  const {showToast} = useToast();
  const [translateAll, setTranslateAll] = useState<boolean>(false);
  const {translateFile, loadingCount} = useFlow();
  const {dictionaries, loading, error} = useAppSelector((state: RootState) => state.dictionaries);
  const [selectedDictionary, setSelectedDictionary] = useState<Dictionary | null>(null);
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
      return;
    }
    const newFile: FileWithLanguage = {
      file,
      sourceLanguage: '',
      id: `${Date.now()}-${Math.random()}`,
    };
    const newFiles = [...files, newFile];
    setFiles(newFiles);
    // Set as original source if it's the first file
    if (files.length === 0) {
      setOriginalSourceIndex(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processUploadedFile(e.target.files?.[0] || null);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    processUploadedFile(e.dataTransfer.files?.[0] || null);
  };

  const handleDeleteFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    // Adjust original source index if needed
    if (originalSourceIndex === index) {
      setOriginalSourceIndex(newFiles.length > 0 ? 0 : null);
    } else if (originalSourceIndex !== null && originalSourceIndex > index) {
      setOriginalSourceIndex(originalSourceIndex - 1);
    }
  };

  const handleSourceLanguageChange = (index: number, language: string) => {
    const newFiles = [...files];
    newFiles[index].sourceLanguage = language;
    setFiles(newFiles);
  };

  const handleOriginalSourceChange = (index: number) => {
    setOriginalSourceIndex(index);
  };

  const handleSubmit = async (all: boolean) => {
    setSubmitAttempted(true);
    
    // Validation
    if (files.length === 0) {
      showToast('Please upload at least one file.', 'error');
      return;
    }
    if (originalSourceIndex === null) {
      showToast('Please select an original source.', 'error');
      return;
    }
    if (!targetLang) {
      showToast('Please select a target language.', 'error');
      return;
    }
    
    const originalFile = files[originalSourceIndex];
    if (!originalFile.sourceLanguage) {
      showToast('Please select a source language for the original file.', 'error');
      return;
    }

    // Check all files have source languages
    const missingLanguages = files.filter(f => !f.sourceLanguage);
    if (missingLanguages.length > 0) {
      showToast('Please select source language for all files.', 'error');
      return;
    }

    // Build additional sources array (all files except the original one)
    const additionalSourcesLanguages = files
      .filter((_, index) => index !== originalSourceIndex)
      .map(fileWithLang => fileWithLang.sourceLanguage);
    const additionalSourcesFiles = files
      .filter((_, index) => index !== originalSourceIndex)
      .map(fileWithLang => fileWithLang.file);

    if (selectedDictionary) {
      const sourcesSortedLanguages = [
        originalFile.sourceLanguage,
        ...additionalSourcesLanguages,
      ].sort().join(',');
      const dictionarySortedLanguages = [
        selectedDictionary.original_language,
        ...(selectedDictionary.additional_sources_languages || []),
      ].sort().join(',');
      if (targetLang !== selectedDictionary.translated_language ||
         sourcesSortedLanguages !== dictionarySortedLanguages) {
        // eslint-disable-next-line no-restricted-globals
        if (!confirm(`Dictionary languages (${dictionarySortedLanguages} => ${selectedDictionary.translated_language}) don't match the requested translation (${sourcesSortedLanguages} => ${targetLang}). Continue anyway?`)) {
          return;
        }
      }
    }
    
    showToast('Processing file...', 'info');
    try {
      const translatedSourceId = await translateFile(
        originalFile.sourceLanguage,
        originalFile.file,
        additionalSourcesLanguages,
        additionalSourcesFiles,
        targetLang,
        all,
        selectedDictionary?.id,
        selectedDictionary?.timestamp,
      );
      showToast('Translation completed', 'success');
      navigate(`/source-edit/${translatedSourceId}`);
    } catch (error) {
      // HTTP errors are handled by the global error interceptor
      console.error('Translation failed:', error);
    }
  };

  useEffect(() => {
    if (error) {
      showToast(`Error loading dictionaries: ${error}`, 'error');
    }
  }, [error, showToast]);

  return (
    <Paper sx={{ p: 3, pb: files.length > 0 ? '5px' : 3, backgroundColor: '#ffffff', borderRadius: 2, fontFamily: 'Kanit, sans-serif' }}>
      <Box display="flex" flexDirection="column" gap={3}>
        <Box display="flex" gap={3}>
          {/* Left Column - Upload Area */}
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
            <Typography sx={{ fontFamily: 'inherit', marginRight: '10px', marginLeft: '10px' }}>
              {!!anythingLoading ? 'Translation in progress...' :
               files.length > 0 ? 'Add another Source' : 'Click to Upload or Drag File'}
            </Typography>
            <input
              id="fileInput"
              type="file"
              accept=".docx"
              hidden
              onChange={handleFileChange}
            />
          </Box>

          {/* Vertical Divider */}
          <Divider orientation="vertical" flexItem />

          {/* Right Column - Dictionary Selection and Translate Button */}
          <Box sx={{
            width: 300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3
          }}>
            {/* Dictionary Selection */}
            <TextField
              select
              label="Dictionary"
              value={selectedDictionary?.id || 0}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id) {
                  setSelectedDictionary(getLatestDictionary(dictionaries, id));
                } else {
                  setSelectedDictionary(null);
                }
              }}
              disabled={!!anythingLoading}
              sx={{ width: '100%', fontFamily: 'Kanit, sans-serif' }}
              InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
              size="small"
            >
              <MenuItem value={0}>
                <Typography sx={{ fontFamily: 'inherit' }}>Default</Typography>
              </MenuItem>
              {getDictionaryIds(dictionaries).map((id) => (
                <MenuItem key={id} value={id}>
                  <Typography sx={{ fontFamily: 'inherit' }}>
                    {getLatestDictionary(dictionaries, id)?.name}
                  </Typography>
                </MenuItem>
              ))}
            </TextField>

            {/* Translate Section */}
            {!anythingLoading ? (
              <Button
                variant={translateAll ? "outlined" : "contained"}
                onClick={() => handleSubmit(translateAll)}
                sx={{ width: '100%', height: '4em', fontFamily: 'inherit' }}
              >
                <Typography sx={{ flexGrow: 1, textAlign: "center" }}>
                  {translateAll ? "Translate ALL!" : "Translate"}
                </Typography>
                <ArrowDropDown
                  sx={{ ml: "auto" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTranslateAll(!translateAll);
                  }}
                />
              </Button>
            ) : (
              <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                <CircularProgress size={20} />
                <Typography sx={{ fontFamily: 'inherit', color: '#444' }}>
                  Translating your file, please wait...
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Below - Files List and Translate To */}
        {files.length > 0 && (
          <Box>
            {files.map((fileWithLang, index) => (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1,
                border: '1px solid #e0e0e0',
                borderRadius: 2,
                backgroundColor: '#fafafa',
              }}>
                <Radio
                  checked={originalSourceIndex === index}
                  onChange={() => handleOriginalSourceChange(index)}
                  disabled={!!anythingLoading}
                />
                <Typography
                  sx={{
                    fontFamily: 'inherit',
                    fontWeight: 'bold',
                    color: 'red',
                    visibility: originalSourceIndex === index ? 'visible' : 'hidden',
                  }}
                >
                  Original
                </Typography>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <InsertDriveFileOutlined sx={{ color: '#777' }} />
                  <Typography variant="body2" sx={{ fontFamily: 'inherit', flex: 1 }}>
                    {fileWithLang.file.name}
                  </Typography>
                </Box>
                <TextField
                  select
                  label="Language"
                  value={fileWithLang.sourceLanguage}
                  onChange={(e) => handleSourceLanguageChange(index, e.target.value)}
                  variant="outlined"
                  error={submitAttempted && !fileWithLang.sourceLanguage}
                  helperText={submitAttempted && !fileWithLang.sourceLanguage ? 'Required' : ' '}
                  disabled={!!anythingLoading}
                  sx={{ width: 150, fontFamily: 'Kanit, sans-serif', marginTop: '24px' }}
                  InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
                  size="small"
                >
                  {LANGUAGES.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                      <Typography sx={{ fontFamily: 'inherit' }}>{lang.label}</Typography>
                    </MenuItem>
                  ))}
                </TextField>
                <IconButton
                  onClick={() => handleDeleteFile(index)}
                  disabled={!!anythingLoading}
                  sx={{ color: '#d32f2f' }}
                >
                  <Delete />
                </IconButton>
              </Box>
            ))}

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
        )}
      </Box>
    </Paper>
  );
};

export default TranslateForm;
