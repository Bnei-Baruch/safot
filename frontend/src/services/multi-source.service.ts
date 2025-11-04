import { httpService } from './http.service';
import { Segment } from '../types/frontend-types';

export interface MultiSourceInitializeRequest {
  origin_source_id: number;
  non_origin_source_ids: number[];
  translated_source_id: number;
}

export interface MultiSourceTranslateBatchRequest {
  origin_segment_batch: Segment[];
  non_origin_texts: Record<number, string>;
  translated_source_id: number;
  prompt_text: string;
  source_language: string;
  target_language: string;
}

export interface MultiSourceTranslateBatchResponse {
  status: string;
  translated_segments: Segment[];
  updated_non_origin_texts: Record<number, string>;
}

export async function initializeMultiSource(
  request: MultiSourceInitializeRequest
): Promise<any> {
  return httpService.post('/multi-source/initialize', request);
}

export async function translateMultiSourceBatch(
  request: MultiSourceTranslateBatchRequest
): Promise<MultiSourceTranslateBatchResponse> {
  return httpService.post('/multi-source/translate-batch', request);
}

export interface MultiSourceInfo {
  is_multi_source: boolean;
  sources: Array<{
    id: number;
    name: string;
    language: string;
    is_origin: boolean;
  }>;
}

export async function getMultiSourceInfo(
  translatedSourceId: number
): Promise<MultiSourceInfo> {
  return httpService.get(`/multi-source/info/${translatedSourceId}`);
}

