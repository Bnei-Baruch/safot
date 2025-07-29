import { httpService } from './http.service';
import { Rule } from '../types/frontend-types';

const ENTITY_TYPE = 'rules';

export const ruleService = {
    createRules,
    createInitialPromptRule,
    buildInitialPromptRule,
};

async function createRules(rules: Rule[]): Promise<Rule[]> {
    return await httpService.post<Rule[]>(`${ENTITY_TYPE}`, { rules });
}

function buildInitialPromptRule(dictionaryId: number, dictionaryTimestamp: string): Rule {
    return {
        name: "initial_prompt_rule",
        type: "prompt_key",
        dictionary_id: dictionaryId,
        dictionary_timestamp: dictionaryTimestamp,
        properties: { prompt_key: "prompt_1" }
    };
}

async function createInitialPromptRule(dictionaryId: number, dictionaryTimestamp: string): Promise<Rule> {
    const initialRule = buildInitialPromptRule(dictionaryId, dictionaryTimestamp);
    const rules = await createRules([initialRule]);
    return rules[0];
} 