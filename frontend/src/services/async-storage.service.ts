export const storageService = {
    query,
    get,
    post,
    put,
    remove,
};

// Type Definitions
type Entity = { _id: string } & Record<string, any>;

function query(entityType: string, delay: number = 1500): Promise<Entity[]> {
    const entities = JSON.parse(localStorage.getItem(entityType) || '[]') as Entity[];
    return new Promise(resolve => setTimeout(() => resolve(entities), delay));
}

function get(entityType: string, entityId: string): Promise<Entity> {
    return query(entityType).then(entities => {
        const entity = entities.find(entity => entity._id === entityId);
        if (!entity) throw new Error(`Get failed, cannot find entity with id: ${entityId} in: ${entityType}`);
        return entity;
    });
}

function post(entityType: string, newEntity: Omit<Entity, '_id'>): Promise<Entity> {
    const entityWithId: Entity = { ...newEntity, _id: _makeId() };
    return query(entityType).then(entities => {
        entities.push(entityWithId);
        _save(entityType, entities);
        return entityWithId;
    });
}

function put(entityType: string, updatedEntity: Entity): Promise<Entity> {
    return query(entityType).then(entities => {
        const idx = entities.findIndex(entity => entity._id === updatedEntity._id);
        if (idx < 0) throw new Error(`Update failed, cannot find entity with id: ${updatedEntity._id} in: ${entityType}`);
        entities.splice(idx, 1, updatedEntity);
        _save(entityType, entities);
        return updatedEntity;
    });
}

function remove(entityType: string, entityId: string): Promise<void> {
    return query(entityType).then(entities => {
        const idx = entities.findIndex(entity => entity._id === entityId);
        if (idx < 0) throw new Error(`Remove failed, cannot find entity with id: ${entityId} in: ${entityType}`);
        entities.splice(idx, 1);
        _save(entityType, entities);
    });
}

// Private functions

function _save(entityType: string, entities: Entity[]): void {
    localStorage.setItem(entityType, JSON.stringify(entities));
}

function _makeId(length: number = 5): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
