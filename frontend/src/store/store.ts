import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import dictionaryReducer from './DictionarySlice';
import segmentReducer from './SegmentSlice';
import sourceReducer from './SourceSlice';

const store = configureStore({
  reducer: {
    dictionaries: dictionaryReducer,
    sources: sourceReducer,
    segments: segmentReducer,
  },
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
