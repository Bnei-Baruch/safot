import React, { useEffect, useState } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Provider, getProviders } from '../services/provider.service';
import { useToast } from './Toast';

interface ProviderModelPickerProps {
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  sx?: any;
}

const ProviderModelPicker: React.FC<ProviderModelPickerProps> = ({
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  disabled = false,
  size = 'small',
  sx = {},
}) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState<boolean>(false);
  const { showToast } = useToast();

  useEffect(() => {
    const loadProviders = async () => {
      setProvidersLoading(true);
      try {
        const fetchedProviders = await getProviders();
        setProviders(fetchedProviders);

        // Set default provider and model if not already set
        if (fetchedProviders.length > 0 && !selectedProvider) {
          const defaultProvider = fetchedProviders[0];
          onProviderChange(defaultProvider.value);
          onModelChange(defaultProvider.models[0].value);
        }
      } catch (err) {
        console.error('Failed to load providers:', err);
        showToast('Failed to load translation providers', 'error');
      } finally {
        setProvidersLoading(false);
      }
    };
    loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  // Update model when provider changes
  useEffect(() => {
    if (providers.length === 0) return;

    const provider = providers.find(p => p.value === selectedProvider);
    if (provider && !provider.models.find(m => m.value === selectedModel)) {
      onModelChange(provider.models[0].value);
    }
  }, [selectedProvider, providers, selectedModel, onModelChange]);

  if (providersLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" sx={sx}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, ...sx }}>
      {/* Provider Selection */}
      <TextField
        select
        label="AI Provider"
        value={selectedProvider}
        onChange={(e) => onProviderChange(e.target.value)}
        disabled={disabled || providers.length === 0}
        sx={{ width: '100%', fontFamily: 'Kanit, sans-serif' }}
        InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
        size={size}
      >
        {providers.map((provider) => (
          <MenuItem key={provider.value} value={provider.value}>
            <Typography sx={{ fontFamily: 'inherit' }}>{provider.label}</Typography>
          </MenuItem>
        ))}
      </TextField>

      {/* Model Selection */}
      <TextField
        select
        label="Model"
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={disabled || providers.length === 0}
        sx={{ width: '100%', fontFamily: 'Kanit, sans-serif' }}
        InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
        size={size}
      >
        {providers.find(p => p.value === selectedProvider)?.models.map((model) => (
          <MenuItem key={model.value} value={model.value}>
            <Box>
              <Typography sx={{ fontFamily: 'inherit', fontSize: '0.875rem' }}>
                {model.label}
              </Typography>
              {model.description && (
                <Typography sx={{ fontFamily: 'inherit', fontSize: '0.75rem', color: '#666' }}>
                  {model.description}
                </Typography>
              )}
            </Box>
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
};

export default ProviderModelPicker;
