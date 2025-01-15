import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { segmentService } from './services/segment.service';

type Segment = {
    id: number;
    timestamp: string;
    username: string;
    text: string;
    sourceId: number;
    order: number;
    parentSegmentId?: number;
    parentSegmentTimestamp?: string;
};

export const addSegmentsFromFile = createAsyncThunk<
    { sourceId: string; segments: Segment[] }, // Return type on success
    { file: File; sourceId: string }, // Parameters the function receives
    { rejectValue: string } // Value returned on rejection
>(
    'segments/addSegmentsFromFile',
    async ({ file, sourceId }, thunkAPI) => {
        try {
            const response = await segmentService.addSegmentsFromFile(file, sourceId);
            return { sourceId, segments: response.segments as Segment[] };
        } catch (error: any) {
            return thunkAPI.rejectWithValue(error.message || 'Failed to create segments');
        }
    }
);

// Initial state for segments
interface SegmentState {
    segments: Record<string, Segment[]>; // Mapping of sourceId to segments
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
            .addCase(addSegmentsFromFile.fulfilled, (state, action: PayloadAction<{ sourceId: string; segments: Segment[] }>) => {
                const { sourceId, segments } = action.payload;
                state.segments[sourceId] = segments; // Save segments by sourceId
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
