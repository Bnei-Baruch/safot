import { httpService } from './http.service';
import { Dictionary, Rule, Example } from '../types/frontend-types';
 
const PROMPT = 'prompt';
const DICTIONARIES = 'dictionaries';
const RULES = 'rules';

// Later also should support dictionary_id and dictionary_timestamp_id.
export async function getPrompt(
  promptKey: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  return await httpService.post(`${PROMPT}`, {
    custom_key: promptKey,
    source_language: sourceLang,
    target_language: targetLang,
  });
}


export async function getDictionaries(): Promise<Dictionary[]> {
  return await httpService.get<Dictionary[]>(DICTIONARIES);
}

/*async function createNewDictionaryVersion(sourceId: number): Promise<{ dictionary_id: number; dictionary_timestamp: string }> {
  return await httpService.post(`${DICTIONARIES}/version/${sourceId}`, null);
}*/

export async function createNewDictionary(sourceId: number, customName?: string): Promise<{ dictionary_id: number; dictionary_timestamp: string }> {
  const dictionaryName = customName || `source_${sourceId}_dictionary`;
  return await httpService.post(`${DICTIONARIES}/new/${sourceId}`, {
    name: dictionaryName,
  });
}


/** Persist a single prompt rule with the final prompt text */
export async function createPromptRule(
  dictionaryId: number,
  dictionaryTimestamp: string,
  promptKey: string,
  promptText: string,
  ruleName: string,
  usedRuleIds: number[] = []
) {
  const promptRule = {
    name: ruleName,
    type: "prompt",
    dictionary_id: dictionaryId,
    dictionary_timestamp: dictionaryTimestamp,
    properties: {
      prompt_key: promptKey,
      prompt_text: promptText,
      used_rule_ids: usedRuleIds,
    },
  };
  return await createRules([promptRule]);
}

/** Persist multiple example rules. If score exists it will be saved as example_score */
export async function createExampleRules(
  dictionaryId: number,
  dictionaryTimestamp: string,
  examples: Example[]
) {
  const rules = examples.map((example, i) => ({
    name: `example_rule_${i}`,
    type: "example",
    dictionary_id: dictionaryId,
    dictionary_timestamp: dictionaryTimestamp,
    properties: {
      source_text: example.sourceText,
      provider_translation: example.firstTranslation,
      user_translation: example.lastTranslation,
      score: example.score,
    },
  }));
  return await createRules(rules);
}

export async function createRules(rules: Partial<Rule>[]) {
  return await httpService.post(`${RULES}`, { rules });
}

/** Fetch ALL rules for a dictionary (all versions). Requires backend route /rules/by-dictionary/all?dictionary_id= */
export async function getRulesByDictionaryAll(
  dictionaryId: number
): Promise<Rule[]> {
  try {
    return await httpService.get<Rule[]>(
      `/${RULES}/by-dictionary-all`,
      { dictionary_id: dictionaryId }
    );
  } catch {
    return [];
  }
}

export async function getRulesByDictionary(
  dictionaryId: number,
  dictionaryTimestamp: string
): Promise<Rule[]> {
  return await httpService.get<Rule[]>("/rules/by-dictionary", {
    dictionary_id: dictionaryId,
    dictionary_timestamp: dictionaryTimestamp,
  });
}

// rule.service.ts
export async function selectRulesForPrompt(
  dictionaryId: number,
  maxExamples: number = 20
): Promise<{
  promptKey: string;
  selectedExamples: Example[]; 
  usedRuleIds: number[];
}> {
  
  const rules = await getRulesByDictionaryAll(dictionaryId);
  const exampleRules = rules.filter(r => r.type === "example");

  const sortedByScore = exampleRules.sort((a, b) => {
    const sa = Number(a?.properties?.score ?? 0);
    const sb = Number(b?.properties?.score ?? 0);
    return sb - sa;
  });

  
  const topExamples = sortedByScore.slice(0, maxExamples);

  const selectedExamples: Example[] = topExamples.map(r => ({
    sourceText: r.properties?.source_text ?? "",
    firstTranslation: r.properties?.provider_translation ?? "",
    lastTranslation: r.properties?.user_translation ?? "",
    score: r.properties?.score, // אם הוגדר
  }));

  const usedRuleIds = topExamples
    .map(r => r.id)
    .filter((id): id is number => typeof id === "number");

  const promptKey = selectedExamples.length > 0 ? "prompt_2" : "prompt_1";

  return { promptKey, selectedExamples, usedRuleIds };
}

/*export function buildPromptString(params: {
  promptKey: string;
  sourceLanguage: string;
  targetLanguage: string;
  examples?: Example[];
}): { promptText: string } {
  const { promptKey, sourceLanguage, targetLanguage, examples = [] } = params;

  const template = PROMPT_TEMPLATES[promptKey];


  let promptText = template
    .replace("{source_language}", sourceLanguage)
    .replace("{target_language}", targetLanguage);

  
  if (template.includes("{examples}")) {
    const formatted = examples
      .map(ex => `Source: ${ex.sourceText}\nFirst Translation: ${ex.firstTranslation}\nFinal Translation: ${ex.lastTranslation}`)
      .join("\n\n");
    promptText = promptText.replace("{examples}", formatted);
  }

  return { promptText };
}*/

