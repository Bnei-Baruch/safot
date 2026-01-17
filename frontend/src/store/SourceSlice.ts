import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { delSource, getSources, postSources, getSourceRelations, SourceRelation } from '../services/source.service';
import { Source } from '../types/frontend-types';

export const fetchSources = createAsyncThunk<
  Source[],
  number[] | undefined,
  { rejectValue: string }
>(
  'sources/fetchSources',
  async (sourceIds, { rejectWithValue }) => {
    try {
      return await getSources(sourceIds);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch sources');
    }
  }
);

export const addOrUpdateSources = createAsyncThunk<
  Source[],
  Source[],
  { rejectValue: string }
>(
  'sources/addOrUpdateSources',
  async (sourcesData, { rejectWithValue }) => {
    try {
      return await postSources(sourcesData);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to add or update sources');
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

export const fetchSourceRelations = createAsyncThunk<
  SourceRelation[],
  number[],
  { rejectValue: string }
>(
  'sources/fetchSourceRelations',
  async (sourceIds, { rejectWithValue }) => {
    try {
      return await getSourceRelations(sourceIds);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch source relations');
    }
  }
);

type SourceRelations = {
  origins: number[];
  translations: number[];
};

type SourcesState = {
  sources: Record<number, Source>;
  relations: Record<number, SourceRelations>;
  loading: boolean;
  error: string | null;
};

const initialState: SourcesState = {
  sources: {},
  relations: {},
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
        // Merge fetched sources into existing state (don't replace)
        action.payload.forEach(source => {
          state.sources[source.id] = source;
        });
      })
      .addCase(fetchSources.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || 'Unknown error';
      })
      .addCase(addOrUpdateSources.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addOrUpdateSources.fulfilled, (state, action: PayloadAction<Source[]>) => {
        state.loading = false;
        action.payload.forEach(source => {
          state.sources[source.id] = source;
        });
      })
      .addCase(addOrUpdateSources.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || 'Failed to add or update sources';
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
      })
      .addCase(fetchSourceRelations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSourceRelations.fulfilled, (state, action: PayloadAction<SourceRelation[]>) => {
        state.loading = false;
        // Process relations into the map structure using Sets to avoid duplicates
        const relationsMap: Record<number, { origins: Set<number>, translations: Set<number> }> = {};

        action.payload.forEach(rel => {
          // Add to origin source's translations set
          if (!relationsMap[rel.origin_source_id]) {
            relationsMap[rel.origin_source_id] = { origins: new Set(), translations: new Set() };
          }
          relationsMap[rel.origin_source_id].translations.add(rel.translated_source_id);

          // Add to translated source's origins set
          if (!relationsMap[rel.translated_source_id]) {
            relationsMap[rel.translated_source_id] = { origins: new Set(), translations: new Set() };
          }
          relationsMap[rel.translated_source_id].origins.add(rel.origin_source_id);
        });

        // Convert sets to arrays and merge with existing relations
        Object.keys(relationsMap).forEach(sourceIdStr => {
          const sourceId = parseInt(sourceIdStr);
          state.relations[sourceId] = {
            origins: Array.from(relationsMap[sourceId].origins),
            translations: Array.from(relationsMap[sourceId].translations),
          };
        });
      })
      .addCase(fetchSourceRelations.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch source relations';
      });
  },
});

export default sourcesSlice.reducer;
