import { httpService } from './http.service';
import { Dictionary, Rule, Example } from '../types/frontend-types';
 
const PROMPT = 'prompt';
const DICTIONARIES = 'dictionaries';
const RULES = 'rules';

// If dictionary_id is set, timestamp is optional.
// If custom_key is set, you must also set original and translated languages.
export type GetPromptRequest = {
	dictionary_id?: number,
	dictionary_timestamp?: number,

	prompt_key?: string,
	original_language?: string,
	translated_language?: string,
};

export async function getPrompt(request: GetPromptRequest): Promise<string> {
  return await httpService.post(`${PROMPT}`, request);
}

export async function getRules(dictionary_id: number, dictionary_timestamp?: number): Promise<Rule[]> {
  return await httpService.get<Rule[]>(RULES, { dictionary_id, dictionary_timestamp });
}

export async function postRule(rule: Rule): Promise<Rule> {
  return await httpService.post(RULES, rule);
}

export async function getDictionaries(params = {}): Promise<Dictionary[]> {
  return await httpService.get<Dictionary[]>(DICTIONARIES, params);
}

export async function getDictionaryBySource(source_id: number): Promise<Dictionary> {
  return await httpService.get<Dictionary>(DICTIONARIES, { source_id });
}

export type PostDictionaryRequest = {
	name?: string,

	prompt_key?: string,
	original_language?: string,
	translated_language?: string,
}

export async function postPromptDictionary(request: PostDictionaryRequest): Promise<Dictionary> {
  return await httpService.post(`${DICTIONARIES}/prompt`, request);
}

export async function postDictionary(dictionary: Dictionary): Promise<Dictionary> {
  return await httpService.post(DICTIONARIES, dictionary);
}

