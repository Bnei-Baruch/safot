import { httpService } from './http.service';
import { Segment } from '../SegmentSlice';

const SEGMENTS = 'segments';

export const segmentService = {
    addSegmentsFromFile,
    fetchSegments,
};

async function addSegmentsFromFile(file: File, source_id: number): Promise<{ source_id: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_id', source_id.toString());

    return await httpService.post(`${SEGMENTS}`, formData);
}

async function fetchSegments(source_id: number): Promise<Segment[]> {
    const response = await httpService.get<Segment[]>(`/segments/${source_id}`);
    return response; // Directly return the segments array
}
