import { configureStore } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';
import safotReducer from './SafotSlice';
import sourceReducer from './SourceSlice';
import segmentReducer from './SegmentSlice';

const store = configureStore({
  reducer: {
    safot: safotReducer,
    sources: sourceReducer,
    segments: segmentReducer,
  },
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
