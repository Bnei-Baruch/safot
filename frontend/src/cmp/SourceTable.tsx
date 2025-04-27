import React from 'react';
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Button,
  TableContainer,
  Box,
  Avatar,
  Typography
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useNavigate } from 'react-router-dom';
import { SourcePair } from '../types/frontend-types';

const languageMap: Record<string, { name: string; flag: string }> = {
  en: { name: 'English', flag: '/flags/en.png' },
  fr: { name: 'French', flag: '/flags/fr.png' },
  he: { name: 'Hebrew', flag: '/flags/he.png' },
  ar: { name: 'Arabic', flag: '/flags/ar.png' },
  es: { name: 'Spanish', flag: '/flags/es.png' },
  ru: { name: 'Russian', flag: '/flags/ru.png' },
};

interface SourceTableProps {
  pairs: SourcePair[];
}

const SourceTable: React.FC<SourceTableProps> = ({ pairs }) => {
  const navigate = useNavigate();

  const renderLang = (code: string) => {
    const lang = languageMap[code];
    if (!lang) return code;
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Avatar src={lang.flag} sx={{ width: 20, height: 20 }} />
        <Typography variant="body2">{lang.name}</Typography>
      </Box>
    );
  };

  const extractUsername = (email: string) => {
    return email.split('@')[0];
  };

  if (!pairs.length) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: '#888' }}>
        <Typography variant="h6">No results match your filter.</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ margin: "auto", width: "100%", mt: 4 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Upload By</TableCell>
            <TableCell>From</TableCell>
            <TableCell>To</TableCell>
            
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pairs.map(({ original, translated }) => (
            <TableRow key={original.id}>
              <TableCell>{original.name}</TableCell>
              <TableCell>{extractUsername(original.username)}</TableCell>
              <TableCell>{renderLang(original.language)}</TableCell>
              <TableCell>{translated ? renderLang(translated.language) : '-'}</TableCell>
             
              <TableCell>
              {translated && (
                    <Button
                    variant="outlined"
                    onClick={() => navigate(`/source-edit/${translated.id}`)}
                    startIcon={<EditIcon />}
                  >
                    Edit
                  </Button>
                )}
                {/* <Button disabled>Delete</Button>
                <Button disabled>Download</Button> */}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default SourceTable;
