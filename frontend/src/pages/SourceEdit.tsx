import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button, Box, Typography, Container } from "@mui/material";
import { segmentService } from '../services/segment.service';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { fetchSegments, saveSegments } from '../SegmentSlice';
import { Segment } from '../types/frontend-types';
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

        console.log("Saving segment:", segment);
      
        try {
            await dispatch(saveSegments([segment])).unwrap();
      
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


    return (
        <Box sx={{ backgroundColor: '#f5f5f5', py: 4, width: '100%' }}>
            <Container maxWidth="lg"  >
                <Box sx={{ pl: 9 }}>
                    <Box sx={{  display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Button
                            onClick={() => navigate('/')}
                            startIcon={<ArrowBackIosNewIcon />}
                            sx={{ color: '#1976d2', textTransform: 'none', fontWeight: 'bold', mb: 2, pl: 0 }}
                        >
                            Back to sources
                        </Button>
                    </Box>
                    
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', fontFamily: 'inherit' }}>
                                Document: {sourceData?.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {segments[parsedId!]?.length || 0} paragraphs
                            </Typography>
                        </Box>

                        <Button
                        variant="contained"
                        color="primary"
                        disabled={!isAllTranslated}
                        onClick={handleExportDocx}
                        >
                        Export to DOCX
                        </Button>
                    </Box>
                    
                    <TableContainer component={Paper} >
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Order</TableCell>
                                    <TableCell style={{ width: "40%" }}>Source ({originalSourceId && getLanguageName(sources[originalSourceId]?.language) || 'Unknown'})</TableCell>
                                    <TableCell style={{ width: "50%" }}>Translation ({getLanguageName(sourceData?.language || '')})</TableCell>
                                    <TableCell style={{ width: "10%" }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {originalSourceId && segments[originalSourceId] && parsedId ? (
                                    [...segments[originalSourceId]]
                                    .sort((a, b) => a.order - b.order)
                                    .map((sourceSegment: Segment) => {
                                        const existingTranslation = segments[parsedId]?.find(t => t.order === sourceSegment.order)?.text || '';
                                        const hasChanged = sourceSegment.id !== undefined && (translations[sourceSegment.id]?.text ?? existingTranslation) !== existingTranslation;

                                        // Get directions
                                        const sourceLangOption = LANGUAGES.find(lang => lang.code === sources[originalSourceId]?.language);
                                        const sourceLangDirection = sourceLangOption?.direction || 'ltr';
                                        const translationLangOption = LANGUAGES.find(lang => lang.code === sourceData?.language);
                                        const translationLangDirection = translationLangOption?.direction || 'ltr';

                                        return (
                                            <TableRow key={sourceSegment.id ?? `temp-${sourceSegment.order}`}>
                                                <TableCell>{sourceSegment.order}</TableCell>
                                                <TableCell style={{ wordBreak: "break-word", whiteSpace: "pre-wrap", verticalAlign: "top", direction: sourceLangDirection, textAlign: sourceLangDirection === 'rtl' ? 'right' : 'left' }}>{sourceSegment.text}</TableCell>
                                                <TableCell style={{ wordBreak: "break-word", whiteSpace: "pre-wrap", verticalAlign: "top", direction: translationLangDirection, textAlign: translationLangDirection === 'rtl' ? 'right' : 'left' }}>
                                                    <TextField
                                                        fullWidth
                                                        multiline
                                                        minRows={1}
                                                        maxRows={20}
                                                        value={sourceSegment.id !== undefined ? translations[sourceSegment.id]?.text ?? existingTranslation : existingTranslation}
                                                        onChange={(e) => handleTranslationChange(
                                                            sourceSegment.id!, //non-null assertion operator
                                                            sourceSegment.order,
                                                            sourceSegment.timestamp || "", 
                                                            e.target.value
                                                        )}
                                                        placeholder="Enter translation"
                                                        inputProps={{ style: { direction: translationLangDirection, textAlign: translationLangDirection === 'rtl' ? 'right' : 'left' } }}
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
