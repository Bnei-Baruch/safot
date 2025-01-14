import React, { useState } from 'react';
import { TextField, Button, MenuItem } from '@mui/material';

interface AddSourceFormProps {
    onSubmit: (data: {
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
    }) => void;
}

const AddSourceForm: React.FC<AddSourceFormProps> = ({ onSubmit }) => {
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [labels, setLabels] = useState<string[]>([]);
    const [language, setLanguage] = useState('');
    const [type, setType] = useState('');
    const [customType, setCustomType] = useState('');
    const [order, setOrder] = useState<number | null>(null);
    const [properties, setProperties] = useState({
        category: '',
        description: '',
        audience: '',
    });

    const predefinedTypes = ['Book', 'Chapter', 'Article', 'Transcript'];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedType = e.target.value;

        if (selectedType === 'Other') {
            setCustomType('');
            setType('');
        } else {
            setCustomType('');
            setType(selectedType);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Data prepared in AddSourceForm:', {
            file,
            name,
            labels,
            language,
            type: type || customType,
            order,
            properties,
        });
        if (!file) {
            alert('Please upload a file');
            return;
        }

        onSubmit({
            file,
            name,
            labels,
            language,
            type: type || customType,
            order,
            properties,
        });
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="file"
                onChange={handleFileChange}
                style={{ display: 'block', marginBottom: '16px' }}
                required
            />
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
            <TextField
                label="Labels (comma-separated)"
                placeholder="e.g., Education, Pedagogy, Child Development"
                helperText="Enter the main topics and subtopics related to the book. Separate topics with commas."
                fullWidth
                margin="normal"
                value={labels.join(',')}
                onChange={(e) => setLabels(e.target.value.split(','))}
            />
            <TextField
                label="Language"
                placeholder="e.g., English, Hebrew, Russian"
                helperText="Specify the language of the original text."
                fullWidth
                margin="normal"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                required
            />
            <TextField
                select
                label="Type"
                value={type || (customType ? 'Other' : '')}
                onChange={handleTypeChange}
                fullWidth
                margin="normal"
                helperText="Select the type of text. If not listed, choose 'Other' and provide a custom type."
            >
                {predefinedTypes.map((option) => (
                    <MenuItem key={option} value={option}>
                        {option}
                    </MenuItem>
                ))}
                <MenuItem value="Other">Other</MenuItem>
            </TextField>
            {type === '' && (
                <TextField
                    label="Custom Type"
                    placeholder="e.g., Presentation, Lecture"
                    fullWidth
                    margin="normal"
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    required
                />
            )}
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
            <Button type="submit" variant="contained" color="primary" style={{ marginTop: '16px' }}>
                Submit
            </Button>
        </form>
    );
};

export default AddSourceForm;
