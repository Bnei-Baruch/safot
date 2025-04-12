import React, { useEffect, useState } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { useSelector } from 'react-redux';
import { useNavigate } from "react-router-dom";
import { fetchSources, addSource } from '../SourceSlice';
import { addSegmentsFromFile, fetchSegments, saveSegments as storeSegments } from '../SegmentSlice';
import { useAppDispatch, RootState } from '../store';
import {
    Button,
    Box,
    Typography
} from '@mui/material';
import { segmentService } from '../services/segment.service';
import { translateSegments  as translateSegmentsAPI } from '../services/translation.service'
import AddSourceDialog from '../cmp/AddSourceDialog';
import TranslateDocumentDialog from '../cmp/TranslateDocumentDialog';
import SourceTable from '../cmp/SourceTable';
import { useToast } from '../cmp/Toast';
import { Source, Segment, SourcePair } from '../types';

interface AddSourceData {
    file?: File;
    name: string;
    labels: string[];
    language: string;
    type: string;
    order: number | null;
    properties: {
        category: string;
        description: string;
        audience: string;
    };
    original_source_id?: number;
}

const SourceIndex: React.FC = () => {
    const { keycloak } = useKeycloak();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { showToast } = useToast();
    const { sources, loading, error } = useSelector((state: RootState) => state.sources);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [translateDialogOpen, setTranslateDialogOpen] = useState(false);
    const [selectedSource, setSelectedSource] = useState<number | null>(null);
    const sourcePairs = buildSourcePairs(sources);
    
    useEffect(() => {
        if (keycloak.authenticated) {
            dispatch(fetchSources());
        }
    }, [dispatch, keycloak.authenticated]);

    function buildSourcePairs(sources: Record<number, Source>):SourcePair[] {
        return Object.values(sources)
            .filter(s => !s.original_source_id)
            .map(original => {
                const translated = Object.values(sources).find(
                    s => s.original_source_id === original.id
                ) || null;
    
                return { original, translated };
            });
    }

    const handleOpenDialog = (sourceId?: number) => {
        setSelectedSource(sourceId ?? null);
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setSelectedSource(null);
    };

    const handleAddSource = async (data: AddSourceData) => {
        const sourceData = {
            ...data,
            original_source_id: selectedSource,
        };
        try {
            const addedSource = await dispatch(addSource(sourceData as any)).unwrap();
            if (!addedSource.id) {
                throw new Error('Failed to get source ID from the backend.');
            }
            if (data.file) {
                await dispatch(addSegmentsFromFile({
                    file: data.file,
                    source_id: addedSource.id,
                    properties: { segment_type: "file" }
                })).unwrap();
            }
            dispatch(fetchSegments({ source_id: addedSource.id }));

            showToast('Source and segments created successfully!', 'success');
        } catch (error) {
            console.error('Failed to add source:', error);
            showToast('Failed to add source. Please try again.', 'error');
        } finally {
            handleCloseDialog();
        }
    };

    const handleTranslateDocumentSubmit = async (data: {
        file: File;
        name: string;
        source_language: string;
        target_language: string;
    }) => {
        try {
            console.log("🚀 Starting full translation flow");
    
            const { originalSource, translationSource: translationSource } = await createSources(data);
            const extractedSegments = await extractSegmentsFromFile(data.file, originalSource.id, {
                segment_type: "file"
            });

            console.log("📄 Extracted segments:", extractedSegments);
            // const segmentsFromFile = await saveSegments(extractedSegments);   
            const segmentsFromFile = await saveSegments(extractedSegments);
            
            const translatedSegments = await translateSegments(
                segmentsFromFile,
                translationSource.id,
                data.source_language,
                data.target_language
            );
    
            if (translatedSegments.length) {
                await saveSegments(translatedSegments); 
                navigate(`/source-edit/${translationSource.id}`);
            }
            // showToast("✅ Document translated and ready for editing", "success");
        } catch (error) {
            console.error("❌ Translation flow failed:", error);
            showToast("Translation process failed. Please try again.", "error");
        } finally {
            setTranslateDialogOpen(false);
        }
    };
    
    const createSources = async (data: {
        file: File;
        name: string;
        source_language: string;
        target_language: string;
    }) => {
        const normalizeName = (filename: string) =>
            filename.replace(/\.docx$/i, '').trim().replace(/\s+/g, '-');
    
        const baseName = normalizeName(data.name);
        const targetLang = data.target_language.toLowerCase().replace(/\s+/g, '-');
    
        const originalSource = await dispatch(addSource({
            name: baseName,
            language: data.source_language
        } as any)).unwrap();
    
        const translatedSource = await dispatch(addSource({
            name: `${baseName}-${targetLang}`,
            language: data.target_language,
            original_source_id: originalSource.id
        } as any)).unwrap();
    
        return { originalSource, translationSource: translatedSource };
    };
    
    const extractSegmentsFromFile = async (
        file: File,
        sourceId: number,
        properties: Record<string, any>
    ): Promise<Segment[]> => {
        return await segmentService.extractSegments(file, sourceId, properties);
    };

    const saveSegments = async (segments: Segment[]): Promise<Segment[]> => {
        try {
            const result = await dispatch(storeSegments(segments)).unwrap();
            console.log("✅ storeSegments response:", result);
    
            if (!result || !Array.isArray(result.segments)) {
                throw new Error("Invalid response from storeSegments");
            }
    
            showToast("✅ Segments saved successfully", "success");
            return result.segments;
        } catch (err) {
            console.error("❌ Failed to save segments:", err);
            showToast("Failed to save segments. Please try again.", "error");
            return [];
        }
    };

    // const saveSegments = async (segments: Segment[]): Promise<Segment[]> => {
    //     try {
    //         const result = await dispatch(storeSegments(segments)).unwrap();
    //         showToast("✅ Segments saved successfully", "success");
    //         return result.segments;
    //     } catch (err) {
    //         console.error("❌ Failed to save segments:", err);
    //         showToast("Failed to save segments. Please try again.", "error");
    //         return [];
    //     }
    // };

    const translateSegments = async (
        originalSegments: Segment[], 
        translatedSourceId: number, 
        sourceLang: string, 
        targetLang: string
    ) => {
        try {
            const response = await translateSegmentsAPI(
                translatedSourceId, 
                originalSegments, 
                targetLang, 
                sourceLang
            );
            showToast(`${response.total_segments_translated} segments translated successfully!`, "success");
            return response.translated_segments;
        } catch (error) {
            console.error("❌ Error translating segments:", error);
            showToast("Translation failed. Please try again.", "error");
            return [];
        }
    };
    
    

    if (!keycloak.authenticated) {
        return (
            <Box
                display="flex"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
                height="100vh"
                textAlign="center"
                sx={{
                    backgroundColor: "#f5f5f5",
                    padding: "2rem",
                    borderRadius: "12px",
                    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)"
                }}
            >
                <Typography variant="h4" sx={{ mb: 2, fontWeight: "bold", color: "#333" }}>
                    Welcome to Safot
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, color: "#666" }}>
                    Please log in using the button in the top right corner.
                </Typography>
            </Box>
        );
    }

    return (
        <div className="source-index">
            <h1>Source Index CMP</h1>
            <Button
                variant="contained"
                color="primary"
                onClick={() => handleOpenDialog()}
                style={{ marginBottom: '20px' }}
            >
                Add New Source
            </Button>
            <Button
                variant="outlined"
                color="secondary"
                onClick={() => setTranslateDialogOpen(true)}
                style={{ marginBottom: '20px', marginLeft: '10px' }}>
                Translate Document
            </Button>
            {loading && <p>Loading...</p>}
            {error && <p>Error: {error}</p>}
            {!loading && !error && (
                <SourceTable pairs={sourcePairs} />
            )}
            {dialogOpen && (
                <AddSourceDialog
                    open={dialogOpen}
                    onClose={handleCloseDialog}
                    onSubmit={handleAddSource}
                    mode={selectedSource ? "translation" : "new_source"}
                />
            )}
            {translateDialogOpen && (
                <TranslateDocumentDialog
                    open={translateDialogOpen}
                    onClose={() => setTranslateDialogOpen(false)}
                    onSubmit={handleTranslateDocumentSubmit}
                />
            )}
        </div>
    );
};

export default SourceIndex;
