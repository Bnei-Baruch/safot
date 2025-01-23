import { httpService } from './http.service';

const ENTITY_TYPE = 'segments';

export const segmentService = {
    addSegmentsFromFile,
};

async function addSegmentsFromFile(file: File, source_id: string): Promise<{ source_id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_id', source_id);

    return await httpService.post(`${ENTITY_TYPE}`, formData);
}
