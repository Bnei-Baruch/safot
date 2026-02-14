import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
  Divider,
} from '@mui/material';
import ProviderModelPicker from './ProviderModelPicker';
import CostEstimate from './CostEstimate';

interface TranslationDialogProps {
  open: boolean;
  onClose: () => void;
  onTranslate: (provider: string, model: string, translateAll: boolean) => void;
  defaultProvider?: string;
  defaultModel?: string;
  disabled?: boolean;
  // Cost estimation parameters
  originalLanguage?: string;
  paragraphs?: string[];
  additionalSourcesLanguages?: string[];
  additionalSourcesTexts?: string[];
  translateLanguage?: string;
  dictionaryId?: number;
  dictionaryTimestamp?: number;
}

const TranslationDialog: React.FC<TranslationDialogProps> = ({
  open,
  onClose,
  onTranslate,
  defaultProvider = 'openai',
  defaultModel = 'gpt-4o',
  disabled = false,
  originalLanguage = '',
  paragraphs = [],
  additionalSourcesLanguages = [],
  additionalSourcesTexts = [],
  translateLanguage = '',
  dictionaryId,
  dictionaryTimestamp,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>(defaultProvider);
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);
  const [translateAll, setTranslateAll] = useState<boolean>(false);

  // Update local state when defaults change
  React.useEffect(() => {
    setSelectedProvider(defaultProvider);
    setSelectedModel(defaultModel);
  }, [defaultProvider, defaultModel]);

  const handleTranslate = () => {
    onTranslate(selectedProvider, selectedModel, translateAll);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: 'Kanit, sans-serif' }}>
        Translation Options
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          {/* Provider and Model Selection */}
          <ProviderModelPicker
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onProviderChange={setSelectedProvider}
            onModelChange={setSelectedModel}
            disabled={disabled}
            size="medium"
          />

          {/* Translation Mode */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontFamily: 'Kanit, sans-serif' }}>
              Translation Mode
            </Typography>
            <RadioGroup
              value={translateAll ? 'all' : 'few'}
              onChange={(e) => setTranslateAll(e.target.value === 'all')}
            >
              <FormControlLabel
                value="few"
                control={<Radio />}
                label={
                  <Box>
                    <Typography sx={{ fontFamily: 'Kanit, sans-serif', fontWeight: 'bold' }}>
                      Translate few more segments (Default)
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'Kanit, sans-serif', color: '#666' }}>
                      Translate the next 10 untranslated segments
                    </Typography>
                  </Box>
                }
                disabled={disabled}
              />
              <FormControlLabel
                value="all"
                control={<Radio />}
                label={
                  <Box>
                    <Typography sx={{ fontFamily: 'Kanit, sans-serif', fontWeight: 'bold' }}>
                      Translate ALL remaining segments
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'Kanit, sans-serif', color: '#666' }}>
                      Translate all untranslated segments in one go
                    </Typography>
                  </Box>
                }
                disabled={disabled}
              />
            </RadioGroup>
          </Box>

          {/* Cost Estimate */}
          {paragraphs.length > 0 && originalLanguage && translateLanguage && (
            <>
              <Divider />
              <CostEstimate
                originalLanguage={originalLanguage}
                paragraphs={translateAll ? paragraphs : paragraphs.slice(0, 10)}
                additionalSourcesLanguages={additionalSourcesLanguages}
                additionalSourcesTexts={additionalSourcesTexts}
                translateLanguage={translateLanguage}
                provider={selectedProvider}
                model={selectedModel}
                dictionaryId={dictionaryId}
                dictionaryTimestamp={dictionaryTimestamp}
                disabled={disabled}
              />
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={disabled} sx={{ fontFamily: 'Kanit, sans-serif' }}>
          Cancel
        </Button>
        <Button
          onClick={handleTranslate}
          variant="contained"
          color="primary"
          disabled={disabled}
          sx={{ fontFamily: 'Kanit, sans-serif' }}
        >
          Translate
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TranslationDialog;
