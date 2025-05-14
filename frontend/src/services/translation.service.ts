import { httpService } from './http.service';
import { Segment } from '../types/frontend-types';

const TRANSLATE = 'translate';


export async function translateParagraphs(
    paragraphs: string[],
    source_language: string,
    target_language: string,
    examples?: { firstTranslation: string; lastTranslation: string }[]
  ): Promise<{
    translated_paragraphs: string[];
    properties: any;
    total_segments_translated: number;
  }> {
    return await httpService.post(`${TRANSLATE}`, {
      paragraphs,
      source_language,
      target_language,
      examples
    });
  }