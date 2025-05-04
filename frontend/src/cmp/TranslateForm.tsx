import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Divider,
  CircularProgress
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { LANGUAGES } from '../constants/languages'
import { useToast } from './Toast';
import { TranslateFormProps } from '../types/frontend-types';


const TranslateForm: React.FC<TranslateFormProps> = ({ onSubmit }) => {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState('');
  const [targetLang, setTargetLang] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleFileClick = () => {
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

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (!file || !sourceLang || !targetLang) return;
    const name = file.name.replace(/\.docx$/, '');
    setLoading(true);
    showToast('📄 Processing file...', 'info');
    try {
      await onSubmit({ file, name, source_language: sourceLang, target_language: targetLang });
      showToast('✅ Translation completed', 'success');
    } catch {
      showToast('❌ Something went wrong', 'error');
    } finally {
      setLoading(false);
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
            onClick={handleFileClick}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            sx={{
              width: 300,
              height: 160,
              border: '2px dashed #bbb',
              borderRadius: 2,
              backgroundColor: '#f5f5f5',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              mt: 0,
            }}
          >
            <InsertDriveFileOutlinedIcon sx={{ mb: 1, fontSize: 36, color: '#777' }} />
            <Typography sx={{ fontFamily: 'inherit' }}>Click to Upload or Drag File</Typography>
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
            <Button
              variant="contained"
              onClick={handleSubmit}
              sx={{ width: 180, height: 40, fontFamily: 'inherit' }}
            >
              Translate
            </Button>
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
