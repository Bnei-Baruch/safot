import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { segmentService } from './services/segment.service';

export type Segment = {
    id: number;
    timestamp: string;
    username?: string;
    text: string;
    source_id: number;
    order: number;
    original_segment_id?: number;
    original_segment_timestamp?: string;
    properties: {
        translation_type?: "user" | "provider" | "edited";
        [key: string]: any;
    };
};


export const translateSegments = createAsyncThunk<
    { source_id: number, translated_segments: Segment[] },
    { source_id: number, original_source_id: number },
    { rejectValue: string }
>(
    'segments/translateSegments',
    async ({ source_id, original_source_id }, { rejectWithValue }) => {
        try {
            const response = await segmentService.translateSegments(source_id, original_source_id);

            return { source_id, translated_segments: response.translated_segments };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to translate segments');
        }
    }
);

export const addSegment = createAsyncThunk<
    Segment,
    Omit<Segment, 'id' | 'timestamp'>,
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

export const addSegmentsFromFile = createAsyncThunk<
    { source_id: number; },
    { file: File; source_id: number },
    { rejectValue: string | undefined }
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
                state.segments[segment.source_id].push(segment);
            })
            .addCase(addSegment.rejected, (state, action) => {
                state.error = action.error.message || "Failed to add segment";
            })
            .addCase(translateSegments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(translateSegments.fulfilled, (state, action: PayloadAction<{ source_id: number, translated_segments: Segment[] }>) => {
                const { source_id, translated_segments } = action.payload;
                state.loading = false;
                state.segments[source_id] = translated_segments; // מחליף את הסגמנטים המתורגמים
            })
            .addCase(translateSegments.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || 'Failed to translate segments';
            });
    },
});

export default segmentSlice.reducer;

// import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
// import { segmentService } from './services/segment.service';

// export type Segment = {
//     id: number;
//     timestamp: string;
//     username?: string;
//     text: string;
//     source_id: number;
//     order: number;
//     original_segment_id?: number;
//     original_segment_timestamp?: string;
//     properties: {
//         translation_type?: "user" | "provider" | "edited";
//         [key: string]: any;
//     };
// };

// export const addSegment = createAsyncThunk<
//     Segment,
//     Omit<Segment, 'id' | 'timestamp'>,
//     { rejectValue: string }
// >(
//     'segments/addSegment',
//     async (segmentData, { rejectWithValue }) => {
//         try {
//             return await segmentService.addSegment(segmentData);
//         } catch (error: any) {
//             return rejectWithValue(error.message || 'Failed to add segment');
//         }
//     }
// );

// export const addSegmentsFromFile = createAsyncThunk<
//     { source_id: number; },
//     { file: File; source_id: number },
//     { rejectValue: string | undefined }
// >(
//     'segments/addSegmentsFromFile',
//     async ({ file, source_id }, thunkAPI) => {
//         try {
//             await segmentService.addSegmentsFromFile(file, source_id);
//             return { source_id };
//         } catch (error: any) {
//             return thunkAPI.rejectWithValue(error.message || 'Failed to create segments');
//         }
//     }
// );

// export const fetchSegments = createAsyncThunk<
//     { source_id: number, segments: Segment[] },
//     { source_id: number },
//     { rejectValue: string }
// >(
//     'segments/fetchSegments',
//     async ({ source_id }, { rejectWithValue }) => {
//         try {
//             const segments: Segment[] = await segmentService.fetchSegments(source_id);
//             return { source_id, segments };
//         } catch (err: any) {
//             return rejectWithValue(err.message || 'Failed to fetch segments');
//         }
//     }
// );

// interface SegmentState {
//     segments: Record<number, Segment[]>;
//     loading: boolean;
//     error: string | null;
// }

// const initialState: SegmentState = {
//     segments: {},
//     loading: false,
//     error: null,
// };

// const segmentSlice = createSlice({
//     name: 'segments',
//     initialState,
//     reducers: {},
//     extraReducers: (builder) => {
//         builder
//             .addCase(fetchSegments.pending, (state) => {
//                 state.loading = true;
//                 state.error = null;
//             })
//             .addCase(fetchSegments.fulfilled, (state, action: PayloadAction<{ source_id: number, segments: Segment[] }>) => {
//                 const { source_id, segments } = action.payload;
//                 state.loading = false;
//                 state.segments[source_id] = segments;
//             })
//             .addCase(fetchSegments.rejected, (state, action: PayloadAction<string | undefined>) => {
//                 state.loading = false;
//                 state.error = action.payload || 'Unknown error';
//             })
//             .addCase(addSegmentsFromFile.pending, (state) => {
//                 state.loading = true;
//                 state.error = null;
//             })
//             .addCase(addSegmentsFromFile.fulfilled, (state, action: PayloadAction<{ source_id: number }>) => {
//                 const { source_id } = action.payload;
//                 state.segments[source_id] = [];
//                 state.loading = false;
//             })
//             .addCase(addSegmentsFromFile.rejected, (state, action) => {
//                 state.loading = false;
//                 if (action.payload) {
//                     state.error = action.payload;
//                 } else if (action.error.message) {
//                     state.error = action.error.message;
//                 } else {
//                     state.error = 'Failed to create segments';
//                 }
//             })
//             .addCase(addSegment.fulfilled, (state, action) => {
//                 const segment = action.payload;
//                 if (!state.segments[segment.source_id]) {
//                     state.segments[segment.source_id] = [];
//                 }
//                 state.segments[segment.source_id].push(segment);
//             })
//             .addCase(addSegment.rejected, (state, action) => {
//                 state.error = action.error.message || "Failed to add segment";
//             });
//     },
// });

// export default segmentSlice.reducer;

