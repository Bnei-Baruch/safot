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
    IconButton,
} from '@mui/material';
// import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddSourceDialog from '../cmp/AddSourceDialog';
import { useToast } from '../cmp/Toast';

interface AddSourceData {
    file?: File;
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
    original_source_id?: number;
}

const SourceIndex: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { showToast } = useToast();
    const { sources, loading, error } = useSelector((state: RootState) => state.sources);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedSource, setSelectedSource] = useState<number | null>(null);

    useEffect(() => {
        dispatch(fetchSources());
    }, [dispatch]);

    const handleOpenDialog = (sourceId?: number) => {
        setSelectedSource(sourceId ?? null);
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setSelectedSource(null);
    };

    const handleAddSource = async (data: AddSourceData) => {
        const sourceData = {
            ...data,
            original_source_id: selectedSource,
        };
        try {
            const addedSource = await dispatch(addSource(sourceData as any)).unwrap();
            if (!addedSource.id) {
                throw new Error('Failed to get source ID from the backend.');
            }
            if (data.file) {
                await dispatch(addSegmentsFromFile({
                    file: data.file,
                    source_id: addedSource.id,
                    properties: { source_type: "file" }
                })).unwrap();
            }
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
                onClick={() => handleOpenDialog()}
                style={{ marginBottom: '20px' }}
            >
                Add New Source
            </Button>
            {loading && <p>Loading...</p>}
            {error && <p>Error: {error}</p>}
            {!loading && !error && (
                <TableContainer component={Paper} sx={{ margin: "auto", width: "80%", mt: 4 }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Language</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Translation Of</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.values(sources).map((source) => (
                                <TableRow key={source.id} sx={{ backgroundColor: source.original_source_id ? "#fff" : "#f0f0f0" }}>
                                    <TableCell>{source.name}</TableCell>
                                    <TableCell>{source.language}</TableCell>
                                    <TableCell>{source.type}</TableCell>
                                    <TableCell>
                                        {source.original_source_id ?
                                            `${sources[source.original_source_id]?.name || "Unknown"} (${sources[source.original_source_id]?.language || "Unknown"})`
                                            : "Original Source"}
                                    </TableCell>
                                    <TableCell>
                                        {source.original_source_id ? (
                                            <IconButton aria-label="edit" onClick={() => navigate(`source-edit/${source.id}`)}>
                                                <EditIcon />
                                            </IconButton>
                                        ) : null}
                                        <Button onClick={() => handleOpenDialog(source.id)}>➕ Create Translation</Button>
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
                    mode={selectedSource ? "translation" : "new_source"}
                />
            )}
        </div>
    );
};

export default SourceIndex;
