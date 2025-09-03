import { httpService } from './http.service';

const TRANSLATE = 'translate';

export async function translateParagraphs(
  paragraphs: string[],
  prompt_text: string,
): Promise<{
  translated_paragraphs: string[];
  properties: any;
  total_segments_translated: number;
  translation_time_seconds: number;
}> {
  console.log("Sending translation request with:", {
    paragraphs,
    prompt_text,
  });
  return await httpService.post(`${TRANSLATE}`, {
    paragraphs,
    prompt_text,
  });
}
