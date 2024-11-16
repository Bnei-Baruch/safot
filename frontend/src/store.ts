import { configureStore } from '@reduxjs/toolkit';
import safotReducer from './SafotSlice';

export default configureStore({
  reducer: {
    safot: safotReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
