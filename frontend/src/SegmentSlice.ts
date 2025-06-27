import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { segmentService } from './services/segment.service';
import { Segment } from './types/frontend-types';
import { PaginationInfo } from './types/frontend-types';
import { PAGE_SIZE } from './constants/pagination';


interface SegmentState {
    segments: Record<number, {
        pages: Record<number, Segment[]>;
        pagination: PaginationInfo | null;
        loading: boolean;
    }>;
    loading: boolean;
    error: string | null;
}

export const fetchSegments = createAsyncThunk<
    { source_id: number, segments: Segment[], pagination: PaginationInfo },
    { source_id: number, offset?: number, limit?: number },
    { rejectValue: string }
>(
    'segments/fetchSegments',
    async ({ source_id, offset = 0, limit = 100 }, { rejectWithValue }) => {
        try {
            const response = await segmentService.fetchSegments(source_id, offset, limit);
            return { 
                source_id, 
                segments: response.segments, 
                pagination: response.pagination 
            };
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

const initialState: SegmentState = {
    segments: {},
    loading: false,
    error: null,
};

const segmentSlice = createSlice({
    name: 'segments',
    initialState,
    reducers: {
        updateSegment: (state, action: PayloadAction<{ source_id: number, segment: Segment }>) => {
            const { source_id, segment } = action.payload;
            if (state.segments[source_id]) {
                // Find and update the segment in all pages
                Object.keys(state.segments[source_id].pages).forEach(pageKey => {
                    const page = parseInt(pageKey);
                    const pageSegments = state.segments[source_id].pages[page];
                    const segmentIndex = pageSegments.findIndex(s => s.id === segment.id);
                    if (segmentIndex !== -1) {
                        state.segments[source_id].pages[page][segmentIndex] = segment;
                    }
                });
            }
        },
        addSegment: (state, action: PayloadAction<{ source_id: number, segment: Segment }>) => {
            const { source_id, segment } = action.payload;
            if (!state.segments[source_id]) {
                state.segments[source_id] = {
                    pages: {},
                    pagination: null,
                    loading: false
                };
            }
            
            // Add to the appropriate page based on order
            const page = Math.floor((segment.order - 1) / PAGE_SIZE);
            if (!state.segments[source_id].pages[page]) {
                state.segments[source_id].pages[page] = [];
            }
            state.segments[source_id].pages[page].push(segment);
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSegments.pending, (state, action) => {
                const { source_id } = action.meta.arg;
                if (!state.segments[source_id]) {
                    state.segments[source_id] = {
                        pages: {},
                        pagination: null,
                        loading: false
                    };
                }
                state.segments[source_id].loading = true;
                state.error = null;
            })
            .addCase(fetchSegments.fulfilled, (state, action: PayloadAction<{ source_id: number, segments: Segment[], pagination: PaginationInfo }>) => {
                const { source_id, segments, pagination } = action.payload;
                const page = Math.floor(pagination.offset / PAGE_SIZE);
                
                if (!state.segments[source_id]) {
                    state.segments[source_id] = {
                        pages: {},
                        pagination: null,
                        loading: false
                    };
                }
                
                state.segments[source_id].pages[page] = segments;
                state.segments[source_id].pagination = pagination;
                state.segments[source_id].loading = false;
            })
            .addCase(fetchSegments.rejected, (state, action: PayloadAction<string | undefined, string, { arg: { source_id: number, offset?: number, limit?: number } }>) => {
                const { source_id } = action.meta.arg;
                if (state.segments[source_id]) {
                    state.segments[source_id].loading = false;
                }
                state.error = action.payload || 'Unknown error';
            })
            .addCase(saveSegments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(saveSegments.fulfilled, (state, action) => {
                const { source_id, segments } = action.payload;
                state.loading = false;

                // Add new segments to the store
                segments.forEach(segment => {
                    if (!state.segments[source_id]) {
                        state.segments[source_id] = {
                            pages: {},
                            pagination: null,
                            loading: false
                        };
                    }
                    
                    const page = Math.floor((segment.order - 1) / PAGE_SIZE);
                    if (!state.segments[source_id].pages[page]) {
                        state.segments[source_id].pages[page] = [];
                    }
                    state.segments[source_id].pages[page].push(segment);
                });
            })
            .addCase(saveSegments.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || 'Failed to save segments';
            })
    },
});

export const { updateSegment, addSegment } = segmentSlice.actions;
export default segmentSlice.reducer;


