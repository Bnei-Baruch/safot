import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  GetPromptRequest,
  PostDictionaryRequest,
  getDictionaries,
  getDictionaryBySource,
  getPrompt,
  getRules,
  postDictionary,
  postPromptDictionary,
  postRules,
} from '../services/dictionary.service';
import { Dictionary, Rule } from '../types/frontend-types';

/**
 * Helper function to get the latest version of a dictionary by ID
 */
export const getLatestDictionary = (
  dictionaries: Record<number, Record<number, Dictionary>>,
  id: number
): Dictionary | null => {
  const versions = dictionaries[id];
  if (!versions || Object.keys(versions).length === 0) return null;
  const latestTimestamp = Math.max(...Object.keys(versions).map(Number));
  return versions[latestTimestamp];
};

/**
 * Helper function to get all latest dictionaries as an array
 */
export const getLatestDictionaries = (
  dictionaries: Record<number, Record<number, Dictionary>>
): Dictionary[] => {
  const result: Dictionary[] = [];
  for (const id in dictionaries) {
    const latest = getLatestDictionary(dictionaries, Number(id));
    if (latest) {
      result.push(latest);
    }
  }
  return result;
};

/**
 * Helper to get all dictionary IDs
 */
export const getDictionaryIds = (
  dictionaries: Record<number, Record<number, Dictionary>>
): number[] => {
  return Object.keys(dictionaries).map(Number);
};

/**
 * Selector to get rules for a specific dictionary version
 * Returns the latest version of each rule where rule.timestamp <= dictionary_timestamp
 */
export const getRulesForDictionaryVersion = (
  rules: Record<number, Record<number, Record<number, Rule>>>,
  dictionary_id: number,
  dictionary_timestamp_epoch: number
): Rule[] => {
  const dictionaryRules = rules[dictionary_id];
  if (!dictionaryRules) return [];

  const result: Rule[] = [];
  for (const rule_id in dictionaryRules) {
    const ruleVersions = dictionaryRules[rule_id];
    // Get the latest rule version where timestamp <= dictionary_timestamp
    const validTimestamps = Object.keys(ruleVersions)
      .map(Number)
      .filter(t => t <= dictionary_timestamp_epoch);

    if (validTimestamps.length > 0) {
      const latestTimestamp = Math.max(...validTimestamps);
      result.push(ruleVersions[latestTimestamp]);
    }
  }

  // Sort by order field
  return result.sort((a, b) => (a.order || 0) - (b.order || 0));
};

interface DictionaryState {
  // dictionaries[dictionary_id][timestamp_epoch] = Dictionary
  // Stores all versions of dictionaries, keyed by ID then timestamp
  dictionaries: Record<number, Record<number, Dictionary>>;
  // rules[dictionary_id][rule_id][rule_timestamp_epoch] = Rule
  // Stores all versions of rules, independently versioned from dictionaries
  // To get rules for a dictionary version, use getRulesForDictionaryVersion selector
  rules: Record<number, Record<number, Record<number, Rule>>>;
  prompts: Record<number, Record<number, string>>
  loading: boolean;
  error: string | null;
}

export const fetchPrompt = createAsyncThunk<
  string,
  GetPromptRequest,
  { rejectValue: string }
>(
  'dictionaries/fetchPrompt',
  async (getPromptRequest, { rejectWithValue }) => {
    try {
      return await getPrompt(getPromptRequest);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch prompt');
    }
  }
);

export const fetchRules = createAsyncThunk<
  Rule[],
  { dictionary_id: number, dictionary_timestamp: number },
  { rejectValue: string }
>(
  'dictionaries/fetchRules',
  async ({ dictionary_id, dictionary_timestamp }, { rejectWithValue }) => {
    try {
      return await getRules(dictionary_id, dictionary_timestamp);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch rules');
    }
  }
);

export const addOrUpdateRules = createAsyncThunk<
  Rule[],
  Rule[],
  { rejectValue: string }
>(
  'dictionaries/addOrUpdateRules',
  async (rules, { rejectWithValue }) => {
    try {
      return await postRules(rules);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to add or update rules');
    }
  }
);

type FetchDicationariesParams = {
  dictionary_id?: number,
  dictionary_timestamp?: number,
};

const _fetchDictionaries = createAsyncThunk<
  Dictionary[],
  FetchDicationariesParams,
  { rejectValue: string }
>(
  'dictionaries/fetchDictionaries',
  async (params: FetchDicationariesParams = {}, { rejectWithValue }) => {
    try {
      return await getDictionaries(params);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch dictionaries');
    }
  }
);
export const fetchDictionaries = (params?: FetchDicationariesParams) => _fetchDictionaries(params ?? {});

export const fetchDictionaryBySource = createAsyncThunk<
 Dictionary,
 number,
  { rejectValue: string }
>(
  'dictionaries/fetchDictionaryBySource',
  async (source_id, { rejectWithValue }) => {
    try {
      return await getDictionaryBySource(source_id);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch dictionaries');
    }
  }
);

export const createPromptDictionary = createAsyncThunk<
  Dictionary,
  PostDictionaryRequest,
  { rejectValue: string }
>(
  'dictionaries/createPromptDictionary',
  async (request, { rejectWithValue }) => {
    try {
      return await postPromptDictionary(request);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to add or update dictionary');
    }
  }
);

export const addOrUpdateDictionary = createAsyncThunk<
  Dictionary,
  Dictionary,
  { rejectValue: string }
>(
  'dictionaries/addOrUpdateDictionary',
  async (dictionary, { rejectWithValue }) => {
    try {
      return await postDictionary(dictionary);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to add or update dictionary');
    }
  }
);

// Initial state with empty arrays for rules and dictionaries
const initialState: DictionaryState = {
  dictionaries: {},
  rules: {},
  prompts: {},
  loading: false,
  error: null,
};

const dictionarySlice = createSlice({
  name: 'dictionaries',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(_fetchDictionaries.pending, (state, action) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(_fetchDictionaries.fulfilled, (state, action) => {
      state.loading = false;
      const dictionaries = action.payload;
      dictionaries.forEach((dictionary) => {
        if (dictionary.id && dictionary.timestamp_epoch) {
          // Initialize nested structure if needed
          if (!state.dictionaries[dictionary.id]) {
            state.dictionaries[dictionary.id] = {};
          }
          state.dictionaries[dictionary.id][dictionary.timestamp_epoch] = dictionary;
        } else {
          state.error = 'Expected id and timestamp_epoch for dictionary.';
        }
      });
    })
    .addCase(_fetchDictionaries.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Unknown error';
    })
    .addCase(fetchRules.pending, (state, action) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(fetchRules.fulfilled, (state, action) => {
      const rules = action.payload;
      const { dictionary_id } = action.meta.arg;

      // Initialize nested structure if needed
      if (!state.rules[dictionary_id]) {
        state.rules[dictionary_id] = {};
      }

      rules.forEach((rule) => {
        if (!rule.id || !rule.timestamp_epoch) {
          state.error = 'Expected id and timestamp_epoch for rule.';
          return;
        }

        // Initialize rule_id level if needed
        if (!state.rules[dictionary_id][rule.id]) {
          state.rules[dictionary_id][rule.id] = {};
        }

        // Store this rule version
        state.rules[dictionary_id][rule.id][rule.timestamp_epoch] = rule;
      });
      state.loading = false;
    })
    .addCase(fetchRules.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Unknown error';
    })
    .addCase(addOrUpdateRules.pending, (state, action) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(addOrUpdateRules.fulfilled, (state, action) => {
      const rules = action.payload;

      // Process each rule in the response
      rules.forEach((rule) => {
        // Validate response has required fields
        if (!rule.dictionary_id || !rule.id || !rule.timestamp_epoch) {
          state.error = 'Expected dictionary_id, id, and timestamp_epoch for rule.';
          return;
        }

        // Initialize nested structure if needed
        if (!state.rules[rule.dictionary_id]) {
          state.rules[rule.dictionary_id] = {};
        }
        if (!state.rules[rule.dictionary_id][rule.id]) {
          state.rules[rule.dictionary_id][rule.id] = {};
        }

        // Store this rule version (might be a new version of existing rule)
        state.rules[rule.dictionary_id][rule.id][rule.timestamp_epoch] = rule;
      });

      state.loading = false;
    })
    .addCase(addOrUpdateRules.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Unknown error';
    })
    .addCase(fetchDictionaryBySource.pending, (state, action) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(fetchDictionaryBySource.fulfilled, (state, action) => {
      const dictionary = action.payload;
      if (dictionary.id && dictionary.timestamp_epoch) {
        // Initialize nested structure if needed
        if (!state.dictionaries[dictionary.id]) {
          state.dictionaries[dictionary.id] = {};
        }
        state.dictionaries[dictionary.id][dictionary.timestamp_epoch] = dictionary;
      } else {
        state.error = 'Expected id and timestamp_epoch for dictionary.';
      }
      state.loading = false;
    })
    .addCase(fetchDictionaryBySource.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Unknown error';
    })
    .addCase(fetchPrompt.pending, (state, action) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(fetchPrompt.fulfilled, (state, action) => {
      const { dictionary_id, dictionary_timestamp } = action.meta.arg;
      if (dictionary_id && dictionary_timestamp) {
        const prompt = action.payload;
        if (!state.prompts[dictionary_id]) {
          state.prompts[dictionary_id] = {};
        }
        state.prompts[dictionary_id][dictionary_timestamp] = prompt;
        state.loading = false;
      }
    })
    .addCase(fetchPrompt.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Unknown error';
    })
    .addCase(createPromptDictionary.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(createPromptDictionary.fulfilled, (state, action: PayloadAction<Dictionary>) => {
      state.loading = false;
      if (action.payload.id && action.payload.timestamp_epoch) {
        // Initialize nested structure if needed
        if (!state.dictionaries[action.payload.id]) {
          state.dictionaries[action.payload.id] = {};
        }
        state.dictionaries[action.payload.id][action.payload.timestamp_epoch] = action.payload;
      } else {
        state.error = 'Expecting dictionary with id and timestamp_epoch.';
      }
    })
    .addCase(createPromptDictionary.rejected, (state, action: PayloadAction<string | undefined>) => {
      state.loading = false;
      state.error = action.payload || 'Failed to create prompt dictionary';
    })
    .addCase(addOrUpdateDictionary.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(addOrUpdateDictionary.fulfilled, (state, action: PayloadAction<Dictionary>) => {
      state.loading = false;
      if (action.payload.id && action.payload.timestamp_epoch) {
        // Initialize nested structure if needed
        if (!state.dictionaries[action.payload.id]) {
          state.dictionaries[action.payload.id] = {};
        }
        state.dictionaries[action.payload.id][action.payload.timestamp_epoch] = action.payload;
      } else {
        state.error = 'Expecting dictionary with id and timestamp_epoch.';
      }
    })
    .addCase(addOrUpdateDictionary.rejected, (state, action: PayloadAction<string | undefined>) => {
      state.loading = false;
      state.error = action.payload || 'Failed to add or update dictionary';
    })
  },
});

export default dictionarySlice.reducer;
