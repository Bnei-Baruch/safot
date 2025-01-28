import { httpService } from './http.service'

const ENTITY_TYPE = 'sources';

export const sourceService = {
    querySources,
    getSourceById,
    addSource,
    updateSource,
    removeSource,
};

// Fetch all sources
async function querySources(): Promise<any[]> {
    return await httpService.get(ENTITY_TYPE);
}
// Fetch a specific source by ID
async function getSourceById(sourceId: number): Promise<any> {
    return await httpService.get(`${ENTITY_TYPE}/${sourceId}`);
}

// Add a new source
async function addSource(source: Omit<any, 'id'>): Promise<any> {
    return await httpService.post(ENTITY_TYPE, source);
}

// Update an existing source
async function updateSource(sourceId: number, source: any): Promise<any> {
    return await httpService.put(`${ENTITY_TYPE}/${sourceId}`, source);
}

// Remove a source by ID
async function removeSource(sourceId: number): Promise<void> {
    return await httpService.delete(`${ENTITY_TYPE}/${sourceId}`);
}

