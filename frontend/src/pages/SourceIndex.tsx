import React, { useEffect, useState, useMemo } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { useSelector } from 'react-redux';
import { useNavigate } from "react-router-dom";
import { fetchSources, addSource } from '../SourceSlice';
import { saveSegments as storeSegments } from '../SegmentSlice';
import { useAppDispatch, RootState } from '../store';
import { Box, Typography, Container } from '@mui/material';

import { dictionaryService } from '../services/dictionary.service';
import { segmentService } from '../services/segment.service';
import { translateParagraphs as translateParagraphsAPI } from '../services/translation.service';
import SourceTable from '../cmp/SourceTable';
import SourceFilter from '../cmp/SourceFilter';
import { useToast } from '../cmp/Toast';
import TranslateForm from '../cmp/TranslateForm';
import { Segment, SourcePair, FilterType, TranslateFormData } from '../types/frontend-types';

const SourceIndex: React.FC = () => {
    const { keycloak } = useKeycloak();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { showToast } = useToast();
    const { sources, loading, error } = useSelector((state: RootState) => state.sources);

    const [filterType, setFilterType] = useState<FilterType>('mine');
    const [languageFilter, setLanguageFilter] = useState<string | null>(null);
    const [fileNameFilter, setFileNameFilter] = useState<string>('');
    const [fromLanguageFilter, setFromLanguageFilter] = useState<string | null>(null);
    useEffect(() => {
        if (keycloak.authenticated) {
            dispatch(fetchSources());
        }
    }, [dispatch, keycloak.authenticated]);

    const sourcePairs = useMemo<SourcePair[]>(() => {
        return Object.values(sources)
            .filter(s => !s.original_source_id)
            .map(original => {
                const translated = Object.values(sources).find(
                    s => s.original_source_id === original.id
                ) || null;
                return { original, translated };
            });
    }, [sources]);

    const filteredSourcePairs = useMemo<SourcePair[]>(() => {
        return sourcePairs.filter(pair => {
          if (filterType === 'mine') {
            return pair.original.username === keycloak.tokenParsed?.preferred_username;
          }
    
          if (filterType === 'file') {
            return pair.original.name.toLowerCase().includes(fileNameFilter.toLowerCase());
          }
    
          if (filterType === 'language') {
            return !languageFilter || pair.translated?.language === languageFilter;
          }
          if (filterType === 'from_language') {
            return !fromLanguageFilter || pair.original.language === fromLanguageFilter;
          }
    
          return true; // 'none'
        });
      }, [sourcePairs, filterType, fileNameFilter, languageFilter, fromLanguageFilter, keycloak.tokenParsed]);

    const handleTranslateDocumentSubmit = async (data: TranslateFormData) => {
        try {
            const { originalSource, translationSource } = await createSources(data);
    
            await dictionaryService.setupDictionaryForSource(translationSource.id);
            const { paragraphs, properties } = await extractParagraphsFromFile(data.file);
    
            const savedOriginalSegments = await buildAndSaveSegments(
                paragraphs,
                originalSource.id,
                properties
            );
    
            if (data.step_by_step) {
                const firstChunk = paragraphs.slice(0, 10);
                console.log("Step-by-step translation started");
    
                const { translated_paragraphs, properties: providerProperties } =
                    await translateParagraphs(firstChunk, data.source_language, data.target_language);
    
                const savedTranslatedSegments = await buildAndSaveSegments(
                    translated_paragraphs,
                    translationSource.id,
                    providerProperties,
                    savedOriginalSegments
                );
    
                if (savedTranslatedSegments.length > 0) {
                    navigate(`/source-edit/${translationSource.id}`);
                } else {
                    showToast("No segments were translated. Please try again.", "error");
                }
    
            } else {
                const { translated_paragraphs, properties: providerProperties, total_segments_translated } =
                    await translateParagraphs(paragraphs, data.source_language, data.target_language);
    
                const savedTranslatedSegments = await buildAndSaveSegments(
                    translated_paragraphs,
                    translationSource.id,
                    providerProperties,
                    savedOriginalSegments
                );
    
                if (savedTranslatedSegments.length > 0) {
                    showToast(`${total_segments_translated} segments translated & saved!`, "success");
                    navigate(`/source-edit/${translationSource.id}`);
                } else {
                    showToast("No segments were translated. Please try again.", "error");
                }
            }
        } catch (error) {
            console.error("❌ Translation flow failed:", error);
            showToast("Translation process failed. Please try again.", "error");
        }
    };
    
    // const handleTranslateDocumentSubmit = async (data: TranslateFormData) => {
    //     try {
    //         const { originalSource, translationSource } = await createSources(data);
    //         // Setup dictionary for target source
    //         await dictionaryService.setupDictionaryForSource(translationSource.id);
    //         const { paragraphs, properties } = await extractParagraphsFromFile(data.file);

    //         const savedOriginalSegments = await buildAndSaveSegments(
    //             paragraphs,
    //             originalSource.id,
    //             properties
    //         );

    //         if (data.step_by_step) {
    //             const firstChunk = paragraphs.slice(0, 10);
    //             console.log("Step-by-step translation started");
    //             const { translated_paragraphs, properties: providerProperties } =
    //               await translateParagraphs(firstChunk, data.source_language, data.target_language);
          
    //             await buildAndSaveSegments(
    //               translated_paragraphs,
    //               translationSource.id,
    //               providerProperties,
    //               savedOriginalSegments
    //             );
          
    //             navigate(`/source-edit/${translationSource.id}`);
    //         } else {
    //                 const { translated_paragraphs, properties: providerProperties, total_segments_translated } =
    //                     await translateParagraphs(paragraphs, data.source_language, data.target_language);

    //                 await buildAndSaveSegments(
    //                     translated_paragraphs,
    //                     translationSource.id,
    //                     providerProperties,
    //                     savedOriginalSegments
    //                 );

    //                 showToast(`${total_segments_translated} segments translated & saved!`, "success");
    //                 navigate(`/source-edit/${translationSource.id}`);
    //         }
    //     } catch (error) {
    //         console.error("❌ Translation flow failed:", error);
    //         showToast("Translation process failed. Please try again.", "error");
    //     }
    // };

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

    const createSources = async (data: TranslateFormData) => {
        const normalizeName = (filename: string) =>
            filename.replace(/\.docx$/i, '').trim().replace(/\s+/g, '-');

        const baseName = normalizeName(data.name);

        const originalSource = await dispatch(addSource({
            name: baseName,
            language: data.source_language
        } as any)).unwrap();

        const translatedSource = await dispatch(addSource({
            name: `${baseName}-${data.target_language}`,
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
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh" textAlign="center">
                <Typography variant="h4">Please log in to continue.</Typography>
            </Box>
        );
    }

    return (
        <>
            <Box sx={{ backgroundColor: '#f5f5f5', py: 5, width: '100%' }}>
                <Container maxWidth="lg">
                    <Box sx={{ pl: 9 }}>
                        <TranslateForm onSubmit={handleTranslateDocumentSubmit} />
                    </Box>
                </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ pl: 9 }}>
                    <SourceFilter
                    filterType={filterType}
                    setFilterType={setFilterType}
                    languageFilter={languageFilter}
                    setLanguageFilter={setLanguageFilter}
                    fileNameFilter={fileNameFilter}
                    setFileNameFilter={setFileNameFilter}
                    fromLanguageFilter={fromLanguageFilter}
                    setFromLanguageFilter={setFromLanguageFilter}
                    />

                    {loading && <Typography>Loading...</Typography>}
                    {error && <Typography color="error">Error: {error}</Typography>}
                    {!loading && !error && <SourceTable pairs={filteredSourcePairs} />}
                </Box>
            </Container>
        </>
    );
};

export default SourceIndex;
