import { httpService } from './http.service';
 
const ENTITY_TYPE = 'dictionary';

export const dictionaryService = {
    createNewDictionaryVersion,
    createNewDictionary,
};

async function createNewDictionaryVersion(sourceId: number): Promise<{ dictionary_id: number; dictionary_timestamp: string }> {
    return await httpService.post(`${ENTITY_TYPE}/${sourceId}`, null);
}

async function createNewDictionary(sourceId: number, customName?: string): Promise<{ dictionary_id: number; dictionary_timestamp: string }> {
    const dictionaryName = customName || `source_${sourceId}_dictionary`;
    return await httpService.post(`${ENTITY_TYPE}/new/${sourceId}`, { 
        name: dictionaryName 
    });
}