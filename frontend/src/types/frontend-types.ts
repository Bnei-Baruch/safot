// TODO: Refactor Segment to be like Rule/Dictionary with _epoch fields
// also changing backend code...
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
  labels?: string[];
  type?: string;
  order?: number;

  original_source_id?: number;
  parent_source_id?: number;

  properties?: Record<string, any>;

  username: string;
  created_at: string;
  modified_by?: string;
  modified_at?: string;

	dictionary_id: number;
	dictionary_timestamp: string | number;

  // Metadata, output fields only.
  count?: number;
  created_at_epoch: number;
  modified_at_epoch: number;
	dictionary_timestamp_epoch: number;
}

export interface SourcePair {
  original: Source;
  translated: Source;
}

export enum Language {
  ENGLISH = "English",
  HEBREW = "Hebrew",
  SPANISH = "Spanish",
  RUSSIAN = "Russian",
  FRENCH = "French",
  ARABIC = "Arabic"
} 

export type FilterType = 'mine' | 'none' | 'file' | 'language' | 'from_language';

export interface SourceFilterProps {
  filterType: FilterType;
  setFilterType: (value: FilterType) => void;
  languageFilter: string | null;
  setLanguageFilter: (value: string | null) => void;
  fileNameFilter: string;
  setFileNameFilter: (value: string) => void;
  fromLanguageFilter: string | null;
  setFromLanguageFilter: (value: string | null) => void;
}

export interface LanguageOption {
  code: string;
  label: string;
  direction: 'ltr' | 'rtl';
}

export interface Example {
  sourceText: string;
  firstTranslation: string;
  lastTranslation: string;
  score?: number; // optional for now
}

export interface Rule {
  id?: number;
  timestamp?: string;
  name: string;
  username?: string;
  type: string;
  dictionary_id: number;
  properties: Record<string, any>;
	order: number;

	// Output only field.
  created_at_epoch: number;
  created_by: string;
  modified_at_epoch: number;
  modified_by: string;
}

export interface GetPromptParams {
  dictionary_id?: number,
  dictionary_timestamp?: number,

  prompt_key?: string,
  source_language?: string,
  target_language?: string,
}

export interface Dictionary {
  id?: number;
  timestamp?: string | number;
  name: string;
  username?: string;
  labels: string[];

	// Output only fields.
  created_at_epoch: number;
  created_by: string;
  modified_at_epoch: number;
  modified_by: string;
}

// User Management Types
export interface CurrentUser {
  sub: string;  // Keycloak user ID
  preferred_username?: string;
  email?: string;
  name?: string;
  roles: string[];  // Keycloak roles (safot-admin, safot-write, safot-read)
}

export interface UserPermissions {
  // Basic role checking
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;

  // Helper for messages (backward compatible)
  getAuthMessage: (action: string, requiredRole: string | string[]) => string;
}

// User Management Types
export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

