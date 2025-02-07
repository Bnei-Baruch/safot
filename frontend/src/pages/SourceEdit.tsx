import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from "react-router-dom";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button } from "@mui/material";
import { fetchSegments, addSegment, translateSegments, Segment } from '../SegmentSlice';
import { fetchSource } from '../SourceSlice';
import { useAppDispatch, RootState } from '../store';
import { useToast } from '../cmp/Toast';

const SourceEdit: React.FC = () => {
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

    const handleTranslationChange = (segmentId: number, order: number, timestamp: string, value: string) => {
        setTranslations(prev => ({
            ...prev,
            [segmentId]: {
                text: value,
                order,
                original_segment_id: segmentId,
                original_segment_timestamp: timestamp
            }
        }));
    };

    const handleSaveTranslation = async (segmentId: number) => {
        if (!parsedId || !translations[segmentId]) return;

        const segmentToSave = {
            source_id: parsedId,
            order: translations[segmentId].order,
            text: translations[segmentId].text,
            original_segment_id: translations[segmentId].original_segment_id,
            original_segment_timestamp: translations[segmentId].original_segment_timestamp || undefined,
            properties: {
                translation_type: "user" as "user"
            }
        };
        console.log("Sending segment data to backend:", segmentToSave);
        try {
            await dispatch(addSegment(segmentToSave)).unwrap();
            showToast("Translation saved successfully!", "success");
            setTranslations(prev => {
                const updated = { ...prev };
                delete updated[segmentId];
                return updated;
            });
        } catch (error) {
            console.error("Error saving translation:", error);
            showToast("Failed to save translation. Please try again.", "error");
        }
    };

    const handleTranslateAll = async () => {
        if (!parsedId || !originalSourceId) return;
        try {
            await dispatch(translateSegments({ source_id: parsedId, original_source_id: originalSourceId })).unwrap();
            showToast("Translation completed successfully!", "success");
        } catch (error) {
            console.error("Error translating segments:", error);
            showToast("Failed to translate. Please try again.", "error");
        }
    };

    return (
        <div>
            <h1>Edit Translation - {sourceData?.name} ({sourceData?.language})</h1>
            <Button
                variant="contained"
                color="secondary"
                onClick={handleTranslateAll}
                style={{ marginBottom: "20px" }}
            >
                Translate All
            </Button>
            <TableContainer component={Paper} >
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Order</TableCell>
                            <TableCell style={{ width: "40%" }}>Source ({originalSourceId && sources[originalSourceId]?.language || 'Unknown'})</TableCell>
                            <TableCell style={{ width: "40%" }}>Translation ({sourceData?.language})</TableCell>
                            <TableCell style={{ width: "20%" }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {originalSourceId && segments[originalSourceId] && parsedId ? (
                            segments[originalSourceId].map((sourceSegment: Segment) => {
                                const existingTranslation = segments[parsedId]?.find(t => t.order === sourceSegment.order)?.text || '';
                                const hasChanged = (translations[sourceSegment.id]?.text ?? existingTranslation) !== existingTranslation;

                                return (
                                    <TableRow key={sourceSegment.id}>
                                        <TableCell>{sourceSegment.order}</TableCell>
                                        <TableCell style={{ wordBreak: "break-word", whiteSpace: "pre-wrap", verticalAlign: "top" }}>{sourceSegment.text}</TableCell>
                                        <TableCell style={{ wordBreak: "break-word", whiteSpace: "pre-wrap", verticalAlign: "top" }}>
                                            <TextField
                                                fullWidth
                                                multiline
                                                minRows={2}
                                                maxRows={8}
                                                value={translations[sourceSegment.id]?.text ?? existingTranslation}
                                                onChange={(e) => handleTranslationChange(
                                                    sourceSegment.id,
                                                    sourceSegment.order,
                                                    sourceSegment.original_segment_timestamp ?? '',
                                                    e.target.value
                                                )}
                                                placeholder="Enter translation"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                onClick={() => handleSaveTranslation(sourceSegment.id)}
                                                disabled={!hasChanged}
                                            >
                                                Save
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

