import { httpService } from './http.service';

const TRANSLATE = 'translate';
const ESTIMATE_COST = 'estimate-cost';

export async function translateParagraphs(
  original_language: string,
  paragraphs: string[],
  additional_sources_languages: string[],
  additional_sources_texts: string[],
  translate_language: string,
  task_prompt?: string,
  provider?: string,
  model?: string,
): Promise<{
  translated_paragraphs: string[];
  additional_sources_paragraphs?: string[][];
  remaining_additional_sources_texts?: string[],
  properties: any;
  total_segments_translated: number;
  translation_time_seconds: number;
}> {
  console.log("Sending translation request with:", {
    original_language,
    paragraphs,
    additional_sources_languages,
    additional_sources_texts,
    translate_language,
    task_prompt,
    provider,
    model,
  });
  return await httpService.post(`${TRANSLATE}`, {
    original_language,
    paragraphs,
    additional_sources_languages,
    additional_sources_texts,
    translate_language,
    task_prompt,
    provider,
    model,
  });
}

export interface CostEstimate {
  input_tokens: number;
  output_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  currency: string;
  provider: string;
  model: string;
}

export async function estimateCost(
  original_language: string,
  paragraphs: string[],
  additional_sources_languages: string[],
  additional_sources_texts: string[],
  translate_language: string,
  provider: string,
  model: string,
  dictionary_id?: number,
  dictionary_timestamp?: number,
): Promise<CostEstimate> {
  return await httpService.post(`${ESTIMATE_COST}`, {
    original_language,
    paragraphs,
    additional_sources_languages,
    additional_sources_texts,
    translate_language,
    provider,
    model,
    dictionary_id,
    dictionary_timestamp,
  });
}
