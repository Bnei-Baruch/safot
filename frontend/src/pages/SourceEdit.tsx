import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from "react-router-dom";

import { TableVirtuoso } from "react-virtuoso";
import Split from "react-split";

import {
  Box,
  Button,
  Container,
  IconButton,
  Paper,
  Popover,
  Switch,
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
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

import { buildSegment, exportTranslationDocx } from '../services/segment.service';
import type { ExtractTextResult } from '../services/segment.service';
import { useAppDispatch, useAppSelector, RootState } from '../store/store';
import { fetchSegments, saveSegments } from '../store/SegmentSlice';
import { fetchSource, addOrUpdateSource } from '../store/SourceSlice';
import { fetchDictionaries } from '../store/DictionarySlice';
import Dictionary from '../cmp/Dictionary';

import { formatShortDateTime } from '../cmp/Utils';
import { useFlow } from '../useFlow';
import { useToast } from '../cmp/Toast';
import { Segment, Source, OriginSource } from '../types/frontend-types';
import { LANGUAGES, LANG_DIRS } from '../constants/languages';

const getSource = (sources: Record<number, Source>, id: number | undefined): Source | undefined => (sources && id && (id in sources) && sources[id]) || undefined;

const LANGUAGE_COLUMN_WIDTH = 260;
const TRANSLATION_COLUMN_WIDTH = 320;
const ORDER_COLUMN_WIDTH = 20;
const ACTIONS_COLUMN_WIDTH = 30;

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
  isOriginalSourceVisible,
  additionalVisibleSources,
  additionalSourceSegments,
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
      <TableCell sx={{ width: ORDER_COLUMN_WIDTH, minWidth: ORDER_COLUMN_WIDTH }}>{originalSegment.order}</TableCell>
      {isOriginalSourceVisible && (
        <TableCell sx={{ ...originalCellStyle, width: LANGUAGE_COLUMN_WIDTH, minWidth: LANGUAGE_COLUMN_WIDTH }}>
          {originalSegment.text}
        </TableCell>
      )}
      {additionalVisibleSources.map((sourceLang: { id: number; language: string }) => {
        const sourceSegments = additionalSourceSegments[sourceLang.id] || [];
        const segment = sourceSegments.find((s: Segment) => s.order === originalSegment.order);
        const cellStyle = {
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          verticalAlign: 'top',
          direction: LANG_DIRS[sourceLang.language],
          textAlign: LANG_DIRS[sourceLang.language] === 'rtl' ? 'right' : 'left',
          width: LANGUAGE_COLUMN_WIDTH,
          minWidth: LANGUAGE_COLUMN_WIDTH,
        };
        
        return (
          <TableCell key={sourceLang.id} sx={cellStyle}>
            {segment?.text || ''}
          </TableCell>
        );
      })}
      <TableCell sx={{ ...translatedCellStyle, width: TRANSLATION_COLUMN_WIDTH, minWidth: TRANSLATION_COLUMN_WIDTH }}>
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
      <TableCell sx={{ width: ACTIONS_COLUMN_WIDTH, minWidth: ACTIONS_COLUMN_WIDTH }}>
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
  const { createDefaultDict, translateSegments, loadingCount } = useFlow();

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

  const [dictionaryOpen, setDictionaryOpen] = useState<boolean>(
              localStorage.getItem(DICTIONARY_OPEN) === "true" || false);
  const [rightPaneSize, setRightPaneSize] = useState<number>(
              Number(localStorage.getItem(RIGHT_PANE_SIZE) || "0") || 40);
  
  // State for visible languages popover
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [visibleSourceLanguages, setVisibleSourceLanguages] = useState<OriginSource[]>([]);
  const [initializedVisibleLanguages, setInitializedVisibleLanguages] = useState<boolean>(false);
  
  // Get all available origin sources (including the main original source)
  const availableOriginSources = useMemo(() => {
    const sources: OriginSource[] = [];
    
    // Add the original source if it exists
    if (originalSource && originalSourceId) {
      sources.push({
        id: originalSource.id,
        name: originalSource.name,
        language: originalSource.language,
      });
    }
    
    // Add all other origin sources from origin_sources (excluding duplicates)
    if (translatedSource && Array.isArray(translatedSource.origin_sources)) {
      const existingIds = new Set(sources.map(s => s.id));
      translatedSource.origin_sources.forEach((origin: OriginSource) => {
        if (!existingIds.has(origin.id)) {
          sources.push(origin);
        }
      });
    }
    
    return sources;
  }, [translatedSource?.origin_sources, originalSource, originalSourceId]);
  
  // Initialize visible languages: original source ON by default, others OFF
  useEffect(() => {
    if (!initializedVisibleLanguages && originalSource && originalSourceId) {
      const originalSourceEntry: OriginSource = {
        id: originalSource.id,
        name: originalSource.name,
        language: originalSource.language,
      };
      setVisibleSourceLanguages([originalSourceEntry]);
      setInitializedVisibleLanguages(true);
    }
  }, [originalSource, originalSourceId, initializedVisibleLanguages]);
  
  // Load segments for visible source languages
  useEffect(() => {
    visibleSourceLanguages.forEach((sourceLang: OriginSource) => {
      if (!segments[sourceLang.id]) {
        dispatch(fetchSegments({ source_id: sourceLang.id }));
      }
    });
  }, [dispatch, visibleSourceLanguages, segments]);
  
  // Check if original source is visible
  const isOriginalSourceVisible = useMemo(() => {
    if (!originalSourceId) {
      return false;
    }
    return visibleSourceLanguages.some((vsl: OriginSource) => vsl.id === originalSourceId);
  }, [visibleSourceLanguages, originalSourceId]);
  
  // Get additional sources (excluding the original source)
  const additionalVisibleSources = useMemo(() => {
    if (!originalSourceId) return visibleSourceLanguages;
    return visibleSourceLanguages.filter(
      (vsl: OriginSource) => vsl.id !== originalSourceId
    );
  }, [visibleSourceLanguages, originalSourceId]);
  
  // Get segments for additional sources organized by source_id
  const additionalSourceSegments = useMemo(() => {
    const result: Record<number, Segment[]> = {};
    visibleSourceLanguages.forEach((sourceLang: OriginSource) => {
      result[sourceLang.id] = segments[sourceLang.id] || [];
    });
    return result;
  }, [visibleSourceLanguages, segments]);

  const additionalOriginSources = useMemo(() => {
    if (!translatedSource?.origin_sources) {
      return [];
    }
    return translatedSource.origin_sources.filter(
      (origin: OriginSource) => origin.id !== originalSourceId
    );
  }, [translatedSource?.origin_sources, originalSourceId]);

  const getAdditionalSourcesRemainingText = useCallback(async (): Promise<ExtractTextResult[]> => {
    if (!additionalOriginSources.length) {
      return [];
    }

    const remainingTexts = await Promise.all(
      additionalOriginSources.map(async (origin: OriginSource) => {
        try {
          const latestSegments = await dispatch(fetchSegments({ source_id: origin.id })).unwrap();
          const temporalSegment = latestSegments.find((segment: Segment) => segment.order === 0);
          if (temporalSegment?.text?.trim()) {
            return {
              id: origin.id,
              language: origin.language,
              text: temporalSegment.text,
              properties: temporalSegment.properties || {},
            } as ExtractTextResult;
          }
        } catch (error) {
          console.error(`Failed to load segments for source ${origin.id}`, error);
          const cachedSegments = segments[origin.id];
          const temporalSegment = cachedSegments?.find((segment: Segment) => segment.order === 0);
          if (temporalSegment?.text?.trim()) {
            return {
              id: origin.id,
              language: origin.language,
              text: temporalSegment.text,
              properties: temporalSegment.properties || {},
            } as ExtractTextResult;
          }
        }
        return null;
      })
    );

    return remainingTexts.filter((item): item is ExtractTextResult => item !== null);
  }, [additionalOriginSources, dispatch, segments]);

  const languageColumnsCount = (isOriginalSourceVisible ? 1 : 0) + additionalVisibleSources.length;
  const tableMinWidth = (languageColumnsCount * LANGUAGE_COLUMN_WIDTH) + TRANSLATION_COLUMN_WIDTH;
  const shouldEnableHorizontalScroll = visibleSourceLanguages.length > 2;

  const refreshDictionary = useCallback(async (source: Source) => {
    if (source.dictionary_id) {
      const dicts = await dispatch(fetchDictionaries({dictionary_id: source.dictionary_id, skip_redux: true})).unwrap();
      if (dicts.length !== 1) {
        return false;
      }
      const latestDictionary = dicts[0];
      if (latestDictionary.timestamp !== source.dictionary_timestamp) {
        // eslint-disable-next-line no-restricted-globals
        if (confirm(`Current dictionary version is ${formatShortDateTime(source.dictionary_timestamp_epoch || 0)},` +
            ` later version exist ${formatShortDateTime(latestDictionary.timestamp_epoch || 0)}, update?`)) {
          await dispatch(addOrUpdateSource({ ...source, dictionary_timestamp: latestDictionary.timestamp }));
          return true;
        }
      }
    }
    return false;
  }, [dispatch]);

  useEffect(() => {
    if (translatedSource) {
      refreshDictionary(translatedSource);
    }
  }, [refreshDictionary, translatedSource]);

  useEffect(() => {
    if (translatedSourceId && !(translatedSourceId in sources)) {
      dispatch(fetchSource({ id: translatedSourceId }));
    }
    if (originalSourceId && !(originalSourceId in sources)) {
      dispatch(fetchSource({ id: originalSourceId }));
    }
  }, [dispatch, translatedSourceId, originalSourceId, sources]);
  
  // Refresh translated source to ensure we have origin_sources
  // This handles the case where the source was fetched before origin_sources was populated
  useEffect(() => {
    if (translatedSourceId && translatedSource && !Array.isArray(translatedSource.origin_sources)) {
      // Source doesn't have origin_sources array, refresh it
      dispatch(fetchSource({ id: translatedSourceId }));
    }
  }, [dispatch, translatedSourceId, translatedSource]);

  // Load initial segments when source IDs are available
  useEffect(() => {
    if (originalSourceId && translatedSourceId) {
      dispatch(fetchSegments({ source_id: originalSourceId }));
      dispatch(fetchSegments({ source_id: translatedSourceId }));
    }
  }, [dispatch, originalSourceId, translatedSourceId]);

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

      let originalSourceSegments = segments[originalSourceId];
      if (!originalSourceSegments || originalSourceSegments.length === 0) {
        originalSourceSegments = await dispatch(fetchSegments({ source_id: originalSourceId })).unwrap();
      }

      if (!originalSourceSegments || originalSourceSegments.length === 0) {
        showToast('No original segments available for translation.', 'info');
        return;
      }

      const segmentsToTranslate: Segment[] = [];
      for (const originalSegment of originalSourceSegments) {
        if (!translatedSegmentsByOrder[originalSegment.order] && !translations[originalSegment.order]) {
          segmentsToTranslate.push(originalSegment);
        }
        if (segmentsToTranslate.length >= 10) {
          break;
        }
      }

      if (!segmentsToTranslate.length) {
        showToast('No pending segments to translate.', 'info');
        return;
      }

      const additionalSourcesText = await getAdditionalSourcesRemainingText();

      await translateSegments(
        segmentsToTranslate,
        translatedSourceId,
        originalLanguage,
        translatedLanguage,
        additionalSourcesText
      );

      showToast('Translation completed', 'success');
      await dispatch(fetchSegments({ source_id: translatedSourceId })).unwrap();
      if (additionalSourcesText.length) {
        await Promise.all(
          additionalSourcesText
            .filter((source) => source.id)
            .map((source) => dispatch(fetchSegments({ source_id: source.id! })).unwrap())
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        showToast('Error translating more: ' + error.message, 'error');
      } else {
        showToast('Error translating more', 'error');
      }
    }
  }, [
    translations,
    segments,
    translatedSegmentsByOrder,
    translateSegments,
    showToast,
    dispatch,
    translatedSourceId,
    translatedLanguage,
    originalSourceId,
    originalLanguage,
    getAdditionalSourcesRemainingText,
  ]);

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

  const fixedHeaderContent = useCallback(() => (
    <TableRow sx={{ backgroundColor: 'white' }}>
      <TableCell sx={{ width: ORDER_COLUMN_WIDTH, minWidth: ORDER_COLUMN_WIDTH }}>Order</TableCell>
      {isOriginalSourceVisible && (
        <TableCell sx={{ width: LANGUAGE_COLUMN_WIDTH, minWidth: LANGUAGE_COLUMN_WIDTH }}>
          Source ({(originalSource && getLanguageName(originalLanguage)) || 'Unknown'})
        </TableCell>
      )}
      {additionalVisibleSources.map((sourceLang: OriginSource) => (
        <TableCell key={sourceLang.id} sx={{ width: LANGUAGE_COLUMN_WIDTH, minWidth: LANGUAGE_COLUMN_WIDTH }}>
          {getLanguageName(sourceLang.language)}
        </TableCell>
      ))}
      <TableCell sx={{ width: TRANSLATION_COLUMN_WIDTH, minWidth: TRANSLATION_COLUMN_WIDTH }}>
        Translation ({getLanguageName(translatedLanguage)})
      </TableCell>
      <TableCell sx={{ width: ACTIONS_COLUMN_WIDTH, minWidth: ACTIONS_COLUMN_WIDTH }}>Actions</TableCell>
    </TableRow>
  ), [originalSource, originalLanguage, translatedLanguage, isOriginalSourceVisible, additionalVisibleSources]);

  const context = {
    translations,
    translatedSegmentsByOrder,
    originalLanguage,
    translatedLanguage,
    updateTranslations,
    handleSaveTranslation,
    isOriginalSourceVisible,
    additionalVisibleSources,
    additionalSourceSegments,
  };

  const itemContent = useCallback((index: number, originalSegment: Segment, context: any) => {
    const {
      translations,
      translatedSegmentsByOrder,
      originalLanguage,
      translatedLanguage,
      updateTranslations,
      handleSaveTranslation,
      isOriginalSourceVisible,
      additionalVisibleSources,
      additionalSourceSegments,
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
        isOriginalSourceVisible={isOriginalSourceVisible}
        additionalVisibleSources={additionalVisibleSources}
        additionalSourceSegments={additionalSourceSegments}
      />
    );
  }, []);

  const VirtuosoTableComponent = useCallback((props: any) => (
    <Table stickyHeader sx={{ minWidth: tableMinWidth }} {...props} />
  ), [tableMinWidth]);

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
              <Tooltip title="Visible languages" arrow>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={(e) => setAnchorEl(e.currentTarget as HTMLButtonElement)}
                >
                  <VisibilityIcon />
                </Button>
              </Tooltip>
              <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <Box sx={{ p: 2, minWidth: 200 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Visible languages
                  </Typography>
                  {availableOriginSources.map((originSource: OriginSource) => {
                    const isVisible = visibleSourceLanguages.some(
                      (vsl: OriginSource) => vsl.id === originSource.id
                    );
                    return (
                      <Box
                        key={originSource.id}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 1,
                        }}
                      >
                        <Typography>{getLanguageName(originSource.language)}</Typography>
                        <Switch
                          checked={isVisible}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setVisibleSourceLanguages([...visibleSourceLanguages, originSource]);
                            } else {
                              setVisibleSourceLanguages(
                                visibleSourceLanguages.filter(
                                  (vsl: OriginSource) => vsl.id !== originSource.id
                                )
                              );
                            }
                          }}
                          color="primary"
                        />
                      </Box>
                    );
                  })}
                  {availableOriginSources.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No additional source languages available
                    </Typography>
                  )}
                </Box>
              </Popover>
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
            <TableContainer 
              component={Paper} 
              className="edit-virtuoso-height"
              sx={{
                overflowX: shouldEnableHorizontalScroll ? 'auto' : 'hidden',
              }}
            >
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
        <Container maxWidth="lg"  sx={{ minWidth: '350px', textAlign: 'left' }} className="right-side-pane">
          {translatedSourceId && translatedSource && !translatedSource.dictionary_id &&
            <Box>
              <Typography>Default dictionary was used</Typography>
              <Button onClick={async () => {
                await createDefaultDict(translatedSource);
                dispatch(fetchSource({ id: translatedSourceId }));
              }}>Create Cutsom Dictionary</Button>
            </Box>
          }
          {translatedSourceId && translatedSource && translatedSource.dictionary_id && <Dictionary
            dictionary_id={translatedSource.dictionary_id}
            dictionary_timestamp_epoch={translatedSource.dictionary_timestamp_epoch}
            dictionaryUpdated={async (newDictionaryTimestamp) => {
              const updatedSource = await dispatch(addOrUpdateSource({
                ...translatedSource,
                modified_by: undefined,
                modified_at: undefined,
                dictionary_timestamp: newDictionaryTimestamp,
              })).unwrap();
              console.log('Updated source', updatedSource);
              dispatch(fetchSource({ id: translatedSourceId }));
            }}
            refresh={async () => {
              const refreshed = await refreshDictionary(translatedSource);
              if (refreshed) {
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
