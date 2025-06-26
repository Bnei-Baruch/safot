import { httpService } from './http.service';
import { Rule } from '../types/frontend-types';

const RULES = 'rules';

export const ruleService = {
    saveRules,
};

async function saveRules(rules: Rule[]): Promise<Rule[]> {
    return await httpService.post<Rule[]>(`${RULES}`, { rules });
} 