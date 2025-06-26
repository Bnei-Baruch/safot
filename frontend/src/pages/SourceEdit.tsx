import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate } from "react-router-dom";
import compareTwoStrings from 'string-similarity-js';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button, Box, Typography, Container, Fab } from "@mui/material";
import { segmentService } from '../services/segment.service';
import { ruleService } from '../services/rule.service';
import { dictionaryService } from '../services/dictionary.service';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import AddIcon from '@mui/icons-material/Add';
import { translateParagraphs } from '../services/translation.service';
import { fetchSegments, saveSegments} from '../SegmentSlice';
import { Segment, Rule, Example } from '../types/frontend-types';
import { fetchSource } from '../SourceSlice';
import { useAppDispatch, RootState } from '../store';
import { useToast } from '../cmp/Toast';
import { LANGUAGES } from '../constants/languages';


const SourceEdit: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { showToast } = useToast();
    const { id } = useParams<{ id: string }>();
    const parsedId = id ? parseInt(id, 10) : undefined;

    const { segments, loading: segmentsLoading, error: segmentsError } = useSelector((state: RootState) => state.segments);
    const { sources, loading: sourcesLoading, error: sourcesError } = useSelector((state: RootState) => state.sources);

    const sourceData = parsedId ? sources[parsedId] : undefined;
    const originalSourceId = sourceData?.original_source_id;

    const [translations, setTranslations] = useState<{
        [key: number]: {
            text: string;
            order: number;
            original_segment_id: number;
            original_segment_timestamp: string;
        }
    }>({});

    const isAllTranslated = parsedId && originalSourceId &&
        segments[originalSourceId] &&
        segments[parsedId] &&
        segments[originalSourceId].length === segments[parsedId].length &&
        segments[parsedId].every(segment => segment.text?.trim() !== '');

    useEffect(() => {
        if (parsedId && !(parsedId in sources)) {
            dispatch(fetchSource({ id: parsedId }));
        }
        if (originalSourceId && !(originalSourceId in sources)) {
            dispatch(fetchSource({ id: originalSourceId }));
        }
    }, [dispatch, parsedId, originalSourceId, sources]);

    useEffect(() => {

        if (originalSourceId && !(originalSourceId in segments)) {
            dispatch(fetchSegments({ source_id: originalSourceId }));
        }
        if (parsedId && !(parsedId in segments)) {
            dispatch(fetchSegments({ source_id: parsedId }));
        }
    }, [dispatch, parsedId, originalSourceId, segments]);

    const handleTranslationChange = (sourceSegmentId: number, order: number, timestamp: string, value: string) => {
        setTranslations(prev => ({
            ...prev,
            [sourceSegmentId]: {
                text: value,
                order,
                original_segment_id: sourceSegmentId,
                original_segment_timestamp: timestamp
            }
        }));
    };

    const handleSaveTranslation = async (sourceSegmentId: number) => {
        if (!parsedId || !translations[sourceSegmentId] || originalSourceId == null) return;
      
        const translation = translations[sourceSegmentId];
        const originalSegment = segments[originalSourceId]?.find(s => s.id === sourceSegmentId);
        const order = originalSegment?.order ?? translation.order;
        const existingTranslation = segments[parsedId]?.find(t => t.order === order);
      
        const segment = segmentService.buildSegment({
            text: translation.text,
            source_id: parsedId,
            order: order,
            properties: {
                segment_type: existingTranslation ? "edited" : "user_translation"
            },
            id: existingTranslation?.id,
            original_segment_id: translation.original_segment_id,
            original_segment_timestamp: translation.original_segment_timestamp
        });
       
        try {
            await dispatch(saveSegments([segment])).unwrap();
            await dispatch(fetchSegments({ source_id: parsedId }));
            showToast("Translation saved successfully!", "success");
            setTranslations(prev => {
                const updated = { ...prev };
                delete updated[sourceSegmentId];
                return updated;
            });
        } catch (error) {
            console.error("Error saving translation:", error);
            showToast("Failed to save translation. Please try again.", "error");
        }
    };
      
    const getLanguageName = (code: string): string => {
        const languageMap: { [key: string]: string } = {
            'he': 'Hebrew',
            'en': 'English',
            'es': 'Spanish',
            'ru': 'Russian',
            'fr': 'French'
        }
        return languageMap[code] || 'Unknown';
    };

    const handleExportDocx = async () => {
        if (!parsedId) return;

        try {

            const blob = await segmentService.exportTranslationDocx(parsedId);
            if (!(blob instanceof Blob)) {
                throw new Error("Response is not a valid Blob");
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${sourceData?.name || "translated"}_${sourceData?.language}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast("Document exported successfully!", "success");
        } catch (error) {
            console.error("Error exporting document:", error);
            showToast("Failed to export document. Please try again.", "error");
        }
    };

    const getNextBatch = (): Segment[] => {
        if (!originalSourceId || !parsedId) return [];
      
        const sourceSegments = segments[originalSourceId] || [];
        const targetSegments = segments[parsedId] || [];
        const translatedOrders = new Set(targetSegments.map(seg => seg.order));
      
        const batch: Segment[] = [];
      
        for (const seg of sourceSegments) {
          if (!translatedOrders.has(seg.order)) {
            batch.push(seg);
            if (batch.length === 20) break;
          }
        }
      
        return batch;
    };

    const getSavedExamples = (): { sourceText: string; firstTranslation: string; lastTranslation: string }[] => {
        if (!parsedId || !originalSourceId) return [];

        const sourceSegments = segments[originalSourceId] || [];
        const targetSegments = segments[parsedId] || [];

        const byOrder: { [order: number]: Segment[] } = {};
        targetSegments.forEach(seg => {
            if (!seg.text?.trim() || !seg.timestamp) return;
            if (!byOrder[seg.order]) byOrder[seg.order] = [];
            byOrder[seg.order].push(seg);
        });

        const examples: (Example & { score: number })[] = [];

        for (const order in byOrder) {
            const segs = byOrder[order];
            if (segs.length < 2) continue;

            const sorted = segs.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));
            const first = sorted[0].text.trim();
            const last = sorted[sorted.length - 1].text.trim();

            const sourceText = sourceSegments.find(s => s.order === Number(order))?.text || '';

            if (first !== last && sourceText) {
                const score = 1 - compareTwoStrings(first, last);
                examples.push({ sourceText, firstTranslation: first, lastTranslation: last, score });
            }
        }

        return examples
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)
            .map(({ sourceText, firstTranslation, lastTranslation }) => ({
                sourceText,
                firstTranslation,
                lastTranslation
            }));
    };

    const buildAndSaveSegments = async (
        paragraphs: string[],
        source_id: number,
        properties: Record<string, any>,
        originalSegments?: Segment[]
      ): Promise<Segment[]> => {
        const segments = paragraphs.map((text, index) => {
          const originalSegment = originalSegments?.[index];
          return segmentService.buildSegment({
            text,
            source_id,
            order: originalSegment?.order ?? index + 1,
            properties,
            original_segment_id: originalSegment?.id,
            original_segment_timestamp: originalSegment?.timestamp
          });
        });
      
        const { segments: savedSegments } = await dispatch(saveSegments(segments)).unwrap();
        return savedSegments;
      };


    const handleTranslateMore = async () => {
      const batch = getNextBatch();
      if (!batch.length) {
        showToast("No more paragraphs to translate.", "info");
        return;
      }

      try {
        // 1 Create new dictionary version and get id + timestamp
        const { dictionary_id: dictionaryId, dictionary_timestamp: dictionaryTimestamp } = 
          await createNewDictionaryVersion(parsedId!);

        // 2 Build and save rules (examples + prompt_key)
        const examples = getSavedExamples();
        const rules = buildRules(examples, dictionaryId, dictionaryTimestamp);
        await ruleService.saveRules(rules);

        // 3 Send translation with the new dictionary version
        const paragraphs = batch.map(seg => seg.text);
        const { translated_paragraphs, properties, total_segments_translated } =
          await translateParagraphs(
            paragraphs,
            sources[originalSourceId!].language,
            sourceData?.language!,
            dictionaryId,
            dictionaryTimestamp,
            examples
          );

        // 4 Save the new segments
        await buildAndSaveSegments(translated_paragraphs, parsedId!, properties, batch);

        showToast(`${total_segments_translated} segments translated & saved!`, "success");
      } catch (err) {
        console.error("❌ Translate More failed:", err);
        showToast("Failed to translate more paragraphs.", "error");
      }
    };

    const createNewDictionaryVersion = async (sourceId: number) => {
      return await dictionaryService.createNewDictionaryVersion(sourceId);
    };

    const buildRules = (examples: Example[], dictionaryId: number, dictionaryTimestamp: string): Rule[] => {
      const rules: Rule[] = examples.map(example => ({
        name: "example",
        type: "example",
        dictionary_id: dictionaryId,
        dictionary_timestamp: dictionaryTimestamp,
        properties: {
          source_text: example.sourceText,
          provider_translation: example.firstTranslation,
          user_translation: example.lastTranslation,
        },
      }));

      // Add prompt_key rule
      rules.push({
        name: "prompt_key",
        type: "prompt_key",
        dictionary_id: dictionaryId,
        dictionary_timestamp: dictionaryTimestamp,
        properties: {
          prompt_key: "prompt_2",
        },
      });

      return rules;
    };

    const getLatestSegments = (segmentsArr: Segment[]): Segment[] => {
        const latestByOrder: { [order: number]: Segment } = {};
        segmentsArr.forEach(seg => {
            const segTime = (typeof seg.timestamp === 'string' && seg.timestamp) ? new Date(seg.timestamp) : new Date(0);
            const currTimestamp = latestByOrder[seg.order]?.timestamp;
            const currTime = (typeof currTimestamp === 'string' && currTimestamp) ? new Date(currTimestamp) : new Date(0);
            if (!latestByOrder[seg.order] || segTime > currTime) {
                latestByOrder[seg.order] = seg;
            }
        });
        return Object.values(latestByOrder).sort((a, b) => a.order - b.order);
    };

    return (
        <Box sx={{ backgroundColor: '#f5f5f5', width: '100vw', display: 'flex', flexDirection: 'column' }}>
            <Container maxWidth="lg" >
                <Box sx={{ pl: 9 }}>
                {/* Back button */}ֿ
                <Box sx={{  display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Button
                        onClick={() => navigate('/')}
                        startIcon={<ArrowBackIosNewIcon />}
                        sx={{ color: '#1976d2', textTransform: 'none', fontWeight: 'bold', mb: 2, pl: 0 }}
                    >
                        Back to sources
                    </Button>
                </Box>
                
        
                {/* Header and actions */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', fontFamily: 'inherit' }}>
                                Document: {sourceData?.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {segments[parsedId!]?.length || 0} paragraphs
                            </Typography>
                        </Box>
            
                        <Box display="flex" gap={2}>
                            <Button
                                variant="contained"
                                color="primary"
                                disabled={!isAllTranslated}
                                onClick={handleExportDocx}
                            >
                                Export to DOCX
                            </Button>
                            <Button
                                color="primary"
                                variant="contained"
                                onClick={handleTranslateMore}
                                size="medium"
                                sx={{ boxShadow: 'none', height: 40 }}
                            >
                                <AddIcon sx={{ mr: 1 }} /> Translate More
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </Container>
      
          {/* Scrollable table */}
            <Container maxWidth="lg">
                <Box sx={{ maxHeight: '70vh', overflow: 'auto', pl: 9,pb: 4  }}>
                    <TableContainer component={Paper} sx={{ }}>
                    <Table stickyHeader>
                        <TableHead>
                        <TableRow>
                            <TableCell>Order</TableCell>
                            <TableCell style={{ width: '40%' }}>
                            Source ({originalSourceId && getLanguageName(sources[originalSourceId]?.language) || 'Unknown'})
                            </TableCell>
                            <TableCell style={{ width: '50%' }}>
                            Translation ({getLanguageName(sourceData?.language || '')})
                            </TableCell>
                            <TableCell style={{ width: '10%' }}>Actions</TableCell>
                        </TableRow>
                        </TableHead>
                        <TableBody>
                        {originalSourceId && segments[originalSourceId] && parsedId ? (
                            getLatestSegments(segments[originalSourceId]).map((sourceSegment: Segment) => {
                                const latestTargetSegments = getLatestSegments(segments[parsedId] || []);
                                const existingTranslation = latestTargetSegments.find(t => t.order === sourceSegment.order)?.text || '';
                                const hasChanged = sourceSegment.id !== undefined &&
                                (translations[sourceSegment.id]?.text ?? existingTranslation) !== existingTranslation;
            
                                const sourceLangOption = LANGUAGES.find(lang => lang.code === sources[originalSourceId]?.language);
                                const sourceLangDirection = sourceLangOption?.direction || 'ltr';
                                const translationLangOption = LANGUAGES.find(lang => lang.code === sourceData?.language);
                                const translationLangDirection = translationLangOption?.direction || 'ltr';
            
                                return (
                                <TableRow key={sourceSegment.id ?? `temp-${sourceSegment.order}`}>
                                    <TableCell>{sourceSegment.order}</TableCell>
                                    <TableCell style={{
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-wrap',
                                    verticalAlign: 'top',
                                    direction: sourceLangDirection,
                                    textAlign: sourceLangDirection === 'rtl' ? 'right' : 'left'
                                    }}>
                                    {sourceSegment.text}
                                    </TableCell>
                                    <TableCell style={{
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-wrap',
                                    verticalAlign: 'top',
                                    direction: translationLangDirection,
                                    textAlign: translationLangDirection === 'rtl' ? 'right' : 'left'
                                    }}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        minRows={1}
                                        maxRows={30}
                                        value={sourceSegment.id !== undefined ? translations[sourceSegment.id]?.text ?? existingTranslation : existingTranslation}
                                        onChange={(e) => handleTranslationChange(
                                        sourceSegment.id!,
                                        sourceSegment.order,
                                        sourceSegment.timestamp || '',
                                        e.target.value
                                        )}
                                        placeholder="Enter translation"
                                        inputProps={{
                                        style: {
                                            direction: translationLangDirection,
                                            textAlign: translationLangDirection === 'rtl' ? 'right' : 'left'
                                        }
                                        }}
                                    />
                                    </TableCell>
                                    <TableCell>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={() => handleSaveTranslation(sourceSegment.id!)}
                                        disabled={!hasChanged}
                                    >
                                        <SaveIcon />
                                    </Button>
                                    </TableCell>
                                </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                            <TableCell colSpan={4} align="center">Loading segments...</TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                    </TableContainer>
                </Box>
            </Container>
        </Box>
      );
};

export default SourceEdit;
