import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { delSource, getSource, getSources, postSource } from '../services/source.service';
import { Source } from '../types/frontend-types';

export const fetchSources = createAsyncThunk<
  Source[],
  void,
  { rejectValue: string }
>(
  'sources/fetchSources',
  async (_, { rejectWithValue }) => {
    try {
      return await getSources();
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch sources');
    }
  }
);

export const fetchSource = createAsyncThunk<
  Source,
  { id: number; },
  { rejectValue: string }
>(
  'sources/fetchSource',
  async ({ id }, { rejectWithValue }) => {
    try {
      return await getSource(id);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch source');
    }
  }
);

export const addOrUpdateSource = createAsyncThunk<
  Source,
  Source,
  { rejectValue: string }
>(
  'sources/addOrUpdateSource',
  async (sourceData, { rejectWithValue }) => {
    try {
      return await postSource(sourceData);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to add source');
    }
  }
);

export const deleteSource = createAsyncThunk<
  Array<number>,
  number,
  { rejectValue: string }
>(
  'sources/deleteSource',
  async (sourceId, { rejectWithValue }) => {
    try {
      return await delSource(sourceId);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to delete source');
    }
  }
);

type SourcesState = {
  sources: Record<number, Source>;
  loading: boolean;
  error: string | null;
};

const initialState: SourcesState = {
  sources: {},
  loading: false,
  error: null,
};

const sourcesSlice = createSlice({
  name: 'sources',
  initialState,
  reducers: {
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSources.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSources.fulfilled, (state, action: PayloadAction<Source[]>) => {
        state.loading = false;
        state.sources = action.payload.reduce<Record<string, Source>>((sources, source) => {
          sources[source.id] = source;
          return sources;
        }, {});
      })
      .addCase(fetchSources.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || 'Unknown error';
      })
      .addCase(fetchSource.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSource.fulfilled, (state, action: PayloadAction<Source>) => {
        state.loading = false;
        state.sources[action.payload.id] = action.payload;
      })
      .addCase(fetchSource.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || 'Failed to add source';
      })
      .addCase(addOrUpdateSource.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addOrUpdateSource.fulfilled, (state, action: PayloadAction<Source>) => {
        state.loading = false;
        state.sources[action.payload.id] = action.payload;
      })
      .addCase(addOrUpdateSource.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || 'Failed to add source';
			})
			.addCase(deleteSource.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(deleteSource.fulfilled, (state, action: PayloadAction<Array<number>>) => {
				state.loading = false;
				const deletedSourceIds = action.payload;
				deletedSourceIds.forEach((deletedSourceId) => delete state.sources[deletedSourceId]);
			})
			.addCase(deleteSource.rejected, (state, action: PayloadAction<string | undefined>) => {
				state.loading = false;
				state.error = action.payload || 'Failed to delete source';
      });
  },
});

export default sourcesSlice.reducer;
