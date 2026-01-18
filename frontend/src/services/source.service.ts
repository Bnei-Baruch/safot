import { httpService } from './http.service'
import { Source } from '../types/frontend-types';

const SOURCES = 'sources';

export interface SourceRelation {
  origin_source_id: number;
  translated_source_id: number;
}

export async function getSources(sourceIds?: number[], metadata: boolean = true): Promise<Source[]> {
  return await httpService.post(`${SOURCES}?metadata=${metadata}`, {source_ids: sourceIds || []});
}

export async function getSourceRelations(sourceIds: number[]): Promise<SourceRelation[]> {
  return await httpService.post(`${SOURCES}/relations`, { source_ids: sourceIds });
}

export async function postSources(sources: Partial<Source>[]): Promise<Source[]> {
  return await httpService.post(SOURCES, sources);
}

export async function postSourceOriginLinks(relations: SourceRelation[]): Promise<SourceRelation[]> {
  return await httpService.post(`${SOURCES}/origins`, { relations });
}

export async function delSource(sourceId: number): Promise<any> {
  return await httpService.delete(`${SOURCES}/${sourceId}`);
}

