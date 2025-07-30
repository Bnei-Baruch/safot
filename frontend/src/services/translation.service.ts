import { httpService } from './http.service';
import { Example } from '../types/frontend-types';

const TRANSLATE = 'translate';


export async function translateParagraphs(
  paragraphs: string[],
  source_language: string,
  target_language: string,
  dictionary_id?: number,
  dictionary_timestamp?: string,
  examples?: Example[]
): Promise<{
  translated_paragraphs: string[];
  properties: any;
  total_segments_translated: number;
}> {
  return await httpService.post(`${TRANSLATE}`, {
    paragraphs,
    source_language,
    target_language,
    dictionary_id,
    dictionary_timestamp,
    examples 
  });
}