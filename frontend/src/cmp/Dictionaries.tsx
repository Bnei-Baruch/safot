// Currently not used, for future usage.

import React, { useEffect, useState } from 'react';
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from './hooks';
import {
  fetchDictionaries,
  addDictionary,
  updateDictionary,
  deleteDictionary,
  Dictionary
} from './SafotSlice';

const Dictionaries: React.FC = () => {
  const dispatch = useAppDispatch();
  const dictionaries = useAppSelector((state) => state.safot.dictionaries);
  const loading = useAppSelector((state) => state.safot.loading);
  const error = useAppSelector((state) => state.safot.error);
  const [newDictName, setNewDictName] = useState('');
  const [editDict, setEditDict] = useState<Dictionary | null>(null);

  useEffect(() => {
    dispatch(fetchDictionaries());
  }, [dispatch]);

  const handleAdd = async () => {
    if (newDictName.trim()) {
      try {
        const payload = await dispatch(addDictionary({ name: newDictName, labels: [] })).unwrap();
        setNewDictName('');
        toast.success("Dictionary added successfully!");
        dispatch(fetchDictionaries());
      } catch (error) {
        toast.error(error.stack);
      }
    }
  };

  const handleEdit = (dictionary: Dictionary) => {
    setEditDict(dictionary);
  };

  const handleUpdate = async () => {
    if (editDict) {
      try {
        const payload = await dispatch(updateDictionary(editDict)).unwrap();
        toast.success("Dictionary updated successfully!");
        setEditDict(null);
        dispatch(fetchDictionaries());
      } catch (error) {
        toast.error(error.stack);
      }
    }
  };

  const handleDelete = (id: number) => {
    dispatch(deleteDictionary(id));
  };

  return (
    <div>
      <h2>Dictionary List</h2>

      {loading ? (
        <p>Loading dictionaries...</p>
      ) : error ? (
        <p>Error: {error.stack || error}</p>
      ) : (
        <div>
          {dictionaries.map((dict) => (
            <div key={dict.id} style={{ display: 'flex', alignItems: 'center' }}>
              {editDict && editDict.id === dict.id ? (
                <input
                  value={editDict.name}
                  onChange={(e) => setEditDict({ ...editDict, name: e.target.value })}
                />
              ) : (
                <span>{dict.name}</span>
              )}
              <button onClick={() => handleEdit(dict)}>Edit</button>
              <button onClick={() => handleDelete(dict.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          type="text"
          value={newDictName}
          onChange={(e) => setNewDictName(e.target.value)}
          placeholder="Add new dictionary"
        />
        <button onClick={handleAdd}>Add</button>
      </div>

      {editDict && (
        <div>
          <button onClick={handleUpdate}>Update</button>
          <button onClick={() => setEditDict(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
};

export default Dictionaries;
