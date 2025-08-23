import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from "react-router-dom";

import debounce from "lodash.debounce";
import { TableVirtuoso } from "react-virtuoso";

import {
  Box,
  Button,
  Container,
	IconButton,
  Paper,
  Table,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import {
  Add as AddIcon,
  ArrowBackIosNew as ArrowBackIosNewIcon,
	Check as CheckIcon,
	Close as CloseIcon,
	Edit as EditIcon,
  Save as SaveIcon,
} from '@mui/icons-material';

import { buildSegment, exportTranslationDocx } from '../services/segment.service';
import { useAppDispatch, useAppSelector, RootState } from '../store/store';
import { fetchSegments, saveSegments } from '../store/SegmentSlice';
import { fetchSource, addOrUpdateSource } from '../store/SourceSlice';

import { useFlow } from '../useFlow';
import { useToast } from '../cmp/Toast';
import { Segment, Source } from '../types/frontend-types';
import { LANGUAGES, LANG_DIRS } from '../constants/languages';

const getSource = (sources: Record<number, Source>, id: number | undefined): Source | undefined => (sources && id && (id in sources) && sources[id]) || undefined;

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
  console.log('translatedSegmentsByOrder', translatedSegmentsByOrder);

  // Maps translated segments order to text area value.
  const [translations, setTranslations] = useState<Record<number, string>>({});
	const [titleEditing, setTitleEditing] = useState<string | null>(null);

  useEffect(() => {
    if (translatedSourceId && !(translatedSourceId in sources)) {
      console.log('fetch source');
      dispatch(fetchSource({ id: translatedSourceId }));
    }
    if (originalSourceId && !(originalSourceId in sources)) {
      console.log('fetch original source');
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

  useEffect(() => {
    if (translatedSourceId && segments[translatedSourceId]) {
      console.log('setTranslations...');
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
  const updateTranslations = useMemo(() => debounce((order: number, value: string) => {
    setTranslations(prev => ({
      ...prev,
      [order]: value,
    }));
  }, 500), [setTranslations]);
  
  console.log('render');

  return (
    <Box sx={{ backgroundColor: '#f5f5f5', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      <Container maxWidth="lg" >
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
          <Button
            onClick={() => navigate('/')}
            startIcon={<ArrowBackIosNewIcon />}
            sx={{ color: '#1976d2', textTransform: 'none', fontWeight: 'bold' }}
          >
              Back to sources
          </Button>
          <Box display="flex" gap={2}>
            <Button
                variant="contained"
                color="primary"
                onClick={handleExportDocx}
            >
                Export to DOCX
            </Button>
            <Button
                color="primary"
                variant="contained"
                onClick={handleTranslateMore}
                disabled={!!loadingCount}
                size="medium"
                sx={{ boxShadow: 'none', height: 40 }}
            >
                <AddIcon sx={{ mr: 1 }} /> 
                {loadingCount ? 'Translating...' : 'Translate More'}
            </Button>
          </Box>
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', fontFamily: 'inherit', my: 2 }}>
              {titleEditing === null && <>
								{translatedSource?.name}
								<IconButton onClick={() => setTitleEditing(translatedSource?.name || '')} size="small">
									<EditIcon fontSize="small" />
								</IconButton>
							</>}
              {titleEditing !== null && <>
								<TextField
									variant="standard"
									InputProps={{ sx: (theme) => ({ ...theme.typography.h5, fontWeight: 'bold', minWidth: '500px' }) }}
									value={titleEditing}
									onChange={(e) => setTitleEditing(e.target.value)}
									autoFocus
									error={titleEditing.trim() === ""}
									helperText={titleEditing.trim() === "" ? "Title is required" : ""}
								/>
								<IconButton
									disabled={titleEditing.trim() === ""}
									onClick={async () => {
										if (translatedSource && translatedSource.id) {
											await dispatch(addOrUpdateSource({ ...translatedSource, name: titleEditing }));
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
              {(translatedSourceId && segments[translatedSourceId] && segments[translatedSourceId].length) || 0}
          </Typography>
        </Box>
  
        {/* Scrollable table */}
        <Box>
          <TableContainer component={Paper} sx={{ height: 'calc(100vh - 230px)' }}>
            <TableVirtuoso
              data={(originalSourceId && segments[originalSourceId]) || []}
              fixedHeaderContent={() => (
                <TableRow sx={{ backgroundColor: 'white' }}>
                  <TableCell>Order</TableCell>
                  <TableCell style={{ width: '40%' }}>
                  Source ({(originalSource && getLanguageName(originalLanguage)) || 'Unknown'})
                  </TableCell>
                  <TableCell style={{ width: '50%' }}>
                  Translation ({getLanguageName(translatedLanguage)})
                  </TableCell>
                  <TableCell style={{ width: '10%' }}>Actions</TableCell>
                </TableRow>
              )}
              itemContent={(index, originalSegment: Segment) => {
                // TODO: Original segment might not match by timestamp with 
                // translatedSegment.original_segment_timestamp, in that case we should notify
                // user that the origin has a new version to allow rebasing translation to a newer source.
                const translatedSegment = translatedSegmentsByOrder[originalSegment.order];

                return (
                  <>
                    <TableCell>{originalSegment.order}</TableCell>
                    <TableCell style={{
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      verticalAlign: 'top',
                      direction: LANG_DIRS[originalLanguage],
                      textAlign: LANG_DIRS[originalLanguage] === 'rtl' ? 'right' : 'left'
                    }}>
                      {originalSegment.text}
                    </TableCell>
                    <TableCell style={{
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      verticalAlign: 'top',
                      direction: LANG_DIRS[translatedLanguage],
                      textAlign: LANG_DIRS[translatedLanguage] === 'rtl' ? 'right' : 'left'
                    }}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={1}
                        maxRows={30}
                        defaultValue={translations[originalSegment.order]}
                        onChange={(e) => updateTranslations(originalSegment.order, e.target.value)}
                        placeholder="Enter translation"
                        inputProps={{
                          style: {
                            direction: LANG_DIRS[translatedLanguage],
                            textAlign: LANG_DIRS[translatedLanguage] === 'rtl' ? 'right' : 'left'
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleSaveTranslation(translatedSegment, originalSegment, translations[originalSegment.order])}
                        disabled={translatedSegment && translations[originalSegment.order] === translatedSegment.text}
                      >
                        <SaveIcon />
                      </Button>
                    </TableCell>
                  </>
                );
              }}
              components={{
                Table: (props) => <Table stickyHeader {...props} />,
              }}
            />
          </TableContainer>
        </Box>
      </Container>
    </Box>
  );
};

export default SourceEdit;
