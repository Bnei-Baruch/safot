import React, { useEffect, useState, useMemo } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { useSelector } from 'react-redux';
import { useNavigate } from "react-router-dom";
import { fetchSources, addSource } from '../SourceSlice';
import { fetchSegments, saveSegments as storeSegments } from '../SegmentSlice';
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
import { PAGE_SIZE } from '../constants/pagination';
import { ruleService } from '../services/rule.service';

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
    const [translationLoading, setTranslationLoading] = useState(false);

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
        setTranslationLoading(true);
        try {
            // Step 1: Create original and translation sources
            const { originalSource, translationSource } = await createSources(data);
    
            // Step 2: Create new dictionary for the translation source
            const { dictionary_id, dictionary_timestamp } = await dictionaryService.createNewDictionary(translationSource.id);
            
            // Step 3: Create initial prompt rule for the dictionary
            // await ruleService.createPromptRule(dictionary_id, dictionary_timestamp, "prompt_1", "initial_prompt_rule");
            const promptKey = "prompt_1";
            const { promptText } = ruleService.buildPromptString({
                promptKey,
                sourceLanguage: data.source_language,
                targetLanguage: data.target_language,
            });

            await ruleService.createPromptRule(
                dictionary_id,
                dictionary_timestamp,
                promptKey,
                promptText,
                "initial_prompt_rule",
                []
            );

            // Step 4: Extract paragraphs from uploaded file
            const { paragraphs, properties } = await extractParagraphsFromFile(data.file);
    
            // Step 5: Save original segments to database
            const savedOriginalSegments = await buildAndSaveSegments(
                paragraphs,
                originalSource.id,
                properties
            );
    
            if (data.step_by_step) {
                // Step 6a-1: Step-by-step translation (first 10 paragraphs only)
                const firstChunk = paragraphs.slice(0, 10);
                console.log("Step-by-step translation started");
    
                const { translated_paragraphs, properties: providerProperties } =
                    await translateParagraphs(firstChunk, data.source_language, data.target_language,  promptText);
    
                // Step 6a-2: Save translated segments to database
                const savedTranslatedSegments = await buildAndSaveSegments(
                    translated_paragraphs,
                    translationSource.id,
                    providerProperties,
                    savedOriginalSegments
                );
    
                if (savedTranslatedSegments.length > 0) {
                    // Step 6a-3: Fetch segments and navigate to edit page
                    await dispatch(fetchSegments({ source_id: translationSource.id, offset: 0, limit: PAGE_SIZE }));
                    await dispatch(fetchSegments({ source_id: originalSource.id, offset: 0, limit: PAGE_SIZE })); 
                    navigate(`/source-edit/${translationSource.id}`);

                } else {
                    showToast("No segments were translated. Please try again.", "error");
                }
    
            } else {
                // Step 6b-1: Full translation (all paragraphs)
                const { translated_paragraphs, properties: providerProperties, total_segments_translated } =
                    await translateParagraphs(paragraphs, data.source_language, data.target_language,  promptText );
    
                // Step 6b-2: Save translated segments to database
                const savedTranslatedSegments = await buildAndSaveSegments(
                    translated_paragraphs,
                    translationSource.id,
                    providerProperties,
                    savedOriginalSegments
                );
    
                if (savedTranslatedSegments.length > 0) {
                    showToast(`${total_segments_translated} segments translated & saved!`, "success");
                    // Step 6b-3: Fetch segments and navigate to edit page
                    await dispatch(fetchSegments({ source_id: translationSource.id, offset: 0, limit: PAGE_SIZE }));
                    navigate(`/source-edit/${translationSource.id}`);
                } else {
                    showToast("No segments were translated. Please try again.", "error");
                }
            }
        } catch (error) {
            console.error("❌ Translation flow failed:", error);
            showToast("Translation process failed. Please try again.", "error");
        } finally {
            setTranslationLoading(false);
        }
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
        targetLang: string,
        promptText: string
    ): Promise<{
        translated_paragraphs: string[],
        properties: Record<string, any>,
        total_segments_translated: number
    }> => {
        try {
            const response = await translateParagraphsAPI(paragraphs, sourceLang, targetLang, promptText);
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
                        <TranslateForm onSubmit={handleTranslateDocumentSubmit} loading={translationLoading} />
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
