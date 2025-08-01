import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { segmentService } from './services/segment.service';
import { Segment } from './types/frontend-types';

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

export const saveSegments = createAsyncThunk<
    { source_id: number; segments: Segment[] },
    Segment[],
    { rejectValue: string }
>(
    'segments/saveSegments',
    async (segments, { rejectWithValue }) => {
        try {
            return await segmentService.saveSegments(segments);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to save segments');
        }
    }
);

interface SegmentState {
    segments: Record<number, Segment[]>;
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
            .addCase(saveSegments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(saveSegments.fulfilled, (state, action) => {
                const { source_id, segments } = action.payload;
                state.loading = false;

                if (!state.segments[source_id]) {
                    state.segments[source_id] = [];
                }
                segments.forEach(newSegment => {
                    const existingIndex = state.segments[source_id].findIndex(
                        s => s.order === newSegment.order
                    );
                    if (existingIndex !== -1) {
                        state.segments[source_id][existingIndex] = newSegment;
                    } else {
                        state.segments[source_id].push(newSegment);
                    }
                });
            })
            .addCase(saveSegments.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || 'Failed to save segments';
            })
    },
});

export default segmentSlice.reducer;


