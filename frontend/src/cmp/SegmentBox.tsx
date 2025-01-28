import React, { useState } from 'react';
import { Box, TextField } from "@mui/material";
import { Segment } from '../SegmentSlice';

interface SegmentBoxProps {
    segment: Segment;
}

const SegmentBox: React.FC<SegmentBoxProps> = ({ segment }) => {
    const [value, setValue] = useState<string>(segment.text);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value);
    };

    const timestamp = new Date(segment.timestamp);

    return (
        <Box
            sx={{
                margin: "0.3em",
            }}
        >
            <TextField
                label={`#${segment.order + 1} ${segment.username} ${timestamp}`}
                multiline
                rows={4}
                variant="outlined"
                value={value}
                onChange={handleChange}
                fullWidth
            />
        </Box>
    )
}

export default SegmentBox;
