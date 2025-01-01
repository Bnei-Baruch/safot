import { storageService } from './async-storage.service';

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
    return await storageService.query(ENTITY_TYPE); // Using query from async-service
}

// Fetch a specific source by ID
async function getSourceById(sourceId: string): Promise<any> {
    return await storageService.get(ENTITY_TYPE, sourceId); // Using get from async-service
}

// Add a new source
async function addSource(source: Omit<any, '_id'>): Promise<any> {
    return await storageService.post(ENTITY_TYPE, source); // Using post from async-service
}

// Update an existing source
async function updateSource(source: any): Promise<any> {
    return await storageService.put(ENTITY_TYPE, source); // Using put from async-service
}

// Remove a source by ID
async function removeSource(sourceId: string): Promise<void> {
    return await storageService.remove(ENTITY_TYPE, sourceId); // Using remove from async-service
}

const demoData = [
    {
        id: 1,
        timestamp: "2024-01-01T08:00:00Z",
        username: "user1",
        name: "Kabbalah, Science, and the Meaning of Life",
        labels: ["Science", "Kabbalistic Sources"],
        language: "he",
        isOriginal: true,
        status: "done",
        parent_source_id: null,
        parent_timestamp: null,
        properties: {
            category: "book",
            description: "Explore the intersection of quantum physics and Kabbalah, blending scientific inquiry with spiritual insight to address profound questions about existence and the universe.",
            audience: "Readers interested in the intersection of science, spirituality, and the deeper questions of existence.",
        },
    },
    {
        id: 2,
        timestamp: "2024-01-02T09:00:00Z",
        username: "user1",
        name: "Kabbalah, Science, and the Meaning of Lifee",
        labels: ["Science", "Kabbalistic Sources"],
        language: "en",
        isOriginal: false,
        status: "on process",
        parent_source_id: 1,
        parent_timestamp: "2024-01-01T08:00:00Z",
        properties: {
            category: "book",
            description: "Explore the intersection of quantum physics and Kabbalah, blending scientific inquiry with spiritual insight to address profound questions about existence and the universe.",
            audience: "Readers interested in the intersection of science, spirituality, and the deeper questions of existence.",
        },
    },
    {
        id: 3,
        timestamp: "2024-01-03T10:00:00Z",
        username: "user2",
        name: "Thanks to Women",
        labels: ["Women", "Kabbalistic Sources"],
        language: "he",
        isOriginal: true,
        status: "finalized",
        parent_source_id: null,
        parent_timestamp: null,
        properties: {
            category: "article",
            description: "Discover how women, as a fundamental force of nature, can lead society toward a better future and drive meaningful change in the world.",
            audience: "Women and anyone interested in understanding the transformative role of women in shaping society and the world",
        },
    },
];

export const initializeDemoData = async () => {
    const storedData = localStorage.getItem("sources");
    if (!storedData) {
        localStorage.setItem("sources", JSON.stringify(demoData));
    }
};


