import { httpService } from './http.service';

const TRANSLATE = 'translate';

export async function translateParagraphs(
  paragraphs: string[],
  prompt_text: string,
  additionalSourcesText?: { text: string; language: string; source_id: number }[],
): Promise<{
  translated_paragraphs: string[];
  additional_sources_segments: Record<string, string[]>; // Key format: "sourceId_language"
  properties: any;
  total_segments_translated: number;
  translation_time_seconds: number;
}> {
  console.log("Sending translation request with:", {
    paragraphs,
    prompt_text,
    additionalSourcesText,
  });
  return await httpService.post(`${TRANSLATE}`, {
    paragraphs,
    prompt_text,
    additionalSourcesText,
  });
}
