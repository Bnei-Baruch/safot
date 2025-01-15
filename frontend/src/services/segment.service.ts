import { httpService } from './http.service';

const ENTITY_TYPE = 'segments';

export const segmentService = {
    addSegmentsFromFile,
};

async function addSegmentsFromFile(file: File, sourceId: string): Promise<{ segments: any[] }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceId', sourceId);

    return await httpService.post(`${ENTITY_TYPE}`, formData);
}
