import React, { useEffect, useState } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { useSelector } from 'react-redux';
import { useNavigate } from "react-router-dom";
import { fetchSources, addSource } from '../SourceSlice';
import { saveSegments as storeSegments } from '../SegmentSlice';
import { useAppDispatch, RootState } from '../store';
import { Box, Typography } from '@mui/material';
import { segmentService } from '../services/segment.service';
import { translateParagraphs as translateParagraphsAPI } from '../services/translation.service';
import SourceTable from '../cmp/SourceTable';
import { useToast } from '../cmp/Toast';
import TranslateForm from '../cmp/TranslateForm';
import { Source, Segment, SourcePair } from '../types/frontend-types';

const SourceIndex: React.FC = () => {
    const { keycloak } = useKeycloak();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { showToast } = useToast();
    const { sources, loading, error } = useSelector((state: RootState) => state.sources);

    const sourcePairs = buildSourcePairs(sources);

    useEffect(() => {
        if (keycloak.authenticated) {
            dispatch(fetchSources());
        }
    }, [dispatch, keycloak.authenticated]);

    function buildSourcePairs(sources: Record<number, Source>): SourcePair[] {
        return Object.values(sources)
            .filter(s => !s.original_source_id)
            .map(original => {
                const translated = Object.values(sources).find(
                    s => s.original_source_id === original.id
                ) || null;

                return { original, translated };
            });
    }

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
                order: index + 1,
                properties,
                original_segment_id: originalSegment?.id,
                original_segment_timestamp: originalSegment?.timestamp
            });
        });
        const { segments: savedSegments } = await dispatch(storeSegments(segments)).unwrap();
        return savedSegments;
    };

    const handleTranslateDocumentSubmit = async (data: {
        file: File;
        name: string;
        source_language: string;
        target_language: string;
    }) => {
        try {
            console.log("🚀 Starting full translation flow");

            const { originalSource, translationSource } = await createSources(data);
            const { paragraphs, properties } = await extractParagraphsFromFile(data.file);

            const savedOriginalSegments = await buildAndSaveSegments(
                paragraphs,
                originalSource.id,
                properties
            );

            const { translated_paragraphs, properties: providerProperties, total_segments_translated } =
                await translateParagraphs(paragraphs, data.source_language, data.target_language);

            await buildAndSaveSegments(
                translated_paragraphs,
                translationSource.id,
                providerProperties,
                savedOriginalSegments
            );

            showToast(`${total_segments_translated} segments translated & saved!`, "success");
            navigate(`/source-edit/${translationSource.id}`);
        } catch (error) {
            console.error("❌ Translation flow failed:", error);
            showToast("Translation process failed. Please try again.", "error");
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

    const extractParagraphsFromFile = async (file: File): Promise<{ paragraphs: string[], properties: object }> => {
        return await segmentService.extractParagraphs(file);
    };

    const translateParagraphs = async (
        paragraphs: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<{
        translated_paragraphs: string[],
        properties: Record<string, any>,
        total_segments_translated: number
    }> => {
        try {
            const response = await translateParagraphsAPI(paragraphs, sourceLang, targetLang);
            showToast(`${response.total_segments_translated} segments translated successfully!`, "success");
            return response;
        } catch (error) {
            console.error("❌ Error translating segments:", error);
            showToast("Translation failed. Please try again.", "error");
            return {
                translated_paragraphs: [],
                properties: {},
                total_segments_translated: 0
            };
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
        <>
          
          <Box sx={{ backgroundColor: '#f5f5f5', py: 5 }}>
            <Box maxWidth="md" mx="auto">
              <TranslateForm onSubmit={handleTranslateDocumentSubmit} />
            </Box>
          </Box>
      
         
          <Box className="source-index" sx={{ px: 4, pt: 4 }}>
            {loading && <Typography>Loading...</Typography>}
            {error && <Typography color="error">Error: {error}</Typography>}
            {!loading && !error && <SourceTable pairs={sourcePairs} />}
          </Box>
        </>
      );
};

export default SourceIndex;
