import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getSegments, postSegments } from '../services/segment.service';
import { Segment } from '../types/frontend-types';


interface SegmentState {
  segments: Record<number, Segment[]>;
  loading: boolean;
  error: string | null;
}

export const fetchSegments = createAsyncThunk<
  Segment[],
  number[] | undefined,
  { rejectValue: string }
>(
  'segments/fetchSegments',
  async (sourceIds, { rejectWithValue }) => {
    try {
      return await getSegments(sourceIds);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch segments');
    }
  }
);

export const saveSegments = createAsyncThunk<
  Segment[],
  Segment[],
  { rejectValue: string }
>(
  'segments/saveSegments',
  async (segments, { rejectWithValue }) => {
    try {
      return await postSegments(segments);
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
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSegments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSegments.fulfilled, (state, action) => {
        const segments = action.payload;
        state.loading = false;

        // Group segments by source_id
        const segmentsBySource: Record<number, Segment[]> = {};
        segments.forEach(segment => {
          if (!segmentsBySource[segment.source_id]) {
            segmentsBySource[segment.source_id] = [];
          }
          segmentsBySource[segment.source_id].push(segment);
        });

        // Update state with grouped segments
        Object.keys(segmentsBySource).forEach(sourceIdStr => {
          const sourceId = parseInt(sourceIdStr);
          state.segments[sourceId] = segmentsBySource[sourceId];
        });
      })
      .addCase(fetchSegments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Unknown error';
      })
      .addCase(saveSegments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveSegments.fulfilled, (state, action) => {
        const segments = action.payload;
        state.loading = false;

        // Add or update segments to the store.
        segments.forEach(segment => {
          const source_id = segment.source_id;
          if (!state.segments[source_id]) {
            state.segments[source_id] = [];
          }
          const existingIndex = state.segments[source_id].findIndex(s => s.id === segment.id);
          if (existingIndex !== -1) {
            state.segments[source_id][existingIndex] = segment;
          } else {
            state.segments[source_id].push(segment);
          }
        });
      })
      .addCase(saveSegments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to save segments';
      })
  },
});

export default segmentSlice.reducer;

