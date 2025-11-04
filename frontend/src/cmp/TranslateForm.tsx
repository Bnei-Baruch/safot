import React, { useState } from 'react';
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
  Checkbox,
  FormControlLabel,
  Radio,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import {
  ArrowDropDown,
  ArrowForward,
  InsertDriveFileOutlined,
  Delete as DeleteIcon,
} from '@mui/icons-material';

import { LANGUAGES } from '../constants/languages'
import { useToast } from './Toast';
import { useFlow } from '../useFlow';
import { extractParagraphs, postSegments, buildSegment } from '../services/segment.service';
import { postSource } from '../services/source.service';

const LANG_STYLE = {
  width: 150,
  fontFamily: 'Kanit, sans-serif',
};

const TranslateForm: React.FC = () => {
  const navigate = useNavigate();

  const [multiSourceMode, setMultiSourceMode] = useState(false);
  const [files, setFiles] = useState<Array<{file: File, language: string}>>([]);
  const [originFileIndex, setOriginFileIndex] = useState<number | null>(null);
  const [sourceLang, setSourceLang] = useState<string>('');
  const [targetLang, setTargetLang] = useState<string>('');
  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);
  const { showToast } = useToast();
  const [stepByStep, setStepByStep] = useState<boolean>(true);
  const { translateFile, translateMultiSource, loadingCount } = useFlow();
  
  // Keep backward compatibility
  const file = files[0]?.file || null;

  const handleFileClick = () => {
    document.getElementById('fileInput')?.click();
  };

  const processUploadedFile = (file: File | null, language?: string) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      showToast('Only .docx files are supported.', 'error');
      setFiles([]);
      return;
    }
    setFiles([{ file, language: language || sourceLang || '' }]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => 
        file.name.toLowerCase().endsWith('.docx')
      );
      
      if (multiSourceMode) {
        setFiles(prev => {
          const newFileEntries = newFiles.map(f => ({ file: f, language: sourceLang || '' }));
          const updated = [...prev, ...newFileEntries];
          if (originFileIndex === null && newFiles.length > 0) {
            setOriginFileIndex(prev.length); // Set first new file as origin if none selected
          }
          return updated;
        });
      } else {
        if (newFiles.length > 0) {
          processUploadedFile(newFiles[0], sourceLang);
          setOriginFileIndex(0);
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (multiSourceMode) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
        file.name.toLowerCase().endsWith('.docx')
      );
      setFiles(prev => {
        const newFileEntries = droppedFiles.map(f => ({ file: f, language: sourceLang || '' }));
        const updated = [...prev, ...newFileEntries];
        if (originFileIndex === null && droppedFiles.length > 0) {
          setOriginFileIndex(prev.length);
        }
        return updated;
      });
    } else {
      const file = e.dataTransfer.files?.[0];
      if (file && file.name.toLowerCase().endsWith('.docx')) {
        processUploadedFile(file, sourceLang);
        setOriginFileIndex(0);
      } else if (file) {
        showToast('Only .docx files are supported.', 'error');
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      if (originFileIndex === index) {
        setOriginFileIndex(newFiles.length > 0 ? 0 : null);
      } else if (originFileIndex !== null && originFileIndex > index) {
        setOriginFileIndex(originFileIndex - 1);
      }
      return newFiles;
    });
  };

  const updateFileLanguage = (index: number, language: string) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], language };
      return updated;
    });
  };

  const normalizeName = (filename: string) => 
    filename.replace(/\.docx$/i, '').trim().replace(/\s+/g, '-');

  const createSourceFromFile = async (file: File, language: string): Promise<number> => {
    const name = normalizeName(file.name);
    const source = await postSource({
      name: name,
      language: language,
    });
    return source.id;
  };

  const processFilesAndCreateSources = async (): Promise<{
    originSourceId: number;
    nonOriginSourceIds: number[];
    translatedSourceId: number;
    originFileLanguage: string;
  }> => {
    if (files.length === 0 || originFileIndex === null) {
      throw new Error('No files selected or origin not selected');
    }

    const sourceIds: number[] = [];
    
    // Create sources for all files
    for (let i = 0; i < files.length; i++) {
      const fileEntry = files[i];
      const fileLanguage = fileEntry.language || sourceLang;
      if (!fileLanguage) {
        throw new Error(`Language not set for file: ${fileEntry.file.name}`);
      }
      const sourceId = await createSourceFromFile(fileEntry.file, fileLanguage);
      sourceIds.push(sourceId);
      
      // Extract and store segments
      const { paragraphs, properties } = await extractParagraphs(fileEntry.file);
      const segments = paragraphs.map((text, index) => buildSegment({
        text,
        source_id: sourceId,
        order: index + 1,
        properties,
      }));
      await postSegments(segments);
    }

    const originSourceId = sourceIds[originFileIndex];
    const nonOriginSourceIds = sourceIds.filter((_, i) => i !== originFileIndex);
    
    // Create translated source - use origin file's language as source language
    const originFileEntry = files[originFileIndex];
    const originFileLanguage = originFileEntry.language || sourceLang;
    const baseName = normalizeName(originFileEntry.file.name);
    const translatedSource = await postSource({
      name: `${baseName}-${targetLang}`,
      language: targetLang,
      original_source_id: originSourceId,
    });

    return {
      originSourceId,
      nonOriginSourceIds,
      translatedSourceId: translatedSource.id,
      originFileLanguage: originFileLanguage,
    };
  };

  const handleSubmit = async (all: boolean) => {
    setSubmitAttempted(true);
    if ((!multiSourceMode && !file) || (multiSourceMode && files.length === 0)) {
      showToast('Please select at least one file', 'error');
      return;
    }
    if (!targetLang) {
      showToast('Please select target language', 'error');
      return;
    }
    if (!multiSourceMode && !sourceLang) {
      showToast('Please select source language', 'error');
      return;
    }
    if (multiSourceMode && originFileIndex === null) {
      showToast('Please select an origin source', 'error');
      return;
    }
    if (multiSourceMode && files.some(f => !f.language)) {
      showToast('Please set language for all files', 'error');
      return;
    }

    showToast('Processing file...', 'info');
    try {
      if (multiSourceMode) {
        // Multi-source translation
        const { originSourceId, nonOriginSourceIds, translatedSourceId, originFileLanguage: originLang } = 
          await processFilesAndCreateSources();
        
        const { translatedSourceId: finalTranslatedId } = await translateMultiSource(
          originSourceId,
          nonOriginSourceIds,
          translatedSourceId,
          originLang, // Use origin file's language
          targetLang,
          !all // stepByStep = !all
        );
        
        showToast('Multi-source translation completed', 'success');
        navigate(`/source-edit/${finalTranslatedId}`);
      } else {
        // Regular single file translation
        const name = file!.name.replace(/\.docx$/, '');
        const { translatedSourceId } = await translateFile( 
          file!, 
          name, 
          sourceLang, 
          targetLang,
          !all // step_by_step = !all
        );
        showToast('Translation completed', 'success');
        navigate(`/source-edit/${translatedSourceId}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        showToast('Error translating file: ' + error.message, 'error');
      } else {
        showToast('Error translating file', 'error');
      }
    }
  };

  return (
    <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2, fontFamily: 'Kanit, sans-serif' }}>
      <Box display="flex" alignItems="center" gap={2}>
        <Box display="flex" alignItems="center" flexDirection="column" sx={{ width: '100%' }}>
          {/* Multi-source toggle */}
          <FormControlLabel
            control={
              <Checkbox
                checked={multiSourceMode}
                onChange={(e) => {
                  setMultiSourceMode(e.target.checked);
                  if (!e.target.checked) {
                    // Reset to single file mode
                    if (files.length > 0) {
                      setFiles([files[0]]);
                    }
                    setOriginFileIndex(0);
                  }
                }}
                disabled={!!loadingCount}
              />
            }
            label="Use multiple reference sources"
            sx={{ mb: 1, alignSelf: 'flex-start' }}
          />

          {/* Language Selection */}
          <Box display="flex" alignItems="center" gap={2}>
            {!multiSourceMode && (
              <>
                <TextField
                  select
                  label="From Language"
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  variant="outlined"
                  error={submitAttempted && !sourceLang}
                  helperText={submitAttempted && !sourceLang ? 'Required' : ' '}
                  disabled={!!loadingCount}
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
              </>
            )}
            
            <TextField
              select
              label="To Language"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              variant="outlined"
              error={submitAttempted && !targetLang}
              helperText={submitAttempted && !targetLang ? 'Required' : ' '}
              disabled={!!loadingCount}
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
            onClick={!!loadingCount ? undefined : handleFileClick}
            onDrop={!!loadingCount ? undefined : handleDrop}
            onDragOver={(e) => e.preventDefault()}
            sx={{
              width: '100%',
              height: 120,
              border: '2px dashed #bbb',
              borderRadius: 2,
              backgroundColor: !!loadingCount ? '#f0f0f0' : '#f5f5f5',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !!loadingCount ? 'not-allowed' : 'pointer',
              opacity: !!loadingCount ? 0.6 : 1,
            }}
          >
            <InsertDriveFileOutlined sx={{ mb: 1, fontSize: 36, color: '#777' }} />
            <Typography sx={{ fontFamily: 'inherit' }}>
              {!!loadingCount ? 'Translation in progress...' : 'Click to Upload or Drag File'}
            </Typography>
          </Box>

          <input
            id="fileInput"
            type="file"
            accept=".docx"
            multiple={multiSourceMode}
            hidden
            onChange={handleFileChange}
          />

          {files.length > 0 && (
            <Box sx={{ mt: 1, width: '100%' }}>
              {multiSourceMode ? (
                <List dense>
                  {files.map((fileItem, index) => (
                    <ListItem
                      key={index}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          onClick={() => removeFile(index)}
                          disabled={!!loadingCount}
                          size="small"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <Radio
                        checked={originFileIndex === index}
                        onChange={() => setOriginFileIndex(index)}
                        disabled={!!loadingCount}
                        sx={{ mr: 1 }}
                      />
                      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <ListItemText
                          primary={fileItem.file.name}
                          secondary={originFileIndex === index ? '(Origin source)' : ''}
                        />
                        <TextField
                          select
                          label="Language"
                          value={fileItem.language || ''}
                          onChange={(e) => updateFileLanguage(index, e.target.value)}
                          size="small"
                          disabled={!!loadingCount}
                          sx={{ width: 150, fontFamily: 'Kanit, sans-serif' }}
                          InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
                        >
                          {LANGUAGES.map((lang) => (
                            <MenuItem key={lang.code} value={lang.code}>
                              <Typography sx={{ fontFamily: 'inherit' }}>{lang.label}</Typography>
                            </MenuItem>
                          ))}
                        </TextField>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" sx={{ fontFamily: 'inherit', textAlign: 'left' }}>
                  {file?.name}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {/* Translate Section */}
        <Divider orientation="vertical" flexItem sx={{ borderColor: '#ccc', mx: 1 }} />

        <Box gap={2}>
          {!loadingCount ? (
              <Box gap={2}>
                <Button
                  variant={stepByStep ? "contained" : "outlined"}
                  onClick={() => handleSubmit(!stepByStep)}
                  sx={{ width: 200, height: 40, fontFamily: 'inherit' }}
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
