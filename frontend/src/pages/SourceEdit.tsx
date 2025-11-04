import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from "react-router-dom";

import { TableVirtuoso } from "react-virtuoso";
import Split from "react-split";

import {
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  Paper,
  Table,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  ArrowBackIosNew as ArrowBackIosNewIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  MenuBook as MenuBookIcon,
  Save as SaveIcon,
  Translate as TranslateIcon,
} from '@mui/icons-material';

import { buildSegment, exportTranslationDocx } from '../services/segment.service';
import { useAppDispatch, useAppSelector, RootState } from '../store/store';
import { fetchSegments, saveSegments } from '../store/SegmentSlice';
import { fetchSource, addOrUpdateSource } from '../store/SourceSlice';
import Dictionary from '../cmp/Dictionary';
import { getMultiSourceInfo, MultiSourceInfo } from '../services/multi-source.service';

import { useFlow } from '../useFlow';
import { useToast } from '../cmp/Toast';
import { Segment, Source } from '../types/frontend-types';
import { LANGUAGES, LANG_DIRS } from '../constants/languages';

const getSource = (sources: Record<number, Source>, id: number | undefined): Source | undefined => (sources && id && (id in sources) && sources[id]) || undefined;

const DICTIONARY_OPEN = 'dictionary-open';
const RIGHT_PANE_SIZE = 'right-pane-size';

const Row = React.memo(({
  originalSegment,
  translatedSegment,
  translationText,
  originalLanguage,
  translatedLanguage,
  updateTranslations,
  handleSaveTranslation,
}: any) => {

  const inputStyle = useMemo(() => ({
    direction: LANG_DIRS[translatedLanguage],
    textAlign: LANG_DIRS[translatedLanguage] === 'rtl' ? 'right' : 'left'
  }), [translatedLanguage]);

  const inputProps = useMemo(() => ({ sx: inputStyle }), [inputStyle]);

  const handleChange = useCallback((e: any) => {
    updateTranslations(originalSegment.order, e.target.value);
  }, [updateTranslations, originalSegment.order]);

  const handleSave = useCallback(() => {
    handleSaveTranslation(translatedSegment, originalSegment, translationText);
  }, [handleSaveTranslation, translatedSegment, originalSegment, translationText]);
  
  const originalCellStyle = useMemo(() => ({
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    verticalAlign: 'top',
    direction: LANG_DIRS[originalLanguage],
    textAlign: LANG_DIRS[originalLanguage] === 'rtl' ? 'right' : 'left'
  }), [originalLanguage]);
  
  const translatedCellStyle = useMemo(() => ({
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    verticalAlign: 'top',
    direction: LANG_DIRS[translatedLanguage],
    textAlign: LANG_DIRS[translatedLanguage] === 'rtl' ? 'right' : 'left'
  }), [translatedLanguage]);

  return (
    <>
      <TableCell>{originalSegment.order}</TableCell>
      <TableCell sx={originalCellStyle}>
        {originalSegment.text}
      </TableCell>
      <TableCell sx={translatedCellStyle}>
        <TextField
          fullWidth
          multiline
          minRows={1}
          maxRows={30}
          value={translationText || ''}
          onChange={handleChange}
          placeholder="Enter translation"
          inputProps={inputProps}
        />
      </TableCell>
      <TableCell>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={translatedSegment && translationText === translatedSegment.text}
        >
          <SaveIcon />
        </Button>
      </TableCell>
    </>
  );
});

const SourceEdit: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const { translateSegments, loadingCount } = useFlow();

  const { id } = useParams<{ id: string }>();
  const translatedSourceId = id ? parseInt(id, 10) : undefined;

  const { sources } = useAppSelector((state: RootState) => state.sources);

  const translatedSource = useMemo(() => getSource(sources, translatedSourceId), [sources, translatedSourceId]);
  const translatedLanguage = translatedSource?.language || 'en';
  const originalSourceId = translatedSource?.original_source_id || undefined;
  const originalSource = useMemo(() => getSource(sources, originalSourceId), [sources, originalSourceId]);
  const originalLanguage = originalSource?.language || 'en';

  const { segments } = useAppSelector((state: RootState) => state.segments);
  const translatedSegmentsByOrder = useMemo(() => ((translatedSourceId && segments[translatedSourceId]) || [])
  .reduce((acc: Record<number, Segment>, s: Segment): Record<number, Segment> => {
    acc[s.order] = s;
    return acc;
  }, {}), [segments, translatedSourceId]);

  // Maps translated segments order to text area value.
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [titleEditing, setTitleEditing] = useState<{original: string, translated: string} | null>(null);
  const [multiSourceInfo, setMultiSourceInfo] = useState<MultiSourceInfo | null>(null);

  const [dictionaryOpen, setDictionaryOpen] = useState<boolean>(
              localStorage.getItem(DICTIONARY_OPEN) === "true" || false);
  const [rightPaneSize, setRightPaneSize] = useState<number>(
              Number(localStorage.getItem(RIGHT_PANE_SIZE) || "0") || 40);

  useEffect(() => {
    if (translatedSourceId && !(translatedSourceId in sources)) {
      dispatch(fetchSource({ id: translatedSourceId }));
    }
    if (originalSourceId && !(originalSourceId in sources)) {
      dispatch(fetchSource({ id: originalSourceId }));
    }
  }, [dispatch, translatedSourceId, originalSourceId, sources]);

  // Load initial segments when source IDs are available
  useEffect(() => {
    if (originalSourceId && translatedSourceId) {
      dispatch(fetchSegments({ source_id: originalSourceId }));
      dispatch(fetchSegments({ source_id: translatedSourceId }));
    }
  }, [dispatch, originalSourceId, translatedSourceId]);

  const fetchMultiSourceInfo = useCallback(() => {
    if (translatedSourceId) {
      getMultiSourceInfo(translatedSourceId)
        .then(info => setMultiSourceInfo(info))
        .catch(error => {
          console.error('Error fetching multi-source info:', error);
          setMultiSourceInfo(null);
        });
    } else {
      setMultiSourceInfo(null);
    }
  }, [translatedSourceId]);

  // Fetch multi-source info when translated source is available
  useEffect(() => {
    fetchMultiSourceInfo();
  }, [fetchMultiSourceInfo]);

  useEffect(() => {
    if (translatedSourceId && segments[translatedSourceId]) {
      setTranslations(segments[translatedSourceId].reduce((acc: Record<number, string>, s: Segment): Record<number, string> => {
        acc[s.order] = s.text;
        return acc;
      }, {}));
    }
  }, [translatedSourceId, segments]);

  const handleTranslateMore = useCallback(async () => {
    showToast('Translating more...', 'info');
    try {
      if (!originalSourceId || !translatedSourceId) {
        return;
      }
      // Make sure all segments are saved?!
      const segmentsToTranslate = [];
      for (const originalSegment of segments[originalSourceId]) {
        if (!translatedSegmentsByOrder[originalSegment.order] && !translations[originalSegment.order]) {
          segmentsToTranslate.push(originalSegment);
        }
        if (segmentsToTranslate.length >= 10) {
          break;
        }
      };
      await translateSegments(segmentsToTranslate, translatedSourceId, originalLanguage, translatedLanguage);
      showToast('Translation completed', 'success');
      dispatch(fetchSegments({ source_id: translatedSourceId }));
    } catch (error) {
      if (error instanceof Error) {
        showToast('Error translating more: ' + error.message, 'error');
      } else {
        showToast('Error translating more', 'error');
      }
    }
  }, [translations, segments, translatedSegmentsByOrder, translateSegments, showToast, dispatch, translatedSourceId, translatedLanguage, originalSourceId, originalLanguage]);

  const handleSaveTranslation = useCallback(async (translatedSegment: Segment, originalSegment: Segment, text: string) => {
    if (!translatedSourceId) {
      showToast("Failed saving segment!", "error");
      return;
    }

    const segment = buildSegment({
      text,
      source_id: translatedSourceId,
      order: originalSegment.order,
      properties: {
          segment_type: translatedSegment ? "edited" : "user_translation"
      },
      id: translatedSegment?.id,
      original_segment_id: originalSegment.id,
      original_segment_timestamp: originalSegment.timestamp,
    });
   
    try {
      await dispatch(saveSegments([segment]));
      showToast("Translation saved successfully!", "success");
    } catch (error) {
      console.error("Error saving translation:", error);
      showToast("Failed to save translation. Please try again.", "error");
    }
  }, [dispatch, showToast, translatedSourceId]);

  const getLanguageName = (code: string): string => {
    const lang = LANGUAGES.find((language) => language.code === code);
    return (lang && lang.label) || 'Unknown';
  };

  const handleExportDocx = async () => {
    if (!translatedSourceId) return;

    try {
      const blob = await exportTranslationDocx(translatedSourceId);
      if (!(blob instanceof Blob)) {
        throw new Error("Response is not a valid Blob");
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${translatedSource?.name || "translated"}_${translatedLanguage}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Document exported successfully!", "success");
    } catch (error) {
      console.error("Error exporting document:", error);
      showToast("Failed to export document. Please try again.", "error");
    }
  };

  // Use debounce to update translations only after user stops typing.
  const updateTranslations = useMemo(() => (order: number, value: string) => {
    setTranslations(prev => ({
      ...prev,
      [order]: value,
    }));
  }, [setTranslations]);

  const countSegments = () => {
    const translatedLength = (translatedSourceId && segments[translatedSourceId] && segments[translatedSourceId].length) || 0;
    const originalLength = originalSourceId && segments[originalSourceId] && segments[originalSourceId].length;
    if (!originalLength) {
      return null;
    }
    return `${translatedLength}/${originalLength}`;
  }

  const data = useMemo(
    () => (originalSourceId && segments[originalSourceId]) || [],
    [originalSourceId, segments]
  );

  const fixedHeaderContent = useCallback(() => {
    const multiSourceLanguages = multiSourceInfo?.is_multi_source 
      ? multiSourceInfo.sources
          .map(s => getLanguageName(s.language))
          .filter((lang, index, self) => self.indexOf(lang) === index) // Remove duplicates
          .join(', ')
      : null;

    return (
      <TableRow sx={{ backgroundColor: 'white' }}>
        <TableCell>Order</TableCell>
        <TableCell style={{ width: '40%' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box component="span">Source ({(originalSource && getLanguageName(originalLanguage)) || 'Unknown'})</Box>
            {multiSourceInfo?.is_multi_source && multiSourceLanguages && (
              <Chip
                label={`Multi-source: ${multiSourceLanguages}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ 
                  fontSize: '0.7rem',
                  height: '20px',
                  alignSelf: 'flex-start'
                }}
                title={`Multi-source translation using languages: ${multiSourceLanguages}`}
              />
            )}
          </Box>
        </TableCell>
        <TableCell style={{ width: '50%' }}>
          Translation ({getLanguageName(translatedLanguage)})
        </TableCell>
        <TableCell style={{ width: '10%' }}>Actions</TableCell>
      </TableRow>
    );
  }, [originalSource, originalLanguage, translatedLanguage, multiSourceInfo]);

  const context = {
    translations,
    translatedSegmentsByOrder,
    originalLanguage,
    translatedLanguage,
    updateTranslations,
    handleSaveTranslation,
  };

  const itemContent = useCallback((index: number, originalSegment: Segment, context: any) => {
    const {
      translations,
      translatedSegmentsByOrder,
      originalLanguage,
      translatedLanguage,
      updateTranslations,
      handleSaveTranslation,
    } = context;

    // TODO: Original segment might not match by timestamp with 
    // translatedSegment.original_segment_timestamp, in that case we should notify
    // user that the origin has a new version to allow rebasing translation to a newer source.
    const translatedSegment = translatedSegmentsByOrder[originalSegment.order];
    const translationText = translations[originalSegment.order];
    
    return (
      <Row
        originalSegment={originalSegment}
        translatedSegment={translatedSegment}
        translationText={translationText}
        originalLanguage={originalLanguage}
        translatedLanguage={translatedLanguage}
        updateTranslations={updateTranslations}
        handleSaveTranslation={handleSaveTranslation}
      />
    );
  }, []);

  const VirtuosoTableComponent = useCallback((props: any) => (
    <Table stickyHeader {...props} />
  ), []);

  const virtuosoComponents = useMemo(() => ({
    Table: VirtuosoTableComponent
  }), [VirtuosoTableComponent]);
  
  return (
    <Box sx={{ backgroundColor: '#f5f5f5', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      <Split
        sizes={[
          !dictionaryOpen ? 100 : rightPaneSize,
          !dictionaryOpen ? 0 : 100-rightPaneSize,
        ]}
        minSize={200}
        gutterSize={6}
        direction="horizontal"
        className={`split ${dictionaryOpen ? "open" : "close"}`}
        onDrag={(next: number[]) => {
          setRightPaneSize(next[0]);
        }}
        onDragEnd={(final: number[]) => {
          setRightPaneSize(final[0]);
          localStorage.setItem(RIGHT_PANE_SIZE, final[0].toString());
        }}
      >
        <Container maxWidth="lg" sx={{ minWidth: '450px'}}>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
            <Button
              onClick={() => navigate('/')}
              startIcon={<ArrowBackIosNewIcon />}
              sx={{ color: '#1976d2', textTransform: 'none', fontWeight: 'bold', whiteSpace: 'nowrap' }}
            >
              Back to sources
            </Button>
            <Box display="flex" gap={2}>
              <Tooltip title="Download docx" arrow>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleExportDocx}
                >
                  DOCX
                </Button>
              </Tooltip>
              <Tooltip title="Translate more" arrow>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleTranslateMore}
                  disabled={!!loadingCount}
                >
                  <TranslateIcon />
                </Button>
              </Tooltip>
              <Tooltip title={`${dictionaryOpen ? "Close" : "Open"} dictionary pane`} arrow>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    localStorage.setItem(DICTIONARY_OPEN, !dictionaryOpen ? "true" : "false");
                    setDictionaryOpen(!dictionaryOpen);
                  }}
                >
                <MenuBookIcon />
                  {!dictionaryOpen && <ChevronLeftIcon />}
                  {dictionaryOpen && <ChevronRightIcon />}
                </Button>
              </Tooltip>
            </Box>
          </Box>
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 'bold',
                fontFamily: 'inherit',
                my: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
                {titleEditing === null && <>
                  {originalSource?.name}
                  <ArrowForwardIcon fontSize="large" sx={{ verticalAlign: 'bottom', mx: 2 }} />
                  {translatedSource?.name}
                  <IconButton onClick={() => setTitleEditing({translated: translatedSource?.name || '', original: originalSource?.name || ''})} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                </>}
                {titleEditing !== null && <>
                  <TextField
                    variant="standard"
                    InputProps={{ sx: (theme) => ({ ...theme.typography.h6, fontWeight: 'bold', minWidth: '350px' }) }}
                    value={titleEditing.original}
                    onChange={(e) => setTitleEditing({original: e.target.value, translated: titleEditing.translated})}
                    autoFocus
                    error={titleEditing.original.trim() === ""}
                    helperText={titleEditing.original.trim() === "" ? "Title is required" : ""}
                  />
                  <ArrowForwardIcon fontSize="large" sx={{ verticalAlign: 'bottom', mx: 2 }} />
                  <TextField
                    variant="standard"
                    InputProps={{ sx: (theme) => ({ ...theme.typography.h6, fontWeight: 'bold', minWidth: '350px' }) }}
                    value={titleEditing.translated}
                    onChange={(e) => setTitleEditing({original: titleEditing.original, translated: e.target.value})}
                    autoFocus
                    error={titleEditing.translated.trim() === ""}
                    helperText={titleEditing.translated.trim() === "" ? "Title is required" : ""}
                  />
                  <IconButton
                    disabled={titleEditing.original.trim() === "" || titleEditing.translated.trim() === ""}
                    onClick={async () => {
                      if (translatedSource && translatedSource.id && translatedSource.name !== titleEditing.translated) {
                        await dispatch(addOrUpdateSource({ ...translatedSource, name: titleEditing.translated }));
                      }
                      if (originalSource && originalSource.id && originalSource.name !== titleEditing.original) {
                        await dispatch(addOrUpdateSource({ ...originalSource, name: titleEditing.original }));
                      }
                      setTitleEditing(null);
                    }} size="small">
                    <CheckIcon fontSize="small" />
                  </IconButton>
                  <IconButton onClick={() => setTitleEditing(null)} size="small">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </>}
                &nbsp;&nbsp;&nbsp;&nbsp;
                {countSegments()}
            </Typography>
          </Box>
    
          {/* Scrollable table */}

          <Box>
            <TableContainer component={Paper} className="edit-virtuoso-height">
              <TableVirtuoso
                data={data}
                fixedHeaderContent={fixedHeaderContent}
                itemContent={itemContent}
                context={context}
                components={virtuosoComponents}
              />
            </TableContainer>
          </Box>
        </Container>
        <Container maxWidth="lg"  sx={{ minWidth: '350px' }} className="right-side-pane">
          {translatedSource && <Dictionary
            source={translatedSource}
            sourceUpdated={() => {
              if (translatedSourceId) {
                dispatch(fetchSource({ id: translatedSourceId }));
              }
            }}
          />}
        </Container>
      </Split>
    </Box>
  );
};

export default SourceEdit;
