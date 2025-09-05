// Currently not used, for future usage.

import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Alert } from '@mui/material';
import AddSourceForm from './AddSourceForm';
import { useUser } from '../contexts/UserContext';

interface AddSourceDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    mode?: 'new_source' | 'translation';
}

const AddSourceDialog: React.FC<AddSourceDialogProps> = ({ open, onClose, onSubmit, mode = 'new_source' }) => {
    const [loading, setLoading] = useState(false);
    const { permissions } = useUser();

    const handleFormSubmit = async (data: any) => {
        setLoading(true);
        try {
            await onSubmit(data);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                {mode === 'new_source' ? 'Add New Source' : 'Create New Translation'}
                {!permissions.hasRole('safot-write') && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        {permissions.getAuthMessage("create sources", "safot-write")}
                    </Alert>
                )}
            </DialogTitle>
            <DialogContent>
                <AddSourceForm onSubmit={handleFormSubmit} mode={mode} />
            </DialogContent>
            <DialogActions>
                {loading && <CircularProgress size={20} style={{ marginRight: '8px' }} />}
                <Button onClick={onClose} color="secondary" disabled={loading}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    form="add-source-form"
                    variant="contained"
                    color="primary"
                    disabled={loading || !permissions.hasRole('safot-write')}
                    title={permissions.hasRole('safot-write') ? "Create source" : permissions.getAuthMessage("create sources", "safot-write")}
                >
                    Submit
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AddSourceDialog;