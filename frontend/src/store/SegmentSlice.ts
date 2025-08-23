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
  { source_id: number },
  { rejectValue: string }
>(
  'segments/fetchSegments',
  async ({ source_id }, { rejectWithValue }) => {
    try {
      return await getSegments(source_id);
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
      .addCase(fetchSegments.pending, (state, action) => {
        const { source_id } = action.meta.arg;
        if (!state.segments[source_id]) {
          state.segments[source_id] = [];
        }
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSegments.fulfilled, (state, action) => {
        const source_id = action.meta.arg.source_id;
        const segments = action.payload;
        state.segments[source_id] = segments;
        state.loading = false;
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
          const segments = state.segments[source_id].slice();
          const exist = segments.find((s) => s.id === segment.id);
          if (exist) {
						Object.assign(exist, segment);
          } else {
						segments.push(segment);
          }
          state.segments[source_id] = segments;
        });
      })
      .addCase(saveSegments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to save segments';
      })
  },
});

export default segmentSlice.reducer;

