import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from "react-router-dom";

import { TableVirtuoso } from "react-virtuoso";
import Split from "react-split";

import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  IconButton,
  Menu,
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
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

import { exportTranslationDocx, postSegmentOriginLinks } from '../services/segment.service';
import { useAppDispatch, useAppSelector, RootState } from '../store/store';
import { fetchSegments, saveSegments } from '../store/SegmentSlice';
import { fetchSources, addOrUpdateSources, fetchSourceRelations } from '../store/SourceSlice';
import { fetchDictionaries } from '../store/DictionarySlice';
import Dictionary from '../cmp/Dictionary';

import { formatShortDateTime } from '../cmp/Utils';
import { useFlow } from '../useFlow';
import { useToast } from '../cmp/Toast';
import { Segment, Source } from '../types/frontend-types';
import { LANGUAGES, LANG_DIRS } from '../constants/languages';

const getSource = (sources: Record<number, Source>, id: number | undefined): Source | undefined => (sources && id && (id in sources) && sources[id]) || undefined;

// Helper to convert segments array to map by order
const segmentsToOrderMap = (segments: Segment[]): Record<number, Segment> => {
  return segments.reduce((acc, seg) => {
    acc[seg.order] = seg;
    return acc;
  }, {} as Record<number, Segment>);
};

const DICTIONARY_OPEN = 'dictionary-open';
const RIGHT_PANE_SIZE = 'right-pane-size';

interface SegmentRowData {
  order: number;
  originalSegments: (Segment | undefined)[];
}

const Row = React.memo(({
  order,
  originalSegments,
  translatedSegment,
  translationText,
  originalLanguages,
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
    updateTranslations(order, e.target.value);
  }, [updateTranslations, order]);

  const handleSave = useCallback(() => {
    handleSaveTranslation(translatedSegment, originalSegments, translationText);
  }, [handleSaveTranslation, translatedSegment, originalSegments, translationText]);

  const translatedCellStyle = useMemo(() => ({
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    verticalAlign: 'top',
    direction: LANG_DIRS[translatedLanguage],
    textAlign: LANG_DIRS[translatedLanguage] === 'rtl' ? 'right' : 'left',
    height: '1px',
  }), [translatedLanguage]);

  return (
    <>
      <TableCell>{order}</TableCell>
      {originalSegments.map((segment: Segment | undefined, idx: number) => {
        const lang = originalLanguages[idx];
        const cellStyle = {
          wordBreak: 'break-word' as const,
          whiteSpace: 'pre-wrap' as const,
          verticalAlign: 'top' as const,
          direction: LANG_DIRS[lang],
          textAlign: LANG_DIRS[lang] === 'rtl' ? 'right' as const : 'left' as const
        };
        return (
          <TableCell key={idx} sx={cellStyle}>
            {segment?.text || ''}
          </TableCell>
        );
      })}
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
          disabled={!translatedSegment}
          sx={{ height: '100%', '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' } }}
        />
      </TableCell>
      <TableCell>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={!translatedSegment || translationText === translatedSegment.text}
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

  const { sources, relations } = useAppSelector((state: RootState) => state.sources);

  // Visibility control state
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState<boolean>(false);
  const [visibleSources, setVisibleSources] = useState<boolean[]>([]);
  const visibilityButtonRef = React.useRef<HTMLButtonElement>(null);

  const translatedSource = useMemo(() => getSource(sources, translatedSourceId), [sources, translatedSourceId]);
  const translatedLanguage = translatedSource?.language || 'en';

  const originalSourceIds = useMemo(() =>
    translatedSourceId && relations[translatedSourceId] ? relations[translatedSourceId].origins : [],
    [relations, translatedSourceId]
  );

  const originalSource = useMemo(() => {
    const sourcesList = originalSourceIds
      .map(id => getSource(sources, id))
      .filter((s): s is Source => s !== undefined);

    // Sources not loaded yet
    if (sourcesList.length === 0) {
      return null;
    }

    // Find sources with is_original: true
    const originalSources = sourcesList.filter(s => s.properties?.is_original === true);

    // Validate exactly one original source
    if (originalSources.length === 0) {
      console.warn('No source with is_original property found');
      return null;
    }
    if (originalSources.length > 1) {
      console.error('Multiple sources with is_original property found');
      return null;
    }

    return originalSources[0];
  }, [sources, originalSourceIds]);

  const additionalSources = useMemo(() => {
    const sourcesList = originalSourceIds
      .map(id => getSource(sources, id))
      .filter((s): s is Source => s !== undefined);

    // Return sources without is_original: true
    return sourcesList.filter(s => s.properties?.is_original !== true);
  }, [sources, originalSourceIds]);

  const originalLanguage = originalSource?.language;

  const additionalSourcesLanguages = useMemo(() =>
    additionalSources.map(s => s.language),
    [additionalSources]
  );

  // Filter additional sources languages based on visibility (index 1+ in visibleSources)
  const additionalSourcesVisibleLanguages = useMemo(() =>
    additionalSourcesLanguages.filter((_, idx) => visibleSources[idx + 1]),
    [additionalSourcesLanguages, visibleSources]
  );

  // All visible languages: original (if visible) + visible additional sources
  const allVisibleLanguages = useMemo(() => {
    const languages = [];
    if (originalLanguage && visibleSources[0]) {
      languages.push(originalLanguage);
    }
    languages.push(...additionalSourcesVisibleLanguages);
    return languages;
  }, [originalLanguage, additionalSourcesVisibleLanguages, visibleSources]);

  const { segments } = useAppSelector((state: RootState) => state.segments);

  // Original source segments (always visible)
  const originalSegments = useMemo(() =>
    originalSource ? segments[originalSource.id] || [] : [],
    [originalSource, segments]
  );

  // Additional sources segments (filtered to exclude rest_of_text segments)
  const additionalSourcesSegments = useMemo(() =>
    additionalSources.map(source =>
      (segments[source.id] || []).filter(seg => seg.properties?.segment_type !== 'rest_of_text')
    ),
    [additionalSources, segments]
  );

  // Additional sources segments filtered by visibility (index 1+ in visibleSources)
  const additionalSourcesVisibleSegments = useMemo(() =>
    additionalSourcesSegments.filter((_, idx) => visibleSources[idx + 1]),
    [additionalSourcesSegments, visibleSources]
  );

  // Organize segments by order with visibility filtering
  const originalVisibleSegmentsByOrder = useMemo(() => {
    if (!originalSource) return {};

    // Get orders from original source
    const orders = originalSegments.map(seg => seg.order).sort((a, b) => a - b);

    // Convert segments to order maps
    const originalSegmentMap = segmentsToOrderMap(originalSegments);
    const additionalSegmentMaps = additionalSourcesVisibleSegments.map(segs =>
      segmentsToOrderMap(segs)
    );

    // Build result: for each order, array with visible segments (original if visible + visible additional)
    const result: Record<number, (Segment | undefined)[]> = {};
    orders.forEach(order => {
      const segments: (Segment | undefined)[] = [];
      // Include original segment only if visible (index 0 in visibleSources)
      if (visibleSources[0]) {
        segments.push(originalSegmentMap[order]);
      }
      segments.push(...additionalSegmentMaps.map(segMap => segMap[order]));
      result[order] = segments;
    });

    return result;
  }, [originalSource, originalSegments, additionalSourcesVisibleSegments, visibleSources]);
  const translatedSegmentsByOrder = useMemo(() => ((translatedSourceId && segments[translatedSourceId]) || [])
  .reduce((acc: Record<number, Segment>, s: Segment): Record<number, Segment> => {
    acc[s.order] = s;
    return acc;
  }, {}), [segments, translatedSourceId]);

  // Check if all segments have been translated
  const allTranslated = useMemo(() => {
    if (originalSegments.length === 0) return true;
    return originalSegments.every(seg => translatedSegmentsByOrder[seg.order]);
  }, [originalSegments, translatedSegmentsByOrder]);

  // Maps translated segments order to text area value.
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [titleEditing, setTitleEditing] = useState<{original: string, translated: string} | null>(null);

  // Initialize visibility state for all source languages (original + additional sources)
  useEffect(() => {
    // First element is original source, rest are additional sources
    setVisibleSources([true, ...additionalSources.map(() => true)]);
  }, [additionalSources]);

  const [dictionaryOpen, setDictionaryOpen] = useState<boolean>(
              localStorage.getItem(DICTIONARY_OPEN) === "true" || false);
  const [rightPaneSize, setRightPaneSize] = useState<number>(
              Number(localStorage.getItem(RIGHT_PANE_SIZE) || "0") || 40);

  const checkedDictionaryForSourceId = useRef<number | null>(null);

  const refreshDictionary = useCallback(async (source: Source) => {
    if (source.dictionary_id) {
      const dicts = await dispatch(fetchDictionaries({dictionary_id: source.dictionary_id})).unwrap();
      if (dicts.length !== 1) {
        return false;
      }
      const latestDictionary = dicts[0];
      if (latestDictionary.timestamp_epoch !== source.dictionary_timestamp_epoch) {
        console.log('timestamp dont match', latestDictionary.timestamp_epoch, source.dictionary_timestamp_epoch);
        // eslint-disable-next-line no-restricted-globals
        if (confirm(`Current dictionary version is ${formatShortDateTime(source.dictionary_timestamp_epoch || 0)},` +
            ` later version exist ${formatShortDateTime(latestDictionary.timestamp_epoch || 0)}, update?`)) {
          await dispatch(addOrUpdateSources([{ ...source, dictionary_timestamp: latestDictionary.timestamp_epoch }])).unwrap();
          return true;
        }
      }
    }
    return false;
  }, [dispatch]);

  useEffect(() => {
    if (translatedSource && translatedSourceId && checkedDictionaryForSourceId.current !== translatedSourceId) {
      checkedDictionaryForSourceId.current = translatedSourceId;
      refreshDictionary(translatedSource);
    }
  }, [refreshDictionary, translatedSource, translatedSourceId]);

  // Fetch relations when translatedSourceId changes
  useEffect(() => {
    if (translatedSourceId) {
      dispatch(fetchSourceRelations([translatedSourceId]));
    }
  }, [dispatch, translatedSourceId]);

  // Fetch sources that are not yet loaded
  useEffect(() => {
    const allSourceIds = translatedSourceId
      ? [translatedSourceId, ...originalSourceIds]
      : originalSourceIds;

    if (allSourceIds.length > 0) {
      dispatch(fetchSources(allSourceIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, translatedSourceId, originalSourceIds.join(',')]);

  // Load initial segments when source IDs are available
  useEffect(() => {
    if (originalSourceIds.length > 0 && translatedSourceId) {
      const allSourceIds = [...originalSourceIds, translatedSourceId];
      dispatch(fetchSegments(allSourceIds));
    }
  }, [dispatch, originalSourceIds, translatedSourceId]);

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
      if (!originalSource || !originalLanguage || !translatedSourceId) {
        return;
      }
      if (!originalSource.properties?.is_original) {
        showToast('Expecting original source to have is_original property', 'error');
        return;
      }
      const segmentsToTranslate = [];
      for (const originalSegment of originalSegments) {
        if (!translatedSegmentsByOrder[originalSegment.order] && !translations[originalSegment.order]) {
          segmentsToTranslate.push(originalSegment);
        }
        if (segmentsToTranslate.length >= 10) {
          break;
        }
      };

      // Find rest_of_text segment for each additional source
      const additionalSourcesRestOfText = additionalSources.map(s =>
        (segments[s.id] || []).find(seg => seg.properties?.segment_type === 'rest_of_text')
      );

      // Validate all additional source segments exist
      if (additionalSourcesRestOfText.some(seg => seg === undefined)) {
        throw new Error('Missing segments for additional sources');
      }

      await translateSegments(originalLanguage, segmentsToTranslate, additionalSourcesLanguages, additionalSourcesRestOfText as Segment[], translatedLanguage, translatedSourceId);
      showToast('Translation completed', 'success');
      dispatch(fetchSegments([translatedSourceId, ...additionalSources.map(s => s.id)]));
    } catch (error) {
      // HTTP errors are handled by the global error interceptor
      console.error('Translation failed:', error);
    }
  }, [translations, segments, translatedSegmentsByOrder, translateSegments, showToast, dispatch, translatedSourceId, translatedLanguage, originalSource, originalLanguage, originalSegments, additionalSources, additionalSourcesLanguages]);

  const handleSaveTranslation = useCallback(async (translatedSegment: Segment, originalSegments: Segment[], text: string) => {
    if (!translatedSourceId || !originalSource) {
      showToast("Failed saving segment!", "error");
      return;
    }

    // Find the original segment by matching source_id to the original source
    const originalSegment = originalSegments.find(seg => seg?.source_id === originalSource.id);
    if (!originalSegment) {
      showToast("Original segment not found!", "error");
      return;
    }

    // Validate no segments are null/undefined
    if (originalSegments.some(seg => seg === null || seg === undefined)) {
      showToast("Source segments not loaded properly!", "error");
      return;
    }

    // Validate all source segments have id and timestamp for creating relations
    const invalidSegments = originalSegments.filter(seg => !seg?.id || !seg?.timestamp);
    if (invalidSegments.length > 0) {
      showToast("Source segments missing id or timestamp!", "error");
      return;
    }

    const segment: Segment = {
      text,
      source_id: translatedSourceId,
      order: originalSegment.order,
      properties: {
          segment_type: translatedSegment ? "edited" : "user_translation"
      },
      id: translatedSegment?.id,
    };

    try {
      const savedSegments = await dispatch(saveSegments([segment])).unwrap();
      const savedSegment = savedSegments[0];

      // Create origin links for the saved segment to all source segments (original + references)
      const relations = originalSegments.map(seg => ({
        origin_segment_id: seg.id!,
        origin_segment_timestamp: seg.timestamp!,
        translated_segment_id: savedSegment.id!,
        translated_segment_timestamp: savedSegment.timestamp!,
      }));

      await postSegmentOriginLinks(relations);

      showToast("Translation saved successfully!", "success");
    } catch (error) {
      // HTTP errors are handled by the global error interceptor
      console.error("Error saving translation:", error);
    }
  }, [dispatch, showToast, translatedSourceId, originalSource]);

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
      // HTTP errors are handled by the global error interceptor
      console.error("Error exporting document:", error);
    }
  };

  // Use debounce to update translations only after user stops typing.
  const updateTranslations = useMemo(() => (order: number, value: string) => {
    setTranslations(prev => ({
      ...prev,
      [order]: value,
    }));
  }, [setTranslations]);

  const countSegments = useCallback(() => {
    const translatedLength = (translatedSourceId && segments[translatedSourceId] && segments[translatedSourceId].length) || 0;
    if (!originalSource || !originalSource.properties?.is_original) {
      return null;
    }
    const originalLength = originalSegments.length;
    if (!originalLength) {
      return null;
    }
    return `${translatedLength}/${originalLength}`;
  }, [segments, translatedSourceId, originalSource, originalSegments]);

  // Data is now array of orders with corresponding original segments
  const data = useMemo(() => {
    return Object.keys(originalVisibleSegmentsByOrder)
      .map(Number)
      .sort((a, b) => a - b)
      .map(order => ({
        order,
        originalSegments: originalVisibleSegmentsByOrder[order]
      }));
  }, [originalVisibleSegmentsByOrder]);

  const fixedHeaderContent = useCallback(() => {
    // Calculate equal width for source and translation columns
    // Total columns = sources + translation, each gets equal share of available space
    const totalContentColumns = allVisibleLanguages.length + 1; // +1 for translation
    const columnWidth = `${80 / totalContentColumns}%`; // 80% total (leaving 20% for Order + Actions)

    return (
      <TableRow sx={{ backgroundColor: 'white' }}>
        <TableCell style={{ width: '10%' }}>Order</TableCell>
        {allVisibleLanguages.map((lang, idx) => {
          // First column is Original if original is visible, others are Reference
          const isOriginal = idx === 0 && visibleSources[0] && lang === originalLanguage;
          const label = isOriginal ? 'Original' : 'Reference';
          return (
            <TableCell key={idx} style={{ width: columnWidth }}>
              {label} ({getLanguageName(lang)})
            </TableCell>
          );
        })}
        <TableCell style={{ width: columnWidth }}>
          Translation ({getLanguageName(translatedLanguage)})
        </TableCell>
        <TableCell style={{ width: '10%' }}>Actions</TableCell>
      </TableRow>
    );
  }, [allVisibleLanguages, translatedLanguage, visibleSources, originalLanguage]);

  const context = {
    translations,
    translatedSegmentsByOrder,
    originalLanguages: allVisibleLanguages,
    translatedLanguage,
    updateTranslations,
    handleSaveTranslation,
  };

  const itemContent = useCallback((index: number, item: SegmentRowData, context: any) => {
    const {
      translations,
      translatedSegmentsByOrder,
      originalLanguages,
      translatedLanguage,
      updateTranslations,
      handleSaveTranslation,
    } = context;

    // TODO: Original segment might not match by timestamp with
    // translatedSegment.original_segment_timestamp, in that case we should notify
    // user that the origin has a new version to allow rebasing translation to a newer source.
    const translatedSegment = translatedSegmentsByOrder[item.order];
    const translationText = translations[item.order];

    return (
      <Row
        order={item.order}
        originalSegments={item.originalSegments}
        translatedSegment={translatedSegment}
        translationText={translationText}
        originalLanguages={originalLanguages}
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
                  disabled={!!loadingCount || allTranslated}
                >
                  <TranslateIcon sx={loadingCount ? {
                    animation: 'spin 10s linear infinite',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  } : undefined} />
                </Button>
              </Tooltip>
              <Tooltip title="Toggle source visibility" arrow>
                <Button
                  ref={visibilityButtonRef}
                  variant="contained"
                  color="primary"
                  onClick={() => setVisibilityMenuOpen(true)}
                >
                  <VisibilityIcon />
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

          {/* Visibility Menu */}
          <Menu
            open={visibilityMenuOpen}
            anchorEl={visibilityButtonRef.current}
            onClose={() => setVisibilityMenuOpen(false)}
          >
            <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Toggle source visibility:
              </Typography>
              {/* Original source */}
              {originalSource && (
                <FormControlLabel
                  key="original"
                  control={
                    <Checkbox
                      checked={visibleSources[0] || false}
                      onChange={(e) => {
                        const newVisible = [...visibleSources];
                        newVisible[0] = e.target.checked;
                        setVisibleSources(newVisible);
                      }}
                      disabled={visibleSources.filter(v => v).length === 1 && visibleSources[0]}
                    />
                  }
                  label={getLanguageName(originalSource.language)}
                />
              )}
              {/* Additional sources */}
              {additionalSources.map((source, idx) => {
                const checkedCount = visibleSources.filter(v => v).length;
                const visibleIdx = idx + 1; // offset by 1 since index 0 is original
                const isOnlyChecked = visibleSources[visibleIdx] && checkedCount === 1;
                return (
                  <FormControlLabel
                    key={source.id}
                    control={
                      <Checkbox
                        checked={visibleSources[visibleIdx] || false}
                        onChange={(e) => {
                          const newVisible = [...visibleSources];
                          newVisible[visibleIdx] = e.target.checked;
                          setVisibleSources(newVisible);
                        }}
                        disabled={isOnlyChecked}
                      />
                    }
                    label={getLanguageName(source.language)}
                  />
                );
              })}
            </Box>
          </Menu>

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
                        await dispatch(addOrUpdateSources([{ ...translatedSource, name: titleEditing.translated }]));
                      }
                      if (originalSource && originalSource.id && originalSource.name !== titleEditing.original) {
                        await dispatch(addOrUpdateSources([{ ...originalSource, name: titleEditing.original }]));
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
        <Container maxWidth="lg"  sx={{ minWidth: '350px', textAlign: 'left' }} className="right-side-pane">
          {translatedSourceId && translatedSource && !translatedSource.dictionary_id &&
            <Box>
              <Typography>Default dictionary was used</Typography>
              <Button onClick={async () => {
                await createDefaultDict(translatedSource);
                dispatch(fetchSources([translatedSourceId]));
              }}>Create Cutsom Dictionary</Button>
            </Box>
          }
          {translatedSourceId && translatedSource && translatedSource.dictionary_id && <Dictionary
            dictionary_id={translatedSource.dictionary_id}
            dictionary_timestamp_epoch={translatedSource.dictionary_timestamp_epoch}
            dictionaryUpdated={async (newDictionaryTimestampEpoch) => {
              await dispatch(addOrUpdateSources([{
                  ...translatedSource,
                  modified_by: undefined,
                  modified_at: undefined,
                  dictionary_timestamp: newDictionaryTimestampEpoch,
              }])).unwrap();
              dispatch(fetchSources([translatedSourceId]));
            }}
            refresh={async () => {
              const refreshed = await refreshDictionary(translatedSource);
              if (refreshed) {
                dispatch(fetchSources([translatedSourceId]));
              }
            }}
          />}
        </Container>
      </Split>
    </Box>
  );
};

export default SourceEdit;
