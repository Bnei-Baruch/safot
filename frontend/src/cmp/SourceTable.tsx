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
  Box,
  Typography,
  TableSortLabel,
  Tooltip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/store';
import { deleteSource } from '../store/SourceSlice';
import { SourcePair } from '../types/frontend-types';
import { LANGUAGES } from '../constants/languages';
import { exportTranslationDocx } from '../services/segment.service';

const renderLang = (code: string) => {
  const lang = LANGUAGES.find(l => l.code === code);
  if (!lang) return code;
  return (
    <Typography variant="body2">{lang.label}</Typography>
  );
};

interface SourceTableProps {
  pairs: SourcePair[];
}

type SortDirection = 'asc' | 'desc';
type SortField = 'translatedName' | 'originalName' | 'username' | 'originalLanguage' | 'translatedLanguage';

const docx = async (sourceId: number, name: string, language: string) => {
  try {
    const blob = await exportTranslationDocx(sourceId);
    if (!(blob instanceof Blob)) {
      throw new Error("Response is not a valid Blob");
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}_${language}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (error) {
    console.error("Error exporting document:", error);
  }
};

const SourceTable: React.FC<SourceTableProps> = ({ pairs }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [sortField, setSortField] = useState<SortField>('translatedName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const extractUsername = (email: string) => {
    return email.split('@')[0];
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedPairs = [...pairs].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortField) {
      case 'originalName':
        return direction * a.original.name.localeCompare(b.original.name);
      case 'translatedName':
        return direction * a.original.name.localeCompare(b.original.name);
      case 'username':
        return direction * extractUsername(a.original.username).localeCompare(extractUsername(b.original.username));
      case 'originalLanguage':
        return direction * a.original.language.localeCompare(b.original.language);
      case 'translatedLanguage':
        if (!a.translated && !b.translated) return 0;
        if (!a.translated) return 1;
        if (!b.translated) return -1;
        return direction * a.translated.language.localeCompare(b.translated.language);
      default:
        return 0;
    }
  });

  if (!pairs.length) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: '#888' }}>
        <Typography variant="h6">No results match your filter.</Typography>
      </Box>
    );
  }

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => {
    const isActive = sortField === field;
    const direction = isActive ? sortDirection : 'asc';
  
    return (
      <Tooltip title="Click to sort" placement="top">
        <TableSortLabel
          active={isActive}
          direction={direction}
          onClick={() => handleSort(field)}
          sx={{
            '&:hover': {
              color: 'primary.main',
              cursor: 'pointer'
            }
          }}
        >
          {label}
        </TableSortLabel>
      </Tooltip>
    );
  };

  return (
    <TableContainer component={Paper} sx={{ margin: "auto", width: "100%" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <SortableHeader field="originalName" label="Source" />
            </TableCell>
            <TableCell>
              <SortableHeader field="originalLanguage" label="From" />
            </TableCell>
            <TableCell sx={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <SortableHeader field="translatedName" label="Trnslation" />
            </TableCell>
            <TableCell>
              <SortableHeader field="translatedLanguage" label="To" />
            </TableCell>
            <TableCell>
              <SortableHeader field="username" label="Upload By" />
            </TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedPairs.map(({ original, translated }) => (
            <TableRow key={translated.id}>
              <TableCell sx={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {original.name}
              </TableCell>
              <TableCell>{renderLang(original.language)}</TableCell>
              <TableCell sx={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {translated.name}
               </TableCell>
              <TableCell>{translated ? renderLang(translated.language) : '-'}</TableCell>
              <TableCell>{extractUsername(translated.username)}</TableCell>
             
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
                <Button disabled={!translated} onClick={() =>
                    translated && window.confirm(`Are you sure you want to delete ${translated.name}`) && dispatch(deleteSource(translated.id))}>Delete</Button>
                <Button disabled={!translated} onClick={() =>
                    translated && docx(translated.id, translated.name, translated.language)}>DOCX</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default SourceTable;
