import React from 'react';
import {
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
    Button,
    TableContainer
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Source, SourcePair } from '../types';


interface SourceTableProps {
    pairs: SourcePair[];
}

const SourceTable: React.FC<SourceTableProps> = ({ pairs }) => {
    const navigate = useNavigate();

    return (
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
                                <Button disabled>Delete</Button>
                                <Button disabled>Download</Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default SourceTable;
