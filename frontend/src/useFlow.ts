import { useCallback, useState } from 'react';

import { translateParagraphs } from './services/translation.service';
import { getPrompt, postPromptDictionary } from './services/dictionary.service';
import { buildSegment, extractParagraphs, extractText, ExtractTextResult, postSegments } from './services/segment.service';
import { getSource, postSource, postSourceOriginLinks } from './services/source.service';
import { Segment, Source } from './types/frontend-types';

export interface AdditionalSourceInfo {
  file: File;
  name: string;
  language: string;
  id?: number;
}

// import compareTwoStrings from 'string-similarity-js';
const DEFAULT_PROMPT_KEY = 'prompt_1';
const ADDITIONAL_SOURCES_TEXT_LENGTH_MULTIPLIER = 1.5;

const buildAndSaveSegments = async (
  paragraphs: string[],
  source_id: number,
  properties: Record<string, any>,
  originalSegments?: Segment[],
  additional_sources_segments?: Record<string, string[]>
): Promise<Segment[]> => {
  return await postSegments({
    paragraphs,
    source_id,
    properties,
    originalSegments,
    additional_sources_segments
  });
};

const initSourceFromFile = async (file: File, name: string, originalLanguage: string, translatedLanguage: string, dictionaryId: null|number, dictionaryTimestamp: null|string, additionalSources: AdditionalSourceInfo[] = [])
  : Promise<{originalSegments: Segment[], translatedSourceId: number, additionalSourcesText: ExtractTextResult[]}> => {
  // Create original and translation sources
  const { originalSourceId, translatedSourceId, additionalSourceIds } = await createSources(name, originalLanguage, translatedLanguage, dictionaryId, dictionaryTimestamp, additionalSources);

  // Extract paragraphs from uploaded file
  const { paragraphs, properties } = await extractParagraphs(file);

  // Extract text from all additional sources and store temporal segments
  let additionalSourcesText: ExtractTextResult[] = [];
  if (additionalSources.length > 0) {
    additionalSources.forEach((source, index) => {
      source.id = additionalSourceIds[index];
    });
    const extractedTexts = await extractText(additionalSources);
    // Map language and id information to ExtractTextResult
    additionalSourcesText = extractedTexts.map((result, index) => ({
      ...result,
      language: additionalSources[index].language,
      id: additionalSources[index].id,
    }));
  }

  return {
    // Save original segments to database
    originalSegments: await buildAndSaveSegments(paragraphs, originalSourceId, properties),
    translatedSourceId,
    additionalSourcesText,
  }
}


  /*const getNextBatch = (): Segment[] => {
    if (!originalSourceId || !sourceId) return [];
  
    const sourceSegments = getCurrentOriginalSegments();
    const targetSegments = getCurrentTranslatedSegments();
    const translatedOrders = new Set(targetSegments.map(seg => seg.order));
  
    const batch: Segment[] = [];
  
    for (const seg of sourceSegments) {
      if (!translatedOrders.has(seg.order)) {
        batch.push(seg);
        if (batch.length === 20) break;
      }
    }
  
    return batch;
  };*/

  /*
  const getSavedExamples = (maxCount: number = 5): Example[] => {
    if (!sourceId || !originalSourceId) return [];
  
    const sourceSegments = getCurrentOriginalSegments();
    const targetSegments = getCurrentTranslatedSegments();
  
    // Group translated segments by order
    const byOrder: { [order: number]: Segment[] } = {};
    for (const seg of targetSegments) {
      if (!seg.text?.trim() || !seg.timestamp) continue;
      (byOrder[seg.order] ||= []).push(seg);
    }
  
    const examples: Example[] = [];
  
    for (const orderStr in byOrder) {
      const order = Number(orderStr);
      const segs = byOrder[order];
      if (segs.length < 2) continue;
  
      // sort ascending by timestamp and take first/last
      const sorted = segs.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));
      const first = (sorted[0].text || '').trim();
      const last  = (sorted[sorted.length - 1].text || '').trim();
  
      const sourceText = (sourceSegments.find(s => s.order === order)?.text || '').trim();
      if (!sourceText || first === last) continue;
  
      // similarity in [0..1]; score = delta magnitude
      const score = 1 - compareTwoStrings(first, last);
  
      examples.push({
        sourceText,
        firstTranslation: first,
        lastTranslation: last,
        score
      });
    }
  
    // sort by score desc and cap by maxCount
    return examples.sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0)).slice(0, maxCount);
  };
  */

  /*
  const handleTranslateMore = async () => {
    const batch = getNextBatch();
    if (!batch.length) {
      showToast("No more paragraphs to translate.", "info");
      return;
    }
  
    setTranslateMoreLoading(true);
    try {
      // 1 Create new dictionary version
      const { dictionary_id: dictionaryId, dictionary_timestamp: dictionaryTimestamp } = 
      await createNewDictionaryVersion(sourceId!);
  
      // 2 Build and save example rules if any
      const examples = getSavedExamples(5);
      if (examples.length > 0) {
          await createExampleRules(dictionaryId, dictionaryTimestamp, examples);
      }
      // 3 Build and save prompt
      const { promptText } = await buildPromptAndSave(dictionaryId, dictionaryTimestamp);
  
      // 4 Translate paragraphs
      const paragraphs = batch.map(seg => seg.text);
      const { translated_paragraphs, properties, total_segments_translated } =
      await translateParagraphs(
          paragraphs,
          sources[originalSourceId!].language,
          source?.language!,
          promptText,
          dictionaryId,
          dictionaryTimestamp,
          examples
      );
  
      // 4 Save segments
      const segments = await buildAndSaveSegments(translated_paragraphs, sourceId!, properties, batch);
      showToast(`${total_segments_translated} segments translated & saved!`, "success");
      return segments;
    } catch (err) {
      console.error("Translate More failed:", err);
      showToast("Failed to translate more paragraphs.", "error");
    } finally {
      setTranslateMoreLoading(false);
    }
  };
  */

  /*
  const buildPromptAndSave = async (
    dictionaryId: number,
    dictionaryTimestamp: string
  ) => {
    const { promptKey, selectedExamples, usedRuleIds } =
      await ruleService.selectRulesForPrompt(dictionaryId, 20);
  
 
    const { promptText } = ruleService.buildPromptString({
      promptKey,
      originalLanguageuage: sources[originalSourceId!].language,
      translatedLanguage: source?.language!,
      examples: selectedExamples,
    });
  
    
    await ruleService.createPromptRule(
      dictionaryId,
      dictionaryTimestamp,
      promptKey,
      promptText,
      "translate_more_prompt",
      usedRuleIds
    );
  
    return { promptKey, promptText, usedRuleIds, examples: selectedExamples };
  };
  */

const normalizeName = (filename: string) => filename.replace(/\.docx$/i, '').trim().replace(/\s+/g, '-');

const createSources = async (name: string, originalLanguage: string, translatedLanguage: string, dictionaryId: null|number, dictionaryTimestamp: null|string, additionalSources: AdditionalSourceInfo[] = [])
  : Promise<{originalSourceId: number, translatedSourceId: number, additionalSourceIds: number[]}> => {
  const baseName = normalizeName(name);

  const originalSource = await postSource({
    name: baseName,
    language: originalLanguage,
    properties: {
      is_original: true,
    },
  });
  console.log(originalSource);

  const translatedSource = await postSource({
    name: `${baseName}-${translatedLanguage}`,
    language: translatedLanguage,
    original_source_id: originalSource.id,
    dictionary_id: dictionaryId || undefined,
    dictionary_timestamp: dictionaryTimestamp || undefined,
    properties: {
      is_original: false,
    },
  });
  console.log(translatedSource);

  // Create source entries for all additional sources
  const additionalSourceIds: number[] = [];
  for (const additionalSource of additionalSources) {
    const additionalSourceEntry = await postSource({
      name: `${baseName}`,
      language: additionalSource.language,
      properties: {
        is_original: false,
      },
    });
    additionalSourceIds.push(additionalSourceEntry.id);
    console.log('Created additional source:', additionalSourceEntry);
  }

  // Create links between all sources and the translated source
  await postSourceOriginLinks(originalSource.id, additionalSourceIds, translatedSource.id);
  console.log('Created source origin links for:', {
    originalSourceId: originalSource.id,
    additionalSourceIds,
    translatedSourceId: translatedSource.id,
  });

  return { 
    originalSourceId: originalSource.id,
    translatedSourceId: translatedSource.id,
    additionalSourceIds,
  };
};

export function useFlow() {
  const [loadingCount, setLoadingCount] = useState<number>(0);

  const translateSegments = useCallback(async (originalSegments: Segment[], translatedSourceId: number, originalLanguage: string, translatedLanguage: string, additionalSourcesText: ExtractTextResult[] = [])
    : Promise<{translatedSegments: Segment[], translatedSourceId: number}> => {
    setLoadingCount(prev => prev + 1);
    try {
      const translatedSource = await getSource(translatedSourceId);
      const promptKey = "prompt_1"; // Hard-coded default prompt key.
      let promptText = "";
      const num_additional_sources = additionalSourcesText.length;
      if (translatedSource.dictionary_id) {
        promptText = await getPrompt({dictionary_id: translatedSource.dictionary_id, dictionary_timestamp: translatedSource.dictionary_timestamp_epoch, num_additional_sources});
      } else {
        promptText = await getPrompt({prompt_key: promptKey, original_language: originalLanguage, translated_language: translatedLanguage, num_additional_sources});
      }
      console.log('Using following prompt: ', promptText);

      // Map additionalSourcesText to format expected by translateParagraphs
      const additionalSources = additionalSourcesText
        .filter(source => source.language && source.id) // Only include sources with language and id
        .map(sourceText => ({
          text: sourceText.text,
          language: sourceText.language!,
          source_id: sourceText.id!,
        }));

      const { translated_paragraphs, additional_sources_segments, properties: translationProperties } =
          await translateParagraphs(originalSegments.map((segment) => segment.text), promptText, additionalSources);
      console.log('translated_paragraphs: ', translated_paragraphs);
      console.log('additional_sources_segments: ', additional_sources_segments);
      const properties: Record<string, any> = {
        translation: translationProperties,
      };

      if (translatedSource.dictionary_id) {
        properties["dictionary_id"] = translatedSource.dictionary_id;
        properties["dictionary_timestamp"] = translatedSource.dictionary_timestamp_epoch;
      } else {
        properties["prompt_key"] = promptKey;
      }

      // Save translated segments to database
      return {
        translatedSegments: await buildAndSaveSegments(translated_paragraphs, translatedSourceId, properties, originalSegments, additional_sources_segments),
        translatedSourceId,
      };
    } finally {
      setLoadingCount(prev => prev - 1);
    }
  }, [setLoadingCount]);

  const translateFile = useCallback(async (file: File, name: string, originalLanguage: string, translatedLanguage: string, stepByStep: boolean, dictionaryId: null|number, dictionaryTimestamp: null|string, additionalSources: AdditionalSourceInfo[] = [])
    : Promise<{translatedSegments: Segment[], translatedSourceId: number}> => {
    console.log(dictionaryId, dictionaryTimestamp)
    console.log('Additional sources:', additionalSources);
    setLoadingCount(prev => prev + 1);
    try {
      const { originalSegments, translatedSourceId, additionalSourcesText } = await initSourceFromFile(file, name, originalLanguage, translatedLanguage, dictionaryId, dictionaryTimestamp, additionalSources);

      // Step-by-step translation (first 10 paragraphs only)
      const originalSegmentsChunk = stepByStep ? originalSegments.slice(0, 10) : originalSegments;

      // Adjust additional sources text length to match combined originalSegmentsChunk length * multiplier
      const combinedOriginalTextLength = originalSegmentsChunk.reduce((sum, segment) => sum + segment.text.length, 0);
      const targetLength = Math.floor(combinedOriginalTextLength * ADDITIONAL_SOURCES_TEXT_LENGTH_MULTIPLIER);
      
      additionalSourcesText.forEach(result => {
        result.text = result.text.substring(0, targetLength);
      });

      return await translateSegments(originalSegmentsChunk, translatedSourceId, originalLanguage, translatedLanguage, additionalSourcesText);
    } finally {
      setLoadingCount(prev => prev - 1);
    }
  }, [setLoadingCount, translateSegments]);

  // Consider spliting this method into two, one with source and other without.
  const createDefaultDict = useCallback(async (source?: Source): Promise<Source | undefined> => {
    setLoadingCount(prev => prev + 1);
    try {
      let name = "New dictionary";
      let originalLanguage = undefined;
      const translatedLanguage = (source && source.language) || undefined;
      if (source && source.original_source_id) {
        const originalSource = await getSource(source.original_source_id);
        originalLanguage = originalSource && originalSource.language;
        name = source && source.name ? `Dictionary for "${source.name}"` : "New dictionary";
      }
      const dictionary = await postPromptDictionary({
        name,
        // Set default dictionary content.
        prompt_key: DEFAULT_PROMPT_KEY,
        original_language: originalLanguage,
        translated_language: translatedLanguage,
       });
      // Update source with dictionary
      if (source) {
        const sourceToUpdate = {
          ...source,
          dictionary_id: dictionary.id,
          dictionary_timestamp: dictionary.timestamp,
        }
        return postSource(sourceToUpdate);
      }
      return;
    } finally {
      setLoadingCount(prev => prev - 1);
    }
  }, [setLoadingCount]);

  return {
    createDefaultDict,
    loadingCount,
    translateFile,
    translateSegments,
  };
}

