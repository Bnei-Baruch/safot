import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Divider,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { LANGUAGES } from '../constants/languages'
import { useToast } from './Toast';
import { TranslateFormProps } from '../types/frontend-types';
import { useUser } from '../contexts/UserContext';


const TranslateForm: React.FC<TranslateFormProps> = ({ onSubmit, loading = false }) => {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState('');
  const [targetLang, setTargetLang] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const { showToast } = useToast();
  const { permissions } = useUser();

  const handleFileClick = () => {
    if (!permissions.hasRole('safot-write')) {
      showToast(permissions.getAuthMessage("upload files", "safot-write"), 'warning');
      return;
    }
    document.getElementById('fileInput')?.click();
  };

  const processUploadedFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      showToast('❌ Only .docx files are supported.', 'error');
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

  const handleSubmit = async (stepByStep = false) => {
    setSubmitAttempted(true);
    if (!file || !sourceLang || !targetLang) return;
    const name = file.name.replace(/\.docx$/, '');
    showToast('📄 Processing file...', 'info');
    try {
      await onSubmit({ 
        file, 
        name, 
        source_language: sourceLang, 
        target_language: targetLang,
        step_by_step: stepByStep
      });
      showToast('✅ Translation completed', 'success');
    } catch {
      showToast('❌ Something went wrong', 'error');
    }
  };

  return (
    <Paper
      sx={{
        p: 4,
        backgroundColor: '#ffffff',
        borderRadius: 2,
        fontFamily: 'Kanit, sans-serif',
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box>
          {/* Language Selection */}
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <TextField
              select
              label="From Language"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              variant="outlined"
              error={submitAttempted && !sourceLang}
              helperText={submitAttempted && !sourceLang ? 'Required' : ' '}
              disabled={loading}
              sx={{ width: 160, fontFamily: 'Kanit, sans-serif' }}
              InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
              size="small"
            >
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  <Typography sx={{ fontFamily: 'inherit' }}>{lang.label}</Typography>
                </MenuItem>
              ))}
            </TextField>

            <ArrowForwardIcon sx={{ color: '#ccc', pb:3 }} />
            
            <TextField
              select
              label="To Language"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              variant="outlined"
              error={submitAttempted && !targetLang}
              helperText={submitAttempted && !targetLang ? 'Required' : ' '}
              disabled={loading}
              sx={{ width: 160, fontFamily: 'Kanit, sans-serif' }}
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
            onClick={loading || !permissions.hasRole('safot-write') ? undefined : handleFileClick}
            onDrop={loading || !permissions.hasRole('safot-write') ? undefined : handleDrop}
            onDragOver={(e) => e.preventDefault()}
            sx={{
              width: 300,
              height: 160,
              border: '2px dashed #bbb',
              borderRadius: 2,
              backgroundColor: loading || !permissions.hasRole('safot-write') ? '#f0f0f0' : '#f5f5f5',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading || !permissions.hasRole('safot-write') ? 'not-allowed' : 'pointer',
              mt: 0,
              opacity: loading || !permissions.hasRole('safot-write') ? 0.6 : 1,
            }}
          >
            <InsertDriveFileOutlinedIcon sx={{ mb: 1, fontSize: 36, color: '#777' }} />
            <Typography sx={{ fontFamily: 'inherit' }}>
              {loading ? 'Translation in progress...' : 
               !permissions.hasRole('safot-write') ? 'Upload disabled - Read-only access' : 
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

        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          gap={2}
          flex={1}
          minHeight={200}
        >
          {!loading ? (
              <Box display="flex" flexDirection="column" gap={2} alignItems="center">
                {/* Authorization warning for read-only users */}
                {!permissions.hasRole('safot-write') && (
                  <Alert severity="info" sx={{ mb: 1, maxWidth: 400 }}>
                    {permissions.getAuthMessage("upload files and translate", "safot-write")}
                  </Alert>
                )}
                
                <Box display="flex" gap={2}>
                  <Tooltip title={permissions.hasRole('safot-write') ? "Translate file" : permissions.getAuthMessage("translate files", "safot-write")}>
                    <span>
                      <Button
                        variant="contained"
                        onClick={() => handleSubmit()}
                        disabled={loading || !permissions.hasRole('safot-write')}
                        sx={{ width: 180, height: 40, fontFamily: 'inherit' }}
                      >
                        Translate
                      </Button>
                    </span>
                  </Tooltip>

                  <Tooltip title={permissions.hasRole('safot-write') ? "Translate file step by step" : permissions.getAuthMessage("translate files step by step", "safot-write")}>
                    <span>
                      <Button
                        variant="outlined"
                        onClick={() => handleSubmit(true)}
                        disabled={loading || !permissions.hasRole('safot-write')}
                        sx={{ width: 220, height: 40, fontFamily: 'inherit' }}
                      >
                        Translate Step by Step
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
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
