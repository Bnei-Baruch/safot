import { httpService } from './http.service';
import { Segment } from '../types/frontend-types';

const SEGMENTS = 'segments';

export interface SegmentRelation {
  origin_segment_id: number;
  origin_segment_timestamp: string;
  translated_segment_id: number;
  translated_segment_timestamp: string;
}

export async function getSegments(sourceIds?: number[]): Promise<Segment[]> {
  return await httpService.post<Segment[]>(SEGMENTS, { source_ids: sourceIds || [] });
}

export async function postSegments(segments: Segment[]): Promise<Segment[]> {
  return await httpService.post<Segment[]>(`${SEGMENTS}`, { segments });
}

export async function postSegmentOriginLinks(relations: SegmentRelation[]): Promise<SegmentRelation[]> {
  return await httpService.post(`${SEGMENTS}/origins`, { relations });
}

export async function extractParagraphs(files: File[]): Promise<string[][]> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append("files", file);
  });
  return await httpService.post<string[][]>("/docx2text", formData);
}

export async function exportTranslationDocx(source_id: number): Promise<Blob> {
    return await httpService.downloadFile(`/export/${source_id}`);
}
