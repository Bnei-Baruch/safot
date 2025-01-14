import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import AddSourceForm from './AddSourceForm';

interface AddSourceDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

const AddSourceDialog: React.FC<AddSourceDialogProps> = ({ open, onClose, onSubmit }) => {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Add New Source</DialogTitle>
            <DialogContent>
                <AddSourceForm onSubmit={onSubmit} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="secondary">
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AddSourceDialog;
