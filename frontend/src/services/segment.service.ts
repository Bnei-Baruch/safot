import { httpService } from './http.service';
import { Segment, BuildSegmentParams } from '../types/frontend-types';

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

export async function postSegments(segments: Segment[]): Promise<Segment[]> {
  return await httpService.post<Segment[]>(`${SEGMENTS}`, { segments });
}

export async function extractParagraphs(file: File,): Promise<{paragraphs: string[], properties: object}> {
  const formData = new FormData();
  formData.append("file", file);
  return await httpService.post("/docx2text", formData);
}

export async function exportTranslationDocx(source_id: number): Promise<Blob> {
    return await httpService.downloadFile(`/export/${source_id}`);
}
