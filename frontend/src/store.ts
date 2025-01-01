import { configureStore } from '@reduxjs/toolkit';
// import safotReducer from './SafotSlice';
import sourceReducer from './SourceSlice';

export default configureStore({
  reducer: {
    // safot: safotReducer,
    sources: sourceReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
