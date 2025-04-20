import { httpService } from './http.service'

const ENTITY_TYPE = 'sources';

export const sourceService = {
    querySources,
    getSourceById,
    addSource,
};

async function querySources(): Promise<any[]> {
    return await httpService.get(ENTITY_TYPE);
}

async function getSourceById(sourceId: number): Promise<any> {
    return await httpService.get(`${ENTITY_TYPE}/${sourceId}`);
}

async function addSource(source: Omit<any, 'id'>): Promise<any> {
    return await httpService.post(ENTITY_TYPE, source);
}

