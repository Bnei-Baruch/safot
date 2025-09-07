import { httpService } from './http.service'
import { Source } from '../types/frontend-types';

const SOURCES = 'sources';

export async function getSources(): Promise<Source[]> {
  return await httpService.get(SOURCES, { metadata: true });
}

export async function getSource(sourceId: number): Promise<Source> {
  return await httpService.get(`${SOURCES}/${sourceId}`);
}

export async function postSource(source: Partial<Source>): Promise<Source> {
  return await httpService.post(SOURCES, source);
}

export async function delSource(sourceId: number): Promise<any> {
  return await httpService.delete(`${SOURCES}/${sourceId}`);
}

