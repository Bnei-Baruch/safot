import { useCallback, useState } from 'react';

import { translateParagraphs } from './services/translation.service';
import { getPrompt, postPromptDictionary } from './services/dictionary.service';
import { extractParagraphs, postSegments, postSegmentOriginLinks } from './services/segment.service';
import { getSources, postSources, postSourceOriginLinks, getSourceRelations } from './services/source.service';
import { Segment, Source } from './types/frontend-types';

// import compareTwoStrings from 'string-similarity-js';

const buildSegments = (
  paragraphs: string[],
  source_id: number,
  properties: Record<string, any>,
  initialOrder: number = 1,  // Order is 1 based.
): Segment[] =>
  paragraphs.map((text, index) => {
    return {
      text,
      source_id,
      // Order is 1 based as it is user facing feature.
      order: initialOrder + index,
      properties,
    };
  });

const initSourceFromFile = async (
  originalLanguage: string,
  originalFile: File,
  additionalSourcesLanguages: string[],
  additionalSourcesFiles: File[],
  translatedLanguage: string,
  dictionaryId: undefined|number,
  dictionaryTimestamp: undefined|string,
) : Promise<{originalSegments: Segment[], additionalSourcesSegments: Segment[], translatedSourceId: number}> => {
  // Create original and translation sources
  const {
    originalSourceId,
    additionalSourcesIds,
    translatedSourceId,
  } = await createSources(
    originalFile.name,
    originalLanguage,
    additionalSourcesFiles.map(f => f.name),
    additionalSourcesLanguages,
    translatedLanguage,
    dictionaryId,
    dictionaryTimestamp,
  );

  // Extract paragraphs from all uploaded files
  const allFiles = [originalFile, ...additionalSourcesFiles];
  const allParagraphs = await extractParagraphs(allFiles);

  // Save original segments to database
  const segments = await buildSegments(allParagraphs[0], originalSourceId, { segment_type: "file" });

  // Additional sources should be saved as one segment with whole text.
  // We will extract each time the next paragraph matching the original 
  // source segments.
  for (let i = 0; i < additionalSourcesIds.length; i++) {
    const restOfText = allParagraphs[i+1].join('\n\n');
    segments.push(...buildSegments([restOfText], additionalSourcesIds[i], { segment_type: "rest_of_text" }));
  }
  const savedSegments = await postSegments(segments);

  return {
    originalSegments: savedSegments.slice(0, allParagraphs[0].length),
    additionalSourcesSegments: savedSegments.slice(allParagraphs[0].length),
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

const createSources = async (
  name: string,
  originalLanguage: string,
  additionalSourcesNames: string[],
  additionalSourcesLanguages: string[],
  translatedLanguage: string,
  dictionaryId: undefined|number,
  dictionaryTimestamp: undefined|string
) : Promise<{originalSourceId: number, additionalSourcesIds: number[], translatedSourceId: number}> => {
  const baseName = normalizeName(name);

  const [originalSource, translatedSource, ...additionalSources] = await postSources([
    {
      name: baseName,
      language: originalLanguage,
      properties: {
        is_original: true,
      }
    },
    {
      name: `${baseName}-${translatedLanguage}`,
      language: translatedLanguage,
      dictionary_id: dictionaryId || undefined,
      dictionary_timestamp: dictionaryTimestamp || undefined,
    },
    ...additionalSourcesLanguages.map(additionalLanguage => ({
      name: `${baseName}-${additionalLanguage}`,
      language: additionalLanguage,
      properties: {
        is_original: false,
      }
    })),
  ]);

  // Create the origin-translation relation
  const additionalSourcesIds = additionalSources.map(source => source.id);
  await postSourceOriginLinks([
    {
      origin_source_id: originalSource.id,
      translated_source_id: translatedSource.id,
    },
    ...additionalSourcesIds.map(additionalSourcesId => ({
      origin_source_id: additionalSourcesId,
      translated_source_id: translatedSource.id,
    }))
  ]);

  return {
    originalSourceId: originalSource.id,
    translatedSourceId: translatedSource.id,
    additionalSourcesIds,
  };
};

export function useFlow() {
  const [loadingCount, setLoadingCount] = useState<number>(0);

  const translateSegments = useCallback(async (
    originalLanguage: string,
    originalSegments: Segment[],
    additionalSourcesLanguages: string[],
    additionalSourcesSegments: Segment[],
    translatedLanguage: string,
    translatedSourceId: number
  ): Promise<number> => {
    setLoadingCount(prev => prev + 1);
    try {
      const [translatedSource] = await getSources([translatedSourceId]);

      // Fetch task prompt from server (from dictionary or default)
      let taskPrompt = "";
      if (translatedSource.dictionary_id) {
        taskPrompt = await getPrompt({
          dictionary_id: translatedSource.dictionary_id,
          dictionary_timestamp: translatedSource.dictionary_timestamp_epoch,
        });
      } else {
        taskPrompt = await getPrompt({
          original_language: originalLanguage,
          additional_sources_languages: additionalSourcesLanguages,
          translated_language: translatedLanguage,
        });
      }
      console.log('Using task prompt: ', taskPrompt);

      const {
        translated_paragraphs,
        additional_sources_paragraphs: additionalSourcesParagraphs = [],
        remaining_additional_sources_texts: remainingAdditionalSourcesTexts = [],
        properties: translationProperties
      } = await translateParagraphs(
        originalLanguage,
        originalSegments.map((segment) => segment.text),
        additionalSourcesLanguages,
        additionalSourcesSegments.map(s => s.text),
        translatedLanguage,
        taskPrompt,
      );

      const properties: Record<string, any> = {
        translation: translationProperties,
      };

      if (translatedSource.dictionary_id) {
        properties["dictionary_id"] = translatedSource.dictionary_id;
        properties["dictionary_timestamp"] = translatedSource.dictionary_timestamp_epoch;
      }

      if (translated_paragraphs.length !== originalSegments.length) {
        throw new Error(`Failed translating, expected ${originalSegments.length} translated paragraphs but got ${translated_paragraphs.length}`);
      }

      if (additionalSourcesParagraphs.length !== additionalSourcesLanguages.length ||
          remainingAdditionalSourcesTexts.length !== additionalSourcesLanguages.length) {
        throw new Error(`Expected returned additional sources to be of size ${additionalSourcesLanguages}, got: ${additionalSourcesParagraphs.length} and ${remainingAdditionalSourcesTexts.length}.`);
      }

      // Validate that each additional source has matching number of segments
      for (let i = 0; i < additionalSourcesParagraphs.length; i++) {
        if (additionalSourcesParagraphs[i].length !== originalSegments.length) {
          throw new Error(`Additional source ${i} has ${additionalSourcesParagraphs[i].length} segments but expected ${originalSegments.length}`);
        }
      }

      // Save translated segments to database
      const firstOrder = originalSegments[0].order;
      const nextOrder = originalSegments[originalSegments.length - 1].order + 1;
      const segments: Segment[] = [
        // New translated segments.
        ...buildSegments(translated_paragraphs, translatedSourceId, properties, firstOrder),
        // For each additional source new segments extracted for remining texts.
        ...additionalSourcesParagraphs.reduce((arr: Segment[], paragraphs, i) => {
          arr.push(...buildSegments(paragraphs, additionalSourcesSegments[i].source_id, properties, firstOrder));
          return arr;
        }, [] as Segment[]),
        // Update remaining segments.
        ...remainingAdditionalSourcesTexts.map((restOfText, i) => buildSegments([restOfText], additionalSourcesSegments[i].source_id, additionalSourcesSegments[i].properties || {}, nextOrder)[0]),
      ];
      const savedSegments = await postSegments(segments);

      // Create segment origin links
      const translatedSegmentsCount = translated_paragraphs.length;
      const translatedSegments = savedSegments.slice(0, translatedSegmentsCount);

      // Calculate where each additional source's segments start in savedSegments
      let additionalSourcesOffset = translatedSegmentsCount;
      const additionalSourcesSegmentsBySource: Segment[][] = [];
      for (let i = 0; i < additionalSourcesParagraphs.length; i++) {
        const count = additionalSourcesParagraphs[i].length;
        const additionalSourceSegments = savedSegments.slice(additionalSourcesOffset, additionalSourcesOffset + count);
        additionalSourcesSegmentsBySource.push(additionalSourceSegments);
        additionalSourcesOffset += count;
      }

      // Link each translated segment to its original segment and additional source segments
      const relations = [];
      for (let i = 0; i < translatedSegments.length; i++) {
        const translatedSegment = translatedSegments[i];
        const originalSegment = originalSegments[i];

        // Link translated segment to original segment
        if (originalSegment.id && originalSegment.timestamp && translatedSegment.id && translatedSegment.timestamp) {
          relations.push({
            origin_segment_id: originalSegment.id,
            origin_segment_timestamp: originalSegment.timestamp,
            translated_segment_id: translatedSegment.id,
            translated_segment_timestamp: translatedSegment.timestamp,
          });
        }

        // Link translated segment to corresponding segments from each additional source
        for (let j = 0; j < additionalSourcesSegmentsBySource.length; j++) {
          const additionalSourceSegments = additionalSourcesSegmentsBySource[j];
          const additionalSegment = additionalSourceSegments[i];
          if (additionalSegment.id && additionalSegment.timestamp && translatedSegment.id && translatedSegment.timestamp) {
            relations.push({
              origin_segment_id: additionalSegment.id,
              origin_segment_timestamp: additionalSegment.timestamp,
              translated_segment_id: translatedSegment.id,
              translated_segment_timestamp: translatedSegment.timestamp,
            });
          }
        }
      }

      if (relations.length > 0) {
        await postSegmentOriginLinks(relations);
      }

      return translatedSourceId;
    } finally {
      setLoadingCount(prev => prev - 1);
    }
  }, [setLoadingCount]);

  const translateFile = useCallback(async (
    originalLanguage: string,
    originalFile: File,
    additionalSourcesLanguages: string[],
    additionalSourcesFiles: File[],
    translatedLanguage: string,
    translateAll: boolean,
    dictionaryId: undefined|number,
    dictionaryTimestamp: undefined|string,
  ) : Promise<number> => {
    console.log(dictionaryId, dictionaryTimestamp)
    setLoadingCount(prev => prev + 1);
    try {
      const {
        originalSegments,
        additionalSourcesSegments,
        translatedSourceId,
      } = await initSourceFromFile(
        originalLanguage,
        originalFile,
        additionalSourcesLanguages,
        additionalSourcesFiles,
        translatedLanguage,
        dictionaryId,
        dictionaryTimestamp,
      );

      // Step-by-step translation (first 10 paragraphs only)
      const originalSegmentsChunk = translateAll ? originalSegments : originalSegments.slice(0, 10);

      return await translateSegments(
        originalLanguage,
        originalSegmentsChunk,
        additionalSourcesLanguages,
        additionalSourcesSegments,
        translatedLanguage,
        translatedSourceId,
      );
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
      let additionalSourcesLanguages: string[] = [];
      const translatedLanguage = (source && source.language) || undefined;
      if (source && source.id) {
        // Get relations to find all origin sources
        const relations = await getSourceRelations([source.id]);
        const originRelations = relations.filter(r => r.translated_source_id === source.id);
        if (originRelations.length > 0) {
          const originSourceIds = originRelations.map(r => r.origin_source_id);
          const originSources = await getSources(originSourceIds);

          // Find original source (with is_original property)
          const originalSource = originSources.find(s => s.properties?.is_original === true);
          if (originalSource) {
            originalLanguage = originalSource.language;
            name = source && source.name ? `Dictionary for "${source.name}"` : "New dictionary";
          }

          // Get additional sources languages
          const additionalSources = originSources.filter(s => s.properties?.is_original !== true);
          additionalSourcesLanguages = additionalSources.map(s => s.language);
        }
      }
      const dictionary = await postPromptDictionary({
        name,
        original_language: originalLanguage,
        additional_sources_languages: additionalSourcesLanguages,
        translated_language: translatedLanguage,
       });
      // Update source with dictionary
      if (source) {
        const sourceToUpdate = {
          ...source,
          dictionary_id: dictionary.id,
          dictionary_timestamp: dictionary.timestamp,
        }
        const [updatedSource] = await postSources([sourceToUpdate]);
        return updatedSource;
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

