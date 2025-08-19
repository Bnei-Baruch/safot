import { httpService } from './http.service';
import { Rule, Example } from '../types/frontend-types';
import { PROMPT_TEMPLATES } from "../constants/promptTemplates";

const ENTITY_TYPE = 'rules';

export const ruleService = {
   // write rules
   createPromptRule,
   createExampleRules,
   createRules,
 
   // read rules
   getRulesByDictionaryAll,
   getRulesByDictionary,
 
   // prompt building helpers
   selectRulesForPrompt,
   buildPromptString,
};

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

async function createRules(rules: Partial<Rule>[]) {
  return await httpService.post(`${ENTITY_TYPE}`, { rules });
}

/** Fetch ALL rules for a dictionary (all versions). Requires backend route /rules/by-dictionary/all?dictionary_id= */
export async function getRulesByDictionaryAll(
  dictionaryId: number
): Promise<Rule[]> {
  try {
    return await httpService.get<Rule[]>(
      `/${ENTITY_TYPE}/by-dictionary-all`,
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

export function buildPromptString(params: {
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
}

