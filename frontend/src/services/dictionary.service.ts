import { httpService } from './http.service';

const ENTITY_TYPE = 'dictionary';

export const dictionaryService = {
    setupDictionaryForSource,
    createNewDictionaryVersion,
};

// Both functions call the same endpoint - backend decides whether to create new dictionary or new version
// Different names are kept for semantic clarity 
async function setupDictionaryForSource(sourceId: number): Promise<{ dictionary_id: number; dictionary_timestamp: string }> {
    return await httpService.post(`${ENTITY_TYPE}/${sourceId}`, null);
}

async function createNewDictionaryVersion(sourceId: number): Promise<{ dictionary_id: number; dictionary_timestamp: string }> {
    return await httpService.post(`${ENTITY_TYPE}/${sourceId}`, null);
}