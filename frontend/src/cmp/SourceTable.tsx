import React, { useState } from 'react';
import {
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
    Button,
    TableContainer,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Source, SourcePair } from '../types/frontend-types';


interface SourceTableProps {
    pairs: SourcePair[];
    onDelete: (sourceId: number) => void;
}

const SourceTable: React.FC<SourceTableProps> = ({ pairs, onDelete }) => {
    const navigate = useNavigate();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);

    const handleDeleteClick = (sourceId: number) => {
        setSelectedSourceId(sourceId);
        setConfirmOpen(true);
    };

    const handleConfirm = () => {
        if (selectedSourceId !== null) {
            onDelete(selectedSourceId);
        }
        setConfirmOpen(false);
        setSelectedSourceId(null);
    };

    const handleCancel = () => {
        setConfirmOpen(false);
        setSelectedSourceId(null);
    };

    return (
        <>
            <TableContainer component={Paper} sx={{ margin: "auto", width: "80%", mt: 4 }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Upload By</TableCell>
                            <TableCell>From</TableCell>
                            <TableCell>To</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Update</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {pairs.map(({ original, translated }) => (
                            <TableRow key={original.id}>
                                <TableCell>{original.name}</TableCell>
                                <TableCell>{original.username}</TableCell>
                                <TableCell>{original.language}</TableCell>
                                <TableCell>{translated?.language || '-'}</TableCell>
                                <TableCell>{translated ? 'Done' : 'Pending'}</TableCell>
                                <TableCell>
                                    {translated && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => navigate(`/source-edit/${translated.id}`)}
                                        >
                                            Edit
                                        </Button>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Button onClick={() => handleDeleteClick(original.id)}>Delete</Button>
                                    <Button disabled>Download</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Dialog open={confirmOpen} onClose={handleCancel}>
                <DialogTitle>Delete Source</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                    Are you sure you want to delete this source and all its segments? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancel}>Cancel</Button>
                    <Button onClick={handleConfirm} color="error">Confirm</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default SourceTable;
