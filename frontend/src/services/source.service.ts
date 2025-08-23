import { httpService } from './http.service'

const SOURCES = 'sources';

export async function getSources(): Promise<any[]> {
  return await httpService.get(SOURCES);
}

export async function getSource(sourceId: number): Promise<any> {
  return await httpService.get(`${SOURCES}/${sourceId}`);
}

export async function postSource(source: Omit<any, 'id'>): Promise<any> {
  return await httpService.post(SOURCES, source);
}

export async function delSource(sourceId: number): Promise<any> {
  return await httpService.delete(`${SOURCES}/${sourceId}`);
}

