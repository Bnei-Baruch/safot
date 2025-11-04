import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    CircularProgress,
    MenuItem,
    Checkbox,
    FormControlLabel,
    Radio,
    RadioGroup,
    FormControl,
    FormLabel,
    Typography,
    Box,
    List,
    ListItem,
    ListItemText,
    IconButton,
} from '@mui/material';
import {
    ArrowDropDown,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { LANGUAGES } from '../constants/languages';
import { useToast } from './Toast';
import { useFlow } from '../useFlow';
import { extractParagraphs, postSegments, buildSegment } from '../services/segment.service';
import { postSource } from '../services/source.service';

interface TranslateDocumentDialogProps {
    open: boolean;
    onClose: () => void;
    allowMultiSource?: boolean;
}

const TranslateDocumentDialog: React.FC<TranslateDocumentDialogProps> = ({ 
    open, 
    onClose, 
    allowMultiSource = false 
}) => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { translateMultiSource, loadingCount } = useFlow();
    
    const [multiSourceMode, setMultiSourceMode] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [sourceLanguage, setSourceLanguage] = useState('');
    const [targetLanguage, setTargetLanguage] = useState('');
    const [originFileIndex, setOriginFileIndex] = useState<number | null>(null);
    const [stepByStep, setStepByStep] = useState<boolean>(true);
    const [createdSourceIds, setCreatedSourceIds] = useState<number[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).filter(file => 
                file.name.toLowerCase().endsWith('.docx')
            );
            
            if (multiSourceMode) {
                setFiles(prev => [...prev, ...newFiles]);
                if (originFileIndex === null && newFiles.length > 0) {
                    setOriginFileIndex(files.length); // Set first file as origin
                }
            } else {
                setFiles(newFiles.slice(0, 1)); // Single file mode
                setOriginFileIndex(0);
            }
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => {
            const newFiles = prev.filter((_, i) => i !== index);
            if (originFileIndex === index) {
                setOriginFileIndex(newFiles.length > 0 ? 0 : null);
            } else if (originFileIndex !== null && originFileIndex > index) {
                setOriginFileIndex(originFileIndex - 1);
            }
            return newFiles;
        });
        // Remove corresponding source ID if created
        setCreatedSourceIds(prev => prev.filter((_, i) => i !== index));
    };

    const normalizeName = (filename: string) => 
        filename.replace(/\.docx$/i, '').trim().replace(/\s+/g, '-');

    const createSourceFromFile = async (file: File, language: string): Promise<number> => {
        const name = normalizeName(file.name);
        const source = await postSource({
            name: name,
            language: language,
        });
        return source.id;
    };

    const processFilesAndCreateSources = async (): Promise<{
        originSourceId: number;
        nonOriginSourceIds: number[];
        translatedSourceId: number;
    }> => {
        if (files.length === 0 || originFileIndex === null) {
            throw new Error('No files selected or origin not selected');
        }

        const sourceIds: number[] = [];
        
        // Create sources for all files
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const sourceLang = multiSourceMode && i === originFileIndex 
                ? sourceLanguage 
                : sourceLanguage; // All files use source language initially
            
            const sourceId = await createSourceFromFile(file, sourceLang);
            sourceIds.push(sourceId);
            
            // Extract and store segments
            const { paragraphs, properties } = await extractParagraphs(file);
            const segments = paragraphs.map((text, index) => buildSegment({
                text,
                source_id: sourceId,
                order: index + 1,
                properties,
            }));
            await postSegments(segments);
        }

        setCreatedSourceIds(sourceIds);

        const originSourceId = sourceIds[originFileIndex];
        const nonOriginSourceIds = sourceIds.filter((_, i) => i !== originFileIndex);
        
        // Create translated source
        const originFile = files[originFileIndex];
        const baseName = normalizeName(originFile.name);
        const translatedSource = await postSource({
            name: `${baseName}-${targetLanguage}`,
            language: targetLanguage,
            original_source_id: originSourceId,
        });

        return {
            originSourceId,
            nonOriginSourceIds,
            translatedSourceId: translatedSource.id,
        };
    };

    const handleTranslate = async () => {
        if (!sourceLanguage || !targetLanguage) {
            showToast('Please select both source and target languages', 'error');
            return;
        }

        if (files.length === 0) {
            showToast('Please select at least one file', 'error');
            return;
        }

        if (multiSourceMode && originFileIndex === null) {
            showToast('Please select an origin source', 'error');
            return;
        }

        try {
            showToast('Processing files...', 'info');
            
            if (multiSourceMode) {
                // Multi-source translation
                const { originSourceId, nonOriginSourceIds, translatedSourceId } = 
                    await processFilesAndCreateSources();
                
                const { translatedSourceId: finalTranslatedId } = await translateMultiSource(
                    originSourceId,
                    nonOriginSourceIds,
                    translatedSourceId,
                    sourceLanguage,
                    targetLanguage,
                    stepByStep
                );
                
                showToast('Multi-source translation completed', 'success');
                navigate(`/source-edit/${finalTranslatedId}`);
            } else {
                // Single file translation (regular flow)
                // This would use translateFile, but for now we'll just show a message
                showToast('Single file translation not implemented in this dialog', 'info');
            }
            
            handleClose();
        } catch (error) {
            console.error('Translation error:', error);
            if (error instanceof Error) {
                showToast('Error: ' + error.message, 'error');
            } else {
                showToast('Translation failed', 'error');
            }
        }
    };

    const handleClose = () => {
        setFiles([]);
        setOriginFileIndex(null);
        setSourceLanguage('');
        setTargetLanguage('');
        setMultiSourceMode(false);
        setStepByStep(true);
        setCreatedSourceIds([]);
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
            <DialogTitle>Translate Document</DialogTitle>
            <DialogContent>
                {allowMultiSource && (
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={multiSourceMode}
                                onChange={(e) => {
                                    setMultiSourceMode(e.target.checked);
                                    if (!e.target.checked) {
                                        // Reset to single file mode
                                        if (files.length > 1) {
                                            setFiles([files[0] || []]);
                                        }
                                        setOriginFileIndex(0);
                                    }
                                }}
                                disabled={!!loadingCount}
                            />
                        }
                        label="Use multiple reference sources"
                    />
                )}

                <Box sx={{ mb: 2 }}>
                    <input
                        accept=".docx"
                        type="file"
                        multiple={multiSourceMode}
                        onChange={handleFileChange}
                        style={{ margin: '10px 0' }}
                        disabled={!!loadingCount}
                    />
                    
                    {files.length > 0 && (
                        <List>
                            {files.map((file, index) => (
                                <ListItem
                                    key={index}
                                    secondaryAction={
                                        <IconButton
                                            edge="end"
                                            onClick={() => removeFile(index)}
                                            disabled={!!loadingCount}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    }
                                >
                                    <Radio
                                        checked={originFileIndex === index}
                                        onChange={() => setOriginFileIndex(index)}
                                        disabled={!!loadingCount || !multiSourceMode}
                                        sx={{ mr: 1 }}
                                    />
                                    <ListItemText
                                        primary={file.name}
                                        secondary={originFileIndex === index && multiSourceMode ? '(Origin source)' : ''}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>

                <TextField
                    select
                    label="Source Language"
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    fullWidth
                    margin="normal"
                    disabled={!!loadingCount}
                >
                    {LANGUAGES.map((lang) => (
                        <MenuItem key={lang.code} value={lang.code}>
                            {lang.label}
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
                    disabled={!!loadingCount}
                >
                    {LANGUAGES.map((lang) => (
                        <MenuItem key={lang.code} value={lang.code}>
                            {lang.label}
                        </MenuItem>
                    ))}
                </TextField>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                {loadingCount > 0 ? (
                    <>
                        <CircularProgress size={20} />
                        <Typography sx={{ ml: 2, fontFamily: 'inherit', color: '#444' }}>
                            Translating, please wait...
                        </Typography>
                    </>
                ) : (
                    <>
                        <Button onClick={handleClose} color="secondary" disabled={!!loadingCount}>
                            Cancel
                        </Button>
                        <Button
                            variant={stepByStep ? "contained" : "outlined"}
                            onClick={handleTranslate}
                            disabled={!!loadingCount || !sourceLanguage || !targetLanguage || files.length === 0}
                            sx={{ minWidth: 200, fontFamily: 'inherit' }}
                        >
                            <Typography sx={{ flexGrow: 1, textAlign: "center" }}>
                                {stepByStep ? "Translate" : "Translate ALL!"}
                            </Typography>
                            <ArrowDropDown
                                sx={{ ml: "auto" }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setStepByStep(!stepByStep);
                                }}
                            />
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default TranslateDocumentDialog;
