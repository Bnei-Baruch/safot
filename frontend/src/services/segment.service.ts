import { httpService } from './http.service';

const SEGMENTS = 'segments';

export const segmentService = {
    addSegmentsFromFile,
    fetchSegments,
};

async function addSegmentsFromFile(file: File, source_id: string): Promise<{ source_id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_id', source_id);

    return await httpService.post(`${SEGMENTS}`, formData);
}

async function fetchSegments(source_id: number): Promise<{ segments: any[] }> {
    return await httpService.get(`${SEGMENTS}/${source_id}`);
}
