import { httpService } from './http.service';
import { Segment, BuildSegmentParams } from '../types/frontend-types';
import { AdditionalSourceInfo } from '../useFlow';

const SEGMENTS = 'segments';

export function buildSegment(params: BuildSegmentParams): Segment {
  return {
    text: params.text,
    source_id: params.source_id,
    order: params.order,
    properties: params.properties,
    id: params.id,
    original_segment_id: params.original_segment_id,
    original_segment_timestamp: params.original_segment_timestamp
  };
}

export async function getSegments(source_id: number): Promise<Segment[]> {
  return await httpService.get<Segment[]>(`${SEGMENTS}/${source_id}`);
}

export async function postSegments(
  data: 
    | {
        paragraphs: string[];
        source_id: number;
        properties: Record<string, any>;
        originalSegments?: Segment[];
        additional_sources_segments?: Record<string, string[]>;
      }
    | { segments: Segment[] }
): Promise<Segment[]> {
  return await httpService.post<Segment[]>(`${SEGMENTS}`, data);
}

export async function extractParagraphs(file: File,): Promise<{paragraphs: string[], properties: object}> {
  const formData = new FormData();
  formData.append("file", file);
  return await httpService.post("/docx2text", formData);
}

export interface ExtractTextResult {
  text: string;
  properties: object;
  language?: string;
  id?: number;
}

export async function extractText(additionalSources: AdditionalSourceInfo[]): Promise<ExtractTextResult[]> {
  const formData = new FormData();
  
  additionalSources.forEach(source => {
    formData.append("files", source.file);
  });
  
  // Send metadata (name, language, id) without the File object
  const additionalSourcesMetadata = additionalSources.map(source => ({
    name: source.name,
    id: source.id,
  }));
  
  formData.append("additional_sources", JSON.stringify(additionalSourcesMetadata));
  const results = await httpService.post<ExtractTextResult[]>("/extractText", formData);
  
  // Remove newlines from text
  return results.map(result => ({
    ...result,
    text: result.text.replace(/\n/g, '')
  }));
}

export async function exportTranslationDocx(source_id: number): Promise<Blob> {
    return await httpService.downloadFile(`/export/${source_id}`);
}
