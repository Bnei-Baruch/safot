import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { sourceService } from './services/source.service';
import { Source } from './types/frontend-types';

export const fetchSources = createAsyncThunk<
    Source[],
    void,
    { rejectValue: string }
>(
    'sources/fetchSources',
    async (_, { rejectWithValue }) => {
        try {
            const data = await sourceService.querySources();
            return data;
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
            return await sourceService.getSourceById(id);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch source');
        }
    }
);

export const addSource = createAsyncThunk<
    Source,
    Source,
    { rejectValue: string }
>(
    'sources/addSource',
    async (sourceData, { rejectWithValue }) => {
        try {
            return await sourceService.addSource(sourceData);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to add source');
        }
    }
);

// Async thunk for deleting a source by ID
export const deleteSource = createAsyncThunk<
    number,
    number,
    { rejectValue: string }
>(
    'sources/deleteSource',
    async (sourceId, { rejectWithValue }) => {
        try {
            await sourceService.deleteSource(sourceId);
            return sourceId;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to delete source');
        }
    }
);

type SourcesState = {
    sources: Record<string, Source>;
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
                    sources[source.id.toString()] = source;
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
            .addCase(addSource.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(addSource.fulfilled, (state, action: PayloadAction<Source>) => {
                state.loading = false;
                state.sources[action.payload.id] = action.payload;
            })
            .addCase(addSource.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || 'Failed to add source';
            })
            .addCase(deleteSource.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteSource.fulfilled, (state, action: PayloadAction<number>) => {
                state.loading = false;
                delete state.sources[action.payload];
            })
            .addCase(deleteSource.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || 'Failed to delete source';
            });
    },
});

// export const { resetSources, updateSourceLocal } = sourcesSlice.actions;
export default sourcesSlice.reducer;
