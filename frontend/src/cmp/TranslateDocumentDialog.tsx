import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    CircularProgress,
    MenuItem
} from '@mui/material';

interface TranslateDocumentDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: {
        file: File;
        name: string;
        source_language: string;
        target_language: string;
    }) => Promise<void>;
}

const LANGUAGES = ['English', 'Hebrew', 'French', 'Arabic', 'Spanish', 'Russian'];

const TranslateDocumentDialog: React.FC<TranslateDocumentDialogProps> = ({ open, onClose, onSubmit }) => {
    const [file, setFile] = useState<File | null>(null);
    const [sourceLanguage, setSourceLanguage] = useState('');
    const [targetLanguage, setTargetLanguage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!file || !sourceLanguage || !targetLanguage) return;
        const name = file.name.replace(/\.docx$/, '');
        setLoading(true);
        try {
            await onSubmit({ file, name, source_language: sourceLanguage, target_language: targetLanguage });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Translate Document</DialogTitle>
            <DialogContent>
                <input
                    accept=".docx"
                    type="file"
                    onChange={handleFileChange}
                    style={{ margin: '20px 0' }}
                />

                <TextField
                    select
                    label="Source Language"
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    fullWidth
                    margin="normal"
                >
                    {LANGUAGES.map((lang) => (
                        <MenuItem key={lang} value={lang}>
                            {lang}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    select
                    label="Target Language"
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    fullWidth
                    margin="normal"
                >
                    {LANGUAGES.map((lang) => (
                        <MenuItem key={lang} value={lang}>
                            {lang}
                        </MenuItem>
                    ))}
                </TextField>
            </DialogContent>

            <DialogActions>
                {loading && <CircularProgress size={20} />}
                <Button onClick={onClose} color="secondary" disabled={loading}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" color="primary" disabled={loading || !file}>
                    Submit
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default TranslateDocumentDialog;
