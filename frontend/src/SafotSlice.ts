// Currently not used, for future usage.
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

const BACKEND_URL = process.env.REACT_APP_BASE_URL;

const getDefaultHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

interface Rule {
  id: number;
  timestamp: number;
  name: string;
  username: string;
  type: string;
  dictionary_id: number;
  dictionary_timestamp: number;
}

export interface Dictionary {
  id: number;
  timestamp: number;
  name: string;
  username: string;
  labels: string[];
}



export const fetchDictionaries = createAsyncThunk<Dictionary[]>(
  'dictionary/fetchDictionaries',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${BACKEND_URL}/dictionaries`, {
        headers: getDefaultHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch dictionaries');
      return (await response.json()) as Dictionary[];
    } catch (error: any) {
      return rejectWithValue(error || 'Failed to fetch dictionaries');
    }
  }
);

export const addDictionary = createAsyncThunk<Dictionary, Partial<Dictionary>>(
  'dictionary/addDictionary',
  async (newDictionary, { rejectWithValue }) => {
    try {
      const response = await fetch(`${BACKEND_URL}/dictionaries`, {
        method: 'POST',
        headers: getDefaultHeaders(),
        body: JSON.stringify(newDictionary),
      });
      if (!response.ok) throw new Error('Failed to add dictionary');
      return (await response.json()) as Dictionary;
    } catch (error: any) {
      return rejectWithValue(error || 'Failed adding dictionary');
    }
  }
);

export const updateDictionary = createAsyncThunk<Dictionary, Partial<Dictionary>>(
  'dictionary/updateDictionary',
  async (updatedData) => {
    const response = await fetch(`${BACKEND_URL}/dictionaries/${updatedData.id}`, {
      method: 'PUT',
      headers: getDefaultHeaders(),
      body: JSON.stringify(updatedData),
    });
    if (!response.ok) throw new Error('Failed to update dictionary');
    return (await response.json()) as Dictionary;
  }
);

export const deleteDictionary = createAsyncThunk<number, number>(
  'dictionary/deleteDictionary',
  async (id) => {
    const response = await fetch(`${BACKEND_URL}/dictionaries/${id}`, {
      headers: getDefaultHeaders(),
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete dictionary');
    return id;
  }
);

// Define the initial state interface
interface SafotState {
  rules: Rule[];
  dictionaries: Dictionary[];
  loading: Boolean,
  error: any,
}

// Initial state with empty arrays for rules and dictionaries
const initialState: SafotState = {
  rules: [],
  dictionaries: [],
  loading: false,
  error: null,
};

const safotSlice = createSlice({
  name: 'safot',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // Fetch dictionaries
    builder.addCase(fetchDictionaries.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchDictionaries.fulfilled, (state, action: PayloadAction<Dictionary[]>) => {
      state.dictionaries = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchDictionaries.rejected, (state, action: PayloadAction<any>) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Add dictionary
    builder.addCase(addDictionary.fulfilled, (state, action: PayloadAction<Dictionary>) => {
      state.dictionaries.push(action.payload);
    });
    builder.addCase(addDictionary.rejected, (state, action: PayloadAction<any>) => {
      state.error = action.payload;
    });

    // Update dictionary
    builder.addCase(updateDictionary.fulfilled, (state, action: PayloadAction<Dictionary>) => {
      const index = state.dictionaries.findIndex((dict) => dict.id === action.payload.id);
      if (index !== -1) {
        state.dictionaries[index] = action.payload;
      }
    });
    builder.addCase(updateDictionary.rejected, (state, action: PayloadAction<any>) => {
      state.error = action.payload;
    });

    // Delete dictionary
    builder.addCase(deleteDictionary.fulfilled, (state, action: PayloadAction<number>) => {
      state.dictionaries = state.dictionaries.filter((dict) => dict.id !== action.payload);
    });
    builder.addCase(deleteDictionary.rejected, (state, action: PayloadAction<any>) => {
      state.error = action.payload;
    });

  },
});

export default safotSlice.reducer;
