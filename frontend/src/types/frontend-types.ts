export interface Segment {
    id?: number;
    text: string;
    source_id: number;
    order: number;
    username?: string;
    timestamp?: string;
    original_segment_id?: number;
    original_segment_timestamp?: string;
    properties?: {
        segment_type?: "user_translation" | "provider_translation" | "edited" | "file";
        [key: string]: any;
    };
}

export interface BuildSegmentParams {
    text: string;
    source_id: number;
    order: number;
    properties: {
        segment_type?: "user_translation" | "provider_translation" | "edited" | "file";
        [key: string]: any;
    };
    id?: number;
    original_segment_id?: number;
    original_segment_timestamp?: string;
}

export interface Source {
    id: number;
    name: string;
    language: string;
    username: string;
    original_source_id?: number | null;
    type?: string;
    order?: number | null;
    labels?: string[];
    parent_source_id?: number | null;
    properties?: Record<string, any>;
}

export interface SourcePair {
    original: Source;
    translated: Source | null;
}

export enum Language {
    ENGLISH = "English",
    HEBREW = "Hebrew",
    SPANISH = "Spanish",
    RUSSIAN = "Russian",
    FRENCH = "French",
    ARABIC = "Arabic"
} 