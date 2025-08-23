import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getDictionaries } from '../services/dictionary.service';
import { Dictionary } from '../types/frontend-types';

interface DictionaryState {
  dictionaries: Record<number, Dictionary>;
  loading: boolean;
  error: string | null;
}

export const fetchDictionaries = createAsyncThunk<
  Dictionary[],
  void,
  { rejectValue: string }
>(
  'dictionaries/fetchDictionaries',
  async (_: void, { rejectWithValue }) => {
    try {
      return await getDictionaries();
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch dictionaries');
    }
  }
);

// Initial state with empty arrays for rules and dictionaries
const initialState: DictionaryState = {
  dictionaries: {},
  loading: false,
  error: null,
};

const dictionarySlice = createSlice({
  name: 'dictionaries',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchDictionaries.pending, (state, action) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(fetchDictionaries.fulfilled, (state, action) => {
      const dictionaries = action.payload;
      dictionaries.forEach((dictionary) => {
        state.dictionaries[dictionary.id] = dictionary;
      });
      state.loading = false;
    })
    .addCase(fetchDictionaries.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Unknown error';
    })
  },
});

export default dictionarySlice.reducer;
