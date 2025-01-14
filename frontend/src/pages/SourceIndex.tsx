import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchSources, addSource } from '../SourceSlice';
import { useAppDispatch, RootState } from '../store';
import { Button } from '@mui/material';

import AddSourceDialog from '../cmp/AddSourceDialog';

interface AddSourceData {
    file: File;
    name: string;
    labels: string[];
    language: string;
    type: string;
    order: number | null;
    properties: {
        category: string;
        description: string;
        audience: string;
    };
}

const SourceIndex: React.FC = () => {
    const dispatch = useAppDispatch();
    const { sources, loading, error } = useSelector((state: RootState) => state.sources);
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        dispatch(fetchSources());
    }, [dispatch]);

    // Handlers for dialog open/close
    const handleOpenDialog = () => setDialogOpen(true);
    const handleCloseDialog = () => setDialogOpen(false);


    const handleAddSource = async (data: AddSourceData) => {
        console.info('Data received in handleAddSource:', data);

        const sourceData = {
            name: data.name,
            labels: data.labels,
            language: data.language,
            type: data.type,
            order: data.order,
            properties: data.properties,
        };

        console.info('File to process:', data.file);

        try {
            await dispatch(addSource(sourceData as any)).unwrap();
            alert('Source added successfully!');
        } catch (error) {
            console.error('Failed to add source:', error);
            alert('Failed to add source. Please try again.');
        } finally {
            handleCloseDialog();
        }
    };

    return (
        <div className="source-index">
            <h1>Source Index CMP</h1>
            <Button
                variant="contained"
                color="primary"
                onClick={handleOpenDialog}
                style={{ marginBottom: '20px' }}
            >
                Add New Source
            </Button>
            {loading && <p>Loading...</p>}
            {error && <p>Error: {error}</p>}
            {!loading && !error && (
                <ul>
                    {sources.map((source) => (
                        <li key={source.id}>
                            {source.name} - {source.language}
                        </li>
                    ))}
                </ul>
            )}
            {dialogOpen && (
                <AddSourceDialog
                    open={dialogOpen}
                    onClose={handleCloseDialog}
                    onSubmit={handleAddSource}
                />
            )}
        </div>
    );
};

export default SourceIndex;
