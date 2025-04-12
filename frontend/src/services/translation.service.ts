import { httpService } from './http.service';
import { Segment } from '../types';

const TRANSLATE = 'translate';


export async function translateSegments(
    source_id: number, 
    original_segments: Segment[], 
    target_language: string, 
    source_language: string
): Promise<{ translated_segments: Segment[], total_segments_translated: number }> {
    return await httpService.post<{ translated_segments: Segment[], total_segments_translated: number }>(`${TRANSLATE}`, {
        source_id,
        segments: original_segments,
        target_language,
        source_language
    });
}