import React, { useEffect, useState } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { useSelector } from 'react-redux';
import { useNavigate } from "react-router-dom";
import { fetchSources, addSource } from '../SourceSlice';
import { addSegmentsFromFile, fetchSegments } from '../SegmentSlice';
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
    Box,
    Typography
} from '@mui/material';
// import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
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
    const { keycloak } = useKeycloak();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { showToast } = useToast();
    const { sources, loading, error } = useSelector((state: RootState) => state.sources);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedSource, setSelectedSource] = useState<number | null>(null);

    // useEffect(() => {
    //     dispatch(fetchSources());
    // }, [dispatch]);

    useEffect(() => {
        if (keycloak.authenticated) {
            dispatch(fetchSources());
        }
    }, [dispatch, keycloak.authenticated]);

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
                    properties: { segment_type: "file" }
                })).unwrap();
            }
            dispatch(fetchSegments({ source_id: addedSource.id }));

            showToast('Source and segments created successfully!', 'success');
        } catch (error) {
            console.error('Failed to add source:', error);
            showToast('Failed to add source. Please try again.', 'error');
        } finally {
            handleCloseDialog();
        }
    };

    if (!keycloak.authenticated) {
        return (
            <Box
                display="flex"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
                height="100vh"
                textAlign="center"
                sx={{
                    backgroundColor: "#f5f5f5",
                    padding: "2rem",
                    borderRadius: "12px",
                    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)"
                }}
            >
                <Typography variant="h4" sx={{ mb: 2, fontWeight: "bold", color: "#333" }}>
                    Welcome to Safot
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, color: "#666" }}>
                    Please log in using the button in the top right corner.
                </Typography>
            </Box>
        );
    }

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

                                        {/* ) : ( */}
                                        {/* <Button onClick={() => navigate(`source-view/${source.id}`)} // Navigate to view mode */}
                                        {/* //     >
                                        //         <RemoveRedEyeIcon />
                                        //     </Button>
                                        // )} */}

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
