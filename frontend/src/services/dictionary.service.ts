import { httpService } from './http.service';
import { Dictionary } from '../types/frontend-types';
 
const DICTIONARIES = 'dictionary';

export async function getDictionaries(): Promise<Dictionary[]> {
  return await httpService.get<Dictionary[]>(DICTIONARIES);
}

/*async function createNewDictionaryVersion(sourceId: number): Promise<{ dictionary_id: number; dictionary_timestamp: string }> {
  return await httpService.post(`${ENTITY_TYPE}/version/${sourceId}`, null);
}*/

export async function createNewDictionary(sourceId: number, customName?: string): Promise<{ dictionary_id: number; dictionary_timestamp: string }> {
  const dictionaryName = customName || `source_${sourceId}_dictionary`;
  return await httpService.post(`${DICTIONARIES}/new/${sourceId}`, {
    name: dictionaryName,
  });
}

