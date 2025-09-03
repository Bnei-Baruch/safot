import React, { useEffect, useState } from 'react';

import { useAppDispatch, useAppSelector } from '../store/store';
import { Dictionary } from '../types/frontend-types';
import { fetchDictionaries } from '../store/DictionarySlice';
import { useToast } from '../cmp/Toast';

const Dictionaries: React.FC = () => {
  const dispatch = useAppDispatch();
  const { dictionaries, loading, error } = useAppSelector((state) => state.dictionaries);
  const [newDictName, setNewDictName] = useState('');
  const [editDict, setEditDict] = useState<Dictionary | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    dispatch(fetchDictionaries());
  }, [dispatch]);

  const handleAdd = async () => {
    if (newDictName.trim()) {
      try {
        // const payload = await dispatch(addDictionary({ name: newDictName, labels: [] })).unwrap();
        setNewDictName('');
        showToast("Dictionary added successfully!", "info");
        dispatch(fetchDictionaries());
      } catch (error) {
        if (error instanceof Error) {
          showToast(String(error), "error");
        } else {
          showToast('Unknown error adding dictionary.', "error");
        }
      }
    }
  };

  const handleEdit = (dictionary: Dictionary) => {
    setEditDict(dictionary);
  };

  const handleUpdate = async () => {
    if (editDict) {
      try {
        // const payload = await dispatch(updateDictionary(editDict)).unwrap();
        showToast("Dictionary updated successfully!", "info");
        setEditDict(null);
        dispatch(fetchDictionaries());
      } catch (error) {
        if (error instanceof Error) {
          showToast(String(error), "error");
        } else {
          showToast('Unknown error updating dictionary.', "error");
        }
      }
    }
  };

  const handleDelete = (id: number) => {
    // dispatch(deleteDictionary(id));
  };

  return (
    <div>
      <h2>Dictionary List</h2>

      {loading ? (
        <p>Loading dictionaries...</p>
      ) : error ? (
        <p>Error: {error}</p>
      ) : (
        <div>
          {Object.values(dictionaries).map((dict) => (
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
