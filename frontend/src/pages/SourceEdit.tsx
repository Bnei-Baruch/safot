import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button, Box } from "@mui/material";
import { segmentService } from '../services/segment.service';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchSegments, saveSegments } from '../SegmentSlice';
import {  Segment} from '../types';
import { fetchSource } from '../SourceSlice';
import { useAppDispatch, RootState } from '../store';
import { useToast } from '../cmp/Toast';

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
        // console.log("📝 Segments in Redux store:", segments);
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
      
       
        try {
          await dispatch(saveSegments({
            paragraphs: [translation.text],
            source_id: parsedId,
            properties: {
              segment_type: existingTranslation ? "edited" : "user_translation"
            },
            original_segments_metadata: {
              [translation.order]: {
                id: translation.original_segment_id,
                timestamp: translation.original_segment_timestamp
              }
            },
            segment_ids: existingTranslation?.id ? [existingTranslation.id] : undefined
          })).unwrap();
      
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
        <div>
            <h1>Edit Translation - {sourceData?.name} ({getLanguageName(sourceData?.language || '')})</h1>
            <Box sx={{ display: "flex", justifyContent: "center", gap: "16px", mb: "20px" }}>
                <Button variant="contained" color="primary" disabled={!isAllTranslated} onClick={handleExportDocx} style={{ marginBottom: "16px" }}>
                    Export to DOCX
                </Button>
                <Button variant="outlined" color="primary" onClick={() => navigate("/")} style={{ marginBottom: "16px" }}>
                    <ArrowBackIcon /> Back to Sources
                </Button>

            </Box>
            <TableContainer component={Paper} >
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Order</TableCell>
                            <TableCell style={{ width: "40%" }}>Source ({originalSourceId && getLanguageName(sources[originalSourceId]?.language) || 'Unknown'})</TableCell>
                            <TableCell style={{ width: "40%" }}>Translation ({getLanguageName(sourceData?.language || '')})</TableCell>
                            <TableCell style={{ width: "20%" }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {originalSourceId && segments[originalSourceId] && parsedId ? (
                            [...segments[originalSourceId]]
                            .sort((a, b) => a.order - b.order)
                            .map((sourceSegment: Segment) => {
                                const existingTranslation = segments[parsedId]?.find(t => t.order === sourceSegment.order)?.text || '';
                                const hasChanged = sourceSegment.id !== undefined && (translations[sourceSegment.id]?.text ?? existingTranslation) !== existingTranslation;

                                return (
                                    <TableRow key={sourceSegment.id ?? `temp-${sourceSegment.order}`}>
                                        <TableCell>{sourceSegment.order}</TableCell>
                                        <TableCell style={{ wordBreak: "break-word", whiteSpace: "pre-wrap", verticalAlign: "top" }}>{sourceSegment.text}</TableCell>
                                        <TableCell style={{ wordBreak: "break-word", whiteSpace: "pre-wrap", verticalAlign: "top" }}>
                                            <TextField
                                                fullWidth
                                                multiline
                                                minRows={2}
                                                maxRows={8}
                                                value={sourceSegment.id !== undefined ? translations[sourceSegment.id]?.text ?? existingTranslation : existingTranslation}
                                                onChange={(e) => handleTranslationChange(
                                                    sourceSegment.id!, //non-null assertion operator
                                                    sourceSegment.order,
                                                    sourceSegment.timestamp || "", 
                                                    e.target.value
                                                )}
                                                placeholder="Enter translation"
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
        </div>
    );
};

export default SourceEdit;
