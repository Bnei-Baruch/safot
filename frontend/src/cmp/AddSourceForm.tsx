// Currently not used, for future usage.

import React, { useState } from 'react';
import { TextField, MenuItem, Autocomplete, Chip } from '@mui/material';

interface AddSourceFormProps {
    onSubmit: (data: {
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
    }) => void;
    mode: 'new_source' | 'translation';
}

const labelOptions = [
    'Kabbalah',
    'Spirituality',
    'Torah',
    'Zohar',
    'Sefirot',
    'Creation',
    'Ten Sefirot',
    'Unity',
    'Inner Work',
    'Correction',
    'Faith Above Reason',
    'Rabash',
    'Baal HaSulam',
    'Prayer',
    'The Creator',
    'Human Connection',
    'Women',
    'Science',
    'Economics',
];

enum SourceType {
    BOOK = "Book",
    CHAPTER = "Chapter",
    ARTICLE = "Article",
}


const AddSourceForm: React.FC<AddSourceFormProps> = ({ onSubmit, mode }) => {
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [labels, setLabels] = useState<string[]>([]);
    const [language, setLanguage] = useState('');
    const [type, setType] = useState<SourceType | "">("");
    const [order, setOrder] = useState<number | null>(null);
    const [properties, setProperties] = useState({
        category: '',
        description: '',
        audience: '',
    });

    const languages = [
        { label: 'Hebrew', code: 'he' },
        { label: 'English', code: 'en' },
        { label: 'Spanish', code: 'es' },
        { label: 'Russian', code: 'ru' },
        { label: 'French', code: 'fr' },
        { label: 'Arabic', code: 'ar' }
    ];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const processedFile: File | undefined = file ?? undefined;
        console.log('Data prepared in AddSourceForm:', {
            file: mode === 'new_source' ? processedFile : undefined,
            name,
            labels,
            language,
            type,
            order,
            properties,
        });
        if (mode === 'new_source' && !file) {
            alert('Please upload a file');
            return;
        }

        onSubmit({
            file: mode === 'new_source' ? processedFile : undefined,
            name,
            labels,
            language,
            type: type as SourceType,
            order,
            properties,
        });
    };

    return (
        <form id="add-source-form" onSubmit={handleSubmit}>
            {mode === 'new_source' && (
                <input
                    type="file"
                    onChange={handleFileChange}
                    style={{ display: 'block', marginBottom: '16px' }}
                    required
                />
            )}
            <TextField
                label="Name"
                placeholder="e.g., The Art of Teaching"
                helperText="Enter the name of the book or text you are uploading."
                fullWidth
                margin="normal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
            />
            <Autocomplete
                multiple
                freeSolo
                options={labelOptions}
                value={labels}
                onChange={(event, newValue) => setLabels(newValue)}
                renderTags={(value: string[], getTagProps) =>
                    value.map((option, index) => {
                        const { key, ...tagProps } = getTagProps({ index });
                        return (
                            <Chip
                                key={key}
                                variant="outlined"
                                label={option}
                                {...tagProps}
                            />
                        );
                    })
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Labels"
                        placeholder="Add labels (e.g., Kabbalah, Spirituality)"
                        helperText="Select labels related to the Kabbalah book or add custom ones."
                        fullWidth
                        margin="normal"
                    />
                )}
            />
            <TextField
                select
                label="Language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                fullWidth
                margin="normal"
                helperText="Select language."
                required
            >
                {languages.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                        {lang.label}
                    </MenuItem>
                ))}
            </TextField>
            <TextField
                select
                label="Type"
                value={type}
                // onChange={(e) => setType(e.target.value)}
                onChange={(e) => setType(e.target.value as SourceType)}
                placeholder="e.g., Book, Chapter, Article"
                // helperText="Enter the type of the text."
                fullWidth
                margin="normal"
                required
            >
                {Object.values(SourceType).map((source) => (
                    <MenuItem key={source} value={source}>
                        {source}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                label="Order"
                placeholder="e.g., 1, 2, 3"
                helperText="If the text is part of a sequence, specify its order. Leave empty if not applicable."
                fullWidth
                margin="normal"
                value={order ?? ''}
                onChange={(e) => setOrder(e.target.value ? parseInt(e.target.value) : null)}
            />
            <TextField
                label="Category"
                placeholder="e.g., Philosophy, Education"
                helperText="Enter the general category of the book or text."
                fullWidth
                margin="normal"
                value={properties.category}
                onChange={(e) => setProperties((prev) => ({ ...prev, category: e.target.value }))}
            />
            <TextField
                label="Description"
                placeholder="e.g., This book explores the philosophy of education and its practical application."
                helperText="Provide a short description of the book or text."
                fullWidth
                margin="normal"
                value={properties.description}
                onChange={(e) => setProperties((prev) => ({ ...prev, description: e.target.value }))}
            />
            <TextField
                label="Audience"
                placeholder="e.g., Beginners, Advanced Students, Teachers"
                helperText="Specify the intended audience for this text."
                fullWidth
                margin="normal"
                value={properties.audience}
                onChange={(e) => setProperties((prev) => ({ ...prev, audience: e.target.value }))}
            />
        </form>
    );
};

export default AddSourceForm;
