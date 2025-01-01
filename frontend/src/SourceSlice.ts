import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { sourceService, initializeDemoData } from './services/source.service';
const { querySources } = sourceService

export const fetchSources = createAsyncThunk(
    'sources/fetchSources',
    async (_, thunkAPI) => {
        try {
            await initializeDemoData();
            const sources = await querySources();
            return sources;
        } catch (error: any) {
            return thunkAPI.rejectWithValue(error.message);
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
    isOriginal: boolean;
    status: string;
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
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
};

const initialState: SourcesState = {
    sources: [],
    status: 'idle',
    error: null,
};

const sourcesSlice = createSlice({
    name: 'sources',
    initialState,
    reducers: {
        resetSources: (state) => {
            state.sources = [];
            state.status = 'idle';
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSources.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(fetchSources.fulfilled, (state, action: PayloadAction<Source[]>) => {
                state.status = 'succeeded';
                state.sources = action.payload;
            })
            .addCase(fetchSources.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.status = 'failed';
                state.error = action.payload || 'Unknown error';
            });
    },
});

export const { resetSources } = sourcesSlice.actions;
export default sourcesSlice.reducer;
