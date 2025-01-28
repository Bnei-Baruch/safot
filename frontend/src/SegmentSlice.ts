import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { segmentService } from './services/segment.service';

export type Segment = {
    id: number;
    timestamp: string;
    username: string;
    text: string;
    source_id: number;
    order: number;
    original_SegmentId?: number;
    original_SegmentTimestamp?: string;
};

export const addSegmentsFromFile = createAsyncThunk<
    { source_id: number; }, // Return type on success
    { file: File; source_id: number }, // Parameters the function receives
    { rejectValue: string } // Value returned on rejection
>(
    'segments/addSegmentsFromFile',
    async ({ file, source_id }, thunkAPI) => {
        try {
            await segmentService.addSegmentsFromFile(file, source_id);
            return { source_id };
        } catch (error: any) {
            return thunkAPI.rejectWithValue(error.message || 'Failed to create segments');
        }
    }
);

export const fetchSegments = createAsyncThunk<
    { source_id: number, segments: Segment[] },
    { source_id: number },
    { rejectValue: string }
>(
    'segments/fetchSegments',
    async ({ source_id }, { rejectWithValue }) => {
        try {
            const segments: Segment[] = await segmentService.fetchSegments(source_id);
            return { source_id, segments };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch segments');
        }
    }
);

// Initial state for segments
interface SegmentState {
    segments: Record<number, Segment[]>; // Mapping of source_id to segments
    loading: boolean;
    error: string | null;
}

const initialState: SegmentState = {
    segments: {},
    loading: false,
    error: null,
};

const segmentSlice = createSlice({
    name: 'segments',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchSegments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSegments.fulfilled, (state, action: PayloadAction<{ source_id: number, segments: Segment[] }>) => {
                const { source_id, segments } = action.payload;
                state.loading = false;
                state.segments[source_id] = segments;
            })
            .addCase(fetchSegments.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || 'Unknown error';
            })
            .addCase(addSegmentsFromFile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(addSegmentsFromFile.fulfilled, (state, action: PayloadAction<{ source_id: number }>) => {
                const { source_id } = action.payload;
                state.segments[source_id] = [];
                state.loading = false;
            })
            .addCase(addSegmentsFromFile.rejected, (state, action) => {
                state.loading = false;

                if (action.payload) {
                    state.error = action.payload;
                } else if (action.error.message) {
                    state.error = action.error.message;
                } else {
                    state.error = 'Failed to create segments';
                }
            });
    },
});

export default segmentSlice.reducer;
