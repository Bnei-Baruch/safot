import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { segmentService } from './services/segment.service';
import { Segment } from './types';




export const translateSegments = createAsyncThunk<
    { translated_segments: Segment[], total_segments_translated: number },
    { source_id: number, segments: Segment[], target_language: string, source_language: string },
    { rejectValue: string }
>(
    'segments/translateSegments',
    async ({ source_id, segments, target_language, source_language }, { rejectWithValue }) => {
        try {
            const response = await segmentService.translateSegments(
                source_id,
                segments,
                target_language,
                source_language
            );

            return {
                translated_segments: response.translated_segments,
                total_segments_translated: response.total_segments_translated,
            };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to translate segments');
        }
    }
);

export const addSegment = createAsyncThunk<
    Segment,
    Omit<Segment, 'timestamp'>,
    { rejectValue: string }
>(
    'segments/addSegment',
    async (segmentData, { rejectWithValue }) => {
        try {
            return await segmentService.addSegment(segmentData);
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to add segment');
        }
    }
);

export const saveSegments = createAsyncThunk<
  { source_id: number; segments: Segment[] },  // return type
  Segment[],                                   // payload sent from frontend
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

export const addSegmentsFromFile = createAsyncThunk<
    { source_id: number; },
    { file: File; source_id: number, properties?: object },
    { rejectValue: string | undefined }
>(
    'segments/addSegmentsFromFile',
    async ({ file, source_id, properties }, thunkAPI) => {
        try {
            await segmentService.addSegmentsFromFile(file, source_id, properties);
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
            })
            .addCase(addSegment.fulfilled, (state, action) => {
                const segment = action.payload;
                if (!state.segments[segment.source_id]) {
                    state.segments[segment.source_id] = [];
                }
                //Check if an existing segment with the same `order` already exists
                const existingIndex = state.segments[segment.source_id].findIndex(t => t.order === segment.order);

                if (existingIndex !== -1)   // If a segment exists, replace it (keeping history in backend but only showing the latest in UI)
                    state.segments[segment.source_id][existingIndex] = segment;
                else   // If it's a new translation, add it to the store
                    state.segments[segment.source_id].push(segment);
            })
            .addCase(addSegment.rejected, (state, action) => {
                state.error = action.error.message || "Failed to add segment";
            })
            .addCase(saveSegments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(saveSegments.fulfilled, (state, action: PayloadAction<{ source_id: number; segments: Segment[] }>) => {
                const { source_id, segments } = action.payload;
                state.loading = false;
                state.segments[source_id] = segments;
            })
            .addCase(saveSegments.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || 'Failed to save segments';
            })
            .addCase(translateSegments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(translateSegments.fulfilled, (state, action) => {
                const { translated_segments, total_segments_translated } = action.payload;
                const source_id = action.meta.arg.source_id;
                state.loading = false;
                state.segments[source_id] = translated_segments;

                console.log(`✅ ${total_segments_translated} segments were translated successfully.`);
            })

            .addCase(translateSegments.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || 'Failed to translate segments';
            });
    },
});

export default segmentSlice.reducer;


