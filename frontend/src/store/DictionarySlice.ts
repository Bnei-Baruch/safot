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
  postRule,
} from '../services/dictionary.service';
import { Dictionary, Rule } from '../types/frontend-types';

interface DictionaryState {
  dictionaries: Record<number, Dictionary>;
  rules: Record<number, Rule[]>;
  prompts: Record<number, string>
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

export const addOrUpdateRule = createAsyncThunk<
  Rule,
  Rule,
  { rejectValue: string }
>(
  'dictionaries/addOrUpdateRule',
  async (rule, { rejectWithValue }) => {
    try {
      return await postRule(rule);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to add or update rule');
    }
  }
);

type FetchDicationariesParams = {
  dictionary_id?: number,
  dictionary_timestamp?: number,
  skip_redux?: boolean,
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
      const params = action.meta.arg;
      state.loading = false;
      if (params.skip_redux) {
        return;
      }
      const dictionaries = action.payload;
      dictionaries.forEach((dictionary) => {
        if (dictionary.id) {
          state.dictionaries[dictionary.id] = dictionary;
        } else {
          state.error = 'Expected id for dictionary.';
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
      rules.forEach((rule) => {
        if (!(rule.dictionary_id in state.rules)) {
          state.rules[rule.dictionary_id] = [];
        }
        // Rules should be unique per rule id (usually the latest)
        const dictionaryRules = state.rules[rule.dictionary_id];
        const existingIndex = dictionaryRules.findIndex(r => r.id === rule.id);
        if (existingIndex !== -1) {
          dictionaryRules[existingIndex] = rule;
        } else {
          dictionaryRules.push(rule);
        }
      });
      state.loading = false;
    })
    .addCase(fetchRules.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Unknown error';
    })
    .addCase(addOrUpdateRule.pending, (state, action) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(addOrUpdateRule.fulfilled, (state, action) => {
      const rule = action.payload;
      if (!(rule.dictionary_id in state.rules)) {
        state.rules[rule.dictionary_id] = [];
      }
      const index = state.rules[rule.dictionary_id].findIndex((r) => r.id === rule.id);
      if (index !== -1) {
        state.rules[rule.dictionary_id].splice(index, 1, rule);
      } else {
        state.rules[rule.dictionary_id].push(rule);
      }
      state.loading = false;
    })
    .addCase(addOrUpdateRule.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Unknown error';
    })
    .addCase(fetchDictionaryBySource.pending, (state, action) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(fetchDictionaryBySource.fulfilled, (state, action) => {
      const dictionary = action.payload;
      if (dictionary.id) {
        state.dictionaries[dictionary.id] = dictionary;
      } else {
        state.error = 'Expected id for dictionary.';
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
      const { dictionary_id } = action.meta.arg;
      if (dictionary_id) {
        const prompt = action.payload;
        state.prompts[dictionary_id] = prompt;
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
      if (action.payload.id) {
        state.dictionaries[action.payload.id] = action.payload;
      } else {
        state.error = 'Expecting dictionary with id.';
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
      if (action.payload.id) {
        state.dictionaries[action.payload.id] = action.payload;
      } else {
        state.error = 'Expecting dictionary with id.';
      }
    })
    .addCase(addOrUpdateDictionary.rejected, (state, action: PayloadAction<string | undefined>) => {
      state.loading = false;
      state.error = action.payload || 'Failed to add or update dictionary';
    })
  },
});

export default dictionarySlice.reducer;
