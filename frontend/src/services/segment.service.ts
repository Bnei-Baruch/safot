import { httpService } from './http.service';
import { Segment, BuildSegmentParams } from '../types';

const SEGMENTS = 'segments';

export const segmentService = {
    fetchSegments,
    extractParagraphs,
    exportTranslationDocx,
    saveSegments,
    buildSegment
};

function buildSegment(params: BuildSegmentParams): Segment {
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

async function saveSegments(segments: Segment[]): Promise<{ source_id: number; segments: Segment[] }> {
    const savedSegments = await httpService.post<Segment[]>(`${SEGMENTS}`, { segments });
    return {
        source_id: savedSegments[0]?.source_id || 0,
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

async function exportTranslationDocx(source_id: number): Promise<Blob> {
    return await httpService.downloadFile(`/export/${source_id}`);
}