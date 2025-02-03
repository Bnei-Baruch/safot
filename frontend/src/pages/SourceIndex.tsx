import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from "react-router-dom";
import { fetchSources, addSource } from '../SourceSlice';
import { addSegmentsFromFile } from '../SegmentSlice';
import { useAppDispatch, RootState } from '../store';
import {
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";


import AddSourceDialog from '../cmp/AddSourceDialog';
// import { ShowToast } from '../cmp/Toast';
import { useToast } from '../cmp/Toast';

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
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { showToast } = useToast();
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
            // Add source metadata
            const addedSource = await dispatch(addSource(sourceData as any)).unwrap();
            // Ensure source ID exists
            if (!addedSource.id) {
                throw new Error('Failed to get source ID from the backend.');
            }
            // Add segments from file
            const response = await dispatch(addSegmentsFromFile({
                file: data.file,
                source_id: addedSource.id,
            })).unwrap();

            showToast('Source and segments created successfully!', 'success');
        } catch (error) {
            console.error('Failed to add source:', error);
            showToast('Failed to add source. Please try again.', 'error');
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
                <TableContainer
                    component={Paper}
                    sx={{
                        margin: "auto",           // Center horizontally
                        width: "80%",             // Optional: Set Table width
                        mt: 4,                    // Optional: Add top margin
                    }}
                >
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Language</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Owner</TableCell>
                                <TableCell>Properties</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.values(sources)
                                .sort((a, b) => b.id - a.id)
                                .map((source) => (
                                    <TableRow key={source.id}>
                                        <TableCell>{source.name}</TableCell>
                                        <TableCell>{source.language}</TableCell>
                                        <TableCell>{source.type}</TableCell>
                                        <TableCell>{source.username}</TableCell>
                                        <TableCell>{JSON.stringify(source.properties)}</TableCell>
                                        <TableCell>
                                            <IconButton aria-label="edit" onClick={() => navigate(`source-edit/${source.id}`)}>
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton aria-label="delete" disabled>
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
                </TableContainer>
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
