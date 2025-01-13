import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { sourceService } from './services/source.service';

export const fetchSources = createAsyncThunk(
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

type Source = {
    id: number;
    timestamp: string;
    username: string;
    name: string;
    labels: string[];
    language: string;
    type: string;
    order: number | null;
    parent_source_id: number | null;
    parent_timestamp: string | null;
    properties: {
        category: string;
        description: string;
        audience: string;
    };
};

type SourcesState = {
    sources: Source[];
    loading: boolean;
    error: string | null;
};

const initialState: SourcesState = {
    sources: [],
    loading: false,
    error: null,
};

const sourcesSlice = createSlice({
    name: 'sources',
    initialState,
    reducers: {
        resetSources: (state) => {
            state.sources = [];
            state.loading = false;
            state.error = null;
        },
        updateSourceLocal: (state, action: PayloadAction<Source>) => {
            const updatedSource = action.payload;
            const index = state.sources.findIndex(source => source.id === updatedSource.id);
            if (index !== -1) {
                state.sources[index] = updatedSource;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSources.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSources.fulfilled, (state, action: PayloadAction<Source[]>) => {
                state.loading = false;
                state.sources = action.payload;
            })
            .addCase(fetchSources.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || 'Unknown error';
            });
    },
});

export const { resetSources, updateSourceLocal } = sourcesSlice.actions;
export default sourcesSlice.reducer;
