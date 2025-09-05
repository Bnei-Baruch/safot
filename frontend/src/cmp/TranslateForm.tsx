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
  Alert,
  Tooltip,
} from '@mui/material';
import {
  ArrowDropDown,
  ArrowForward,
  InsertDriveFileOutlined,
} from '@mui/icons-material';

import { LANGUAGES } from '../constants/languages'
import { useToast } from './Toast';
import { useFlow } from '../useFlow';
import { useUser } from '../contexts/UserContext';

const LANG_STYLE = {
  width: 150,
  fontFamily: 'Kanit, sans-serif',
};

const TranslateForm: React.FC = () => {
  const navigate = useNavigate();
  const { permissions } = useUser();

  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState<string>('');
  const [targetLang, setTargetLang] = useState<string>('');
  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);
  const { showToast } = useToast();
  const [stepByStep, setStepByStep] = useState<boolean>(true);
  const { translateFile, loadingCount } = useFlow();

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
        /*step_by_step*/ !all
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

  return (
    <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2, fontFamily: 'Kanit, sans-serif' }}>
      {/* Authorization warning for read-only users */}
      {!permissions.hasRole('safot-write') && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {permissions.getAuthMessage("translate files", "safot-write")}
        </Alert>
      )}
      
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
            onClick={!!loadingCount || !permissions.hasRole('safot-write') ? undefined : handleFileClick}
            onDrop={!!loadingCount || !permissions.hasRole('safot-write') ? undefined : handleDrop}
            onDragOver={(e) => e.preventDefault()}
            sx={{
              width: '100%',
              height: 120,
              border: '2px dashed #bbb',
              borderRadius: 2,
              backgroundColor: !!loadingCount || !permissions.hasRole('safot-write') ? '#f0f0f0' : '#f5f5f5',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !!loadingCount || !permissions.hasRole('safot-write') ? 'not-allowed' : 'pointer',
              opacity: !!loadingCount || !permissions.hasRole('safot-write') ? 0.6 : 1,
            }}
          >
            <InsertDriveFileOutlined sx={{ mb: 1, fontSize: 36, color: '#777' }} />
            <Typography sx={{ fontFamily: 'inherit' }}>
              {!!loadingCount ? 'Translation in progress...' : 
               !permissions.hasRole('safot-write') ? 'Upload disabled - insufficient permissions' : 
               'Click to Upload or Drag File'}
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
          {!loadingCount ? (
              <Box gap={2}>
                <Tooltip title={permissions.hasRole('safot-write') ? "Translate file" : permissions.getAuthMessage("translate files", "safot-write")}>
                  <span>
                    <Button
                      variant={stepByStep ? "contained" : "outlined"}
                      onClick={() => handleSubmit(!stepByStep)}
                      disabled={!permissions.hasRole('safot-write')}
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
                  </span>
                </Tooltip>
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