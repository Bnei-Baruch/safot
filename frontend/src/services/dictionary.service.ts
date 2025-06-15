import { httpService } from './http.service';

const ENTITY_TYPE = 'dictionary';

export const dictionaryService = {
    setupDictionaryForSource,
};

async function setupDictionaryForSource(sourceId: number): Promise<{ dictionary_id: number; dictionary_timestamp: string }> {
    return await httpService.post(`${ENTITY_TYPE}/${sourceId}`, null);
}