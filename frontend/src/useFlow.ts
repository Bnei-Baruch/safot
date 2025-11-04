import { useCallback, useState } from 'react';

import { translateParagraphs } from './services/translation.service';
import { getPrompt, postPromptDictionary } from './services/dictionary.service';
import { buildSegment, extractParagraphs, postSegments, getSegments } from './services/segment.service';
import { getSource, postSource } from './services/source.service';
import { initializeMultiSource, translateMultiSourceBatch } from './services/multi-source.service';
import { Segment, Source } from './types/frontend-types';

// import compareTwoStrings from 'string-similarity-js';
const DEFAULT_PROMPT_KEY = 'prompt_1';

const buildAndSaveSegments = async (
  paragraphs: string[],
  source_id: number,
  properties: Record<string, any>,
  originalSegments?: Segment[]
): Promise<Segment[]> => {
  const segments = paragraphs.map((text, index) => {
    const originalSegment = originalSegments?.[index];
    return buildSegment({
      text,
      source_id,
      order: originalSegment?.order ?? index + 1,
      properties,
      original_segment_id: originalSegment?.id,
      original_segment_timestamp: originalSegment?.timestamp
    });
  });
  return await postSegments(segments);
};

const initSourceFromFile = async (file: File, name: string, originalLanguage: string, translatedLanguage: string)
  : Promise<{originalSegments: Segment[], translatedSourceId: number}> => {
  // Create original and translation sources
  const { originalSourceId, translatedSourceId } = await createSources(name, originalLanguage, translatedLanguage);

  // Extract paragraphs from uploaded file
  const { paragraphs, properties } = await extractParagraphs(file);

  return {
    // Save original segments to database
    originalSegments: await buildAndSaveSegments(paragraphs, originalSourceId, properties),
    translatedSourceId,
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

const createSources = async (name: string, originalLanguage: string, translatedLanguage: string)
  : Promise<{originalSourceId: number, translatedSourceId: number}> => {
  const baseName = normalizeName(name);

  const originalSource = await postSource({
    name: baseName,
    language: originalLanguage,
  });
  console.log(originalSource);

  const translatedSource = await postSource({
    name: `${baseName}-${translatedLanguage}`,
    language: translatedLanguage,
    original_source_id: originalSource.id,
  });
  console.log(translatedSource);

  return { 
    originalSourceId: originalSource.id,
    translatedSourceId: translatedSource.id,
  };
};

export function useFlow() {
  const [loadingCount, setLoadingCount] = useState<number>(0);

  const translateSegments = useCallback(async (originalSegments: Segment[], translatedSourceId: number, originalLanguage: string, translatedLanguage: string)
    : Promise<{translatedSegments: Segment[], translatedSourceId: number}> => {
    setLoadingCount(prev => prev + 1);
    try {
			const translatedSource = await getSource(translatedSourceId);
			const promptKey = "prompt_1";
			let promptText = "";
			if (translatedSource.dictionary_id) {
				promptText = await getPrompt({dictionary_id: translatedSource.dictionary_id, dictionary_timestamp: translatedSource.dictionary_timestamp_epoch});
			} else {
				promptText = await getPrompt({prompt_key: promptKey, original_language: originalLanguage, translated_language: translatedLanguage});
			}

      const { translated_paragraphs, properties: translationProperties } =
          await translateParagraphs(originalSegments.map((segment) => segment.text), promptText);

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
        translatedSegments: await buildAndSaveSegments(translated_paragraphs, translatedSourceId, properties, originalSegments),
        translatedSourceId,
      };
    } finally {
      setLoadingCount(prev => prev - 1);
    }
  }, [setLoadingCount]);

  const translateFile = useCallback(async (file: File, name: string, originalLanguage: string, translatedLanguage: string, stepByStep: boolean)
    : Promise<{translatedSegments: Segment[], translatedSourceId: number}> => {
    setLoadingCount(prev => prev + 1);
    try {
      const { originalSegments, translatedSourceId } = await initSourceFromFile(file, name, originalLanguage, translatedLanguage);

      // Step-by-step translation (first 10 paragraphs only)
      const originalSegmentsChunk = stepByStep ? originalSegments.slice(0, 10) : originalSegments;

      return await translateSegments(originalSegmentsChunk, translatedSourceId, originalLanguage, translatedLanguage);
    } finally {
      setLoadingCount(prev => prev - 1);
    }
  }, [setLoadingCount, translateSegments]);

  const translateMultiSource = useCallback(async (
    originSourceId: number,
    nonOriginSourceIds: number[],
    translatedSourceId: number,
    sourceLang: string,
    targetLang: string,
    stepByStep: boolean
  ): Promise<{translatedSegments: Segment[], translatedSourceId: number}> => {
    setLoadingCount(prev => prev + 1);
    try {
      // Get origin segments
      const originSegments = await getSegments(originSourceId);
      
      // Get prompt
      const translatedSource = await getSource(translatedSourceId);
      const promptKey = "prompt_1";
      let promptText = "";
      if (translatedSource.dictionary_id) {
        promptText = await getPrompt({dictionary_id: translatedSource.dictionary_id, dictionary_timestamp: translatedSource.dictionary_timestamp_epoch});
      } else {
        promptText = await getPrompt({prompt_key: promptKey, original_language: sourceLang, translated_language: targetLang});
      }
      
      // Initialize multi-source translation
      const initResult = await initializeMultiSource({
        origin_source_id: originSourceId,
        non_origin_source_ids: nonOriginSourceIds,
        translated_source_id: translatedSourceId
      });
      
      // Get non-origin texts from initialization response, or empty dict if not provided
      let nonOriginTexts: Record<number, string> = initResult.non_origin_texts || {};
      
      // Process segments in batches
      if (stepByStep) {
        // Step-by-step mode: Process first 10 segments only
        const batch = originSegments.slice(0, 10);
        
        const result = await translateMultiSourceBatch({
          origin_segment_batch: batch,
          non_origin_texts: nonOriginTexts,
          translated_source_id: translatedSourceId,
          prompt_text: promptText,
          source_language: sourceLang,
          target_language: targetLang
        });
        
        return {
          translatedSegments: result.translated_segments,
          translatedSourceId
        };
      } else {
        // Translate-all mode: Process all segments in batches of 10
        const batchSize = 10;
        const allTranslatedSegments: Segment[] = [];
        
        for (let i = 0; i < originSegments.length; i += batchSize) {
          const batch = originSegments.slice(i, i + batchSize);
          
          const result = await translateMultiSourceBatch({
            origin_segment_batch: batch,
            non_origin_texts: nonOriginTexts,
            translated_source_id: translatedSourceId,
            prompt_text: promptText,
            source_language: sourceLang,
            target_language: targetLang
          });
          
          allTranslatedSegments.push(...result.translated_segments);
          // Update non-origin texts for next batch
          nonOriginTexts = result.updated_non_origin_texts;
        }
        
        return {
          translatedSegments: allTranslatedSegments,
          translatedSourceId
        };
      }
    } finally {
      setLoadingCount(prev => prev - 1);
    }
  }, [setLoadingCount]);

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
		translateMultiSource,
  };
}

