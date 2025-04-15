import { httpService } from './http.service';
import { Segment, SaveSegmentsPayload } from '../types';

const SEGMENTS = 'segments';

export const segmentService = {
    fetchSegments,
    extractParagraphs,
    translateSegments,
    exportTranslationDocx,
    saveSegments
};


async function saveSegments(payload: SaveSegmentsPayload): Promise<{ source_id: number; segments: Segment[] }> {
    const savedSegments = await httpService.post<Segment[]>(`${SEGMENTS}`, payload);
    return {
        source_id: payload.source_id,
        segments: savedSegments,
    };
}

async function extractParagraphs(file: File,): Promise<{paragraphs: string[], properties: object}> {
    const formData = new FormData();
    formData.append("file", file);

    return  await httpService.post("/docx2text", formData);
}

async function fetchSegments(source_id: number): Promise<Segment[]> {
    // console.log("🛠️From segment.service :  Fetching segments for:", source_id);
    const response = await httpService.get<Segment[]>(`${SEGMENTS}/${source_id}`);
    return response; // Directly return the segments array
}

async function translateSegments(
    source_id: number, 
    original_segments: Segment[], 
    target_language: string, 
    source_language: string
): Promise<{ translated_segments: Segment[], total_segments_translated: number }> {
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