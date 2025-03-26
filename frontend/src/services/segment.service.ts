import { httpService } from './http.service';
import { Segment } from '../SegmentSlice';

const SEGMENTS = 'segments';

export const segmentService = {
    addSegmentsFromFile,
    fetchSegments,
    addSegment,
    translateSegments,
    exportTranslationDocx,
};

async function addSegmentsFromFile(file: File, source_id: number, properties: object = {}): Promise<{ source_id: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_id', source_id.toString());
    formData.append('properties', JSON.stringify(properties));

    return await httpService.post(`${SEGMENTS}/save`, formData);
}

async function fetchSegments(source_id: number): Promise<Segment[]> {
    // console.log("🛠️From segment.service :  Fetching segments for:", source_id);
    const response = await httpService.get<Segment[]>(`${SEGMENTS}/${source_id}`);
    return response; // Directly return the segments array
}

async function addSegment(segmentData: Omit<Segment, 'timestamp'>): Promise<Segment> {
    return await httpService.post<Segment>(`${SEGMENTS}/save`, segmentData);
}

async function translateSegments(source_id: number, original_segments: Segment[], target_language: string, source_language: string): Promise<{ translated_segments: Segment[], total_segments_translated: number }> {
    return await httpService.post<{ translated_segments: Segment[], total_segments_translated: number }>(`${SEGMENTS}/translate`, {
        source_id,
        segments: original_segments,
        target_language,
        source_language
    });
}


async function exportTranslationDocx(source_id: number): Promise<Blob> {
    return await httpService.downloadFile(`/export/${source_id}`);
}