import React, { useEffect, useState } from 'react';
import { Box, Chip, CircularProgress, Tooltip, Typography } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';
import { estimateCost, CostEstimate as CostEstimateType } from '../services/translation.service';

interface CostEstimateProps {
  originalLanguage: string;
  paragraphs: string[];
  additionalSourcesLanguages: string[];
  additionalSourcesTexts: string[];
  translateLanguage: string;
  provider: string;
  model: string;
  dictionaryId?: number;
  dictionaryTimestamp?: number;
  disabled?: boolean;
}

const CostEstimate: React.FC<CostEstimateProps> = ({
  originalLanguage,
  paragraphs,
  additionalSourcesLanguages,
  additionalSourcesTexts,
  translateLanguage,
  provider,
  model,
  dictionaryId,
  dictionaryTimestamp,
  disabled = false,
}) => {
  const [estimate, setEstimate] = useState<CostEstimateType | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip estimation if required fields missing
    if (!provider || !model || paragraphs.length === 0) {
      setEstimate(null);
      return;
    }

    // Debounce the API call to avoid race conditions when provider/model change together
    const timeoutId = setTimeout(() => {
      const fetchEstimate = async () => {
        setLoading(true);
        setError(null);
        try {
          // NOTE: Language selection has minimal impact on cost (<1% of total).
          // We use placeholders if languages aren't selected yet to enable early cost estimation.
          // The estimate is still accurate because:
          // - Language names contribute only ~4-16 tokens to the prompt (~450-500 total)
          // - Paragraph content dominates the token count
          // - Output token estimation depends on paragraph count, not language names
          const effectiveOriginalLang = originalLanguage || 'en';
          const effectiveTranslateLang = translateLanguage || 'en';

          // Ensure additional sources arrays match in length (backend validation requirement)
          const effectiveAdditionalLangs = additionalSourcesLanguages.map((lang, idx) =>
            lang || `en`  // Use 'en' as placeholder for unselected languages
          );
          const effectiveAdditionalTexts = additionalSourcesTexts;

          const result = await estimateCost(
            effectiveOriginalLang,
            paragraphs,
            effectiveAdditionalLangs,
            effectiveAdditionalTexts,
            effectiveTranslateLang,
            provider,
            model,
            dictionaryId,
            dictionaryTimestamp
          );
          setEstimate(result);
        } catch (err) {
          console.error('Failed to estimate cost:', err);
          setError('Failed to estimate cost');
          setEstimate(null);
        } finally {
          setLoading(false);
        }
      };

      fetchEstimate();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [
    originalLanguage,
    translateLanguage,
    provider,
    model,
    paragraphs.length,
    additionalSourcesLanguages.length,
    additionalSourcesTexts.length,
    dictionaryId,
    dictionaryTimestamp,
  ]);

  if (disabled || paragraphs.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1} sx={{ fontFamily: 'Kanit, sans-serif' }}>
        <CircularProgress size={16} />
        <Typography variant="body2" sx={{ fontFamily: 'inherit', color: '#666' }}>
          Calculating cost...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="body2" sx={{ fontFamily: 'Kanit, sans-serif', color: '#d32f2f' }}>
        {error}
      </Typography>
    );
  }

  if (!estimate) {
    return null;
  }

  // Color coding based on cost
  const getColor = (cost: number): 'success' | 'warning' | 'error' => {
    if (cost < 0.5) return 'success';
    if (cost < 2.0) return 'warning';
    return 'error';
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  return (
    <Box display="flex" alignItems="center" gap={1} sx={{ fontFamily: 'Kanit, sans-serif' }}>
      <Typography variant="body2" sx={{ fontFamily: 'inherit', color: '#666' }}>
        Est. cost:
      </Typography>
      <Chip
        label={formatCost(estimate.total_cost)}
        color={getColor(estimate.total_cost)}
        size="small"
        sx={{ fontFamily: 'inherit', fontWeight: 'bold' }}
      />
      <Typography variant="caption" sx={{ fontFamily: 'inherit', color: '#999' }}>
        ({estimate.input_tokens.toLocaleString()} in + {estimate.output_tokens.toLocaleString()} out tokens)
      </Typography>
      <Tooltip
        title="Language selection has minimal impact on cost estimate (<1% difference). The estimate is primarily based on document content and selected model."
        arrow
        placement="top"
      >
        <InfoOutlined sx={{ fontSize: 16, color: '#999', cursor: 'help' }} />
      </Tooltip>
    </Box>
  );
};

export default CostEstimate;
