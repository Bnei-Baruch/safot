import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { segmentService } from './services/segment.service';

type Segment = {
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
    { source_id: string; segments: Segment[] }, // Return type on success
    { file: File; source_id: string }, // Parameters the function receives
    { rejectValue: string } // Value returned on rejection
>(
    'segments/addSegmentsFromFile',
    async ({ file, source_id: source_id }, thunkAPI) => {
        try {
            const response = await segmentService.addSegmentsFromFile(file, source_id);
            return { source_id: source_id, segments: response.segments as Segment[] };
        } catch (error: any) {
            return thunkAPI.rejectWithValue(error.message || 'Failed to create segments');
        }
    }
);

// Initial state for segments
interface SegmentState {
    segments: Record<string, Segment[]>; // Mapping of source_id to segments
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
            .addCase(addSegmentsFromFile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(addSegmentsFromFile.fulfilled, (state, action: PayloadAction<{ source_id: string; segments: Segment[] }>) => {
                const { source_id: source_id, segments } = action.payload;
                state.segments[source_id] = segments; // Save segments by source_id
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
