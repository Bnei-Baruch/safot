import React, { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/store';
import { deleteSource } from '../store/SourceSlice';
import { SourcePair } from '../types/frontend-types';
import { LANGUAGES } from '../constants/languages';
import { exportTranslationDocx } from '../services/segment.service';
import { extractUsername, formatShortDateTime } from './Utils';

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
type SortField =
  'translatedName' |
  'originalName' |
  'username' |
  'created_at' |
  'modified_by' |
  'modified_at' |
  'originalLanguage' |
  'translatedLanguage' |
  'progress';

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

const PREFERRED_ORDER = 'preffered_order';
const PREFERRED_DIRECTION = 'preffered_direction';

const SourceTable: React.FC<SourceTableProps> = ({ pairs }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [sortField, setSortField] = useState<SortField>(localStorage.getItem(PREFERRED_ORDER) as SortField || 'modified_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>(localStorage.getItem(PREFERRED_DIRECTION) as SortDirection || 'asc');

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      const dir = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(dir);
      localStorage.setItem(PREFERRED_DIRECTION, dir);
    } else {
      setSortField(field);
      localStorage.setItem(PREFERRED_ORDER, field);
      setSortDirection('asc');
      localStorage.setItem(PREFERRED_DIRECTION, 'asc');
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
      case 'modified_by':
        return direction * extractUsername(a.original.modified_by).localeCompare(extractUsername(b.original.modified_by));
      case 'originalLanguage':
        return direction * a.original.language.localeCompare(b.original.language);
      case 'translatedLanguage':
        if (!a.translated && !b.translated) return 0;
        if (!a.translated) return 1;
        if (!b.translated) return -1;
        return direction * a.translated.language.localeCompare(b.translated.language);
      case 'created_at':
        return direction * ((a.translated.created_at_epoch || 0) - (b.translated.created_at_epoch || 0));
      case 'modified_at':
        return direction * ((a.translated.modified_at_epoch || 0) - (b.translated.modified_at_epoch || 0));
      case 'progress':
        return direction * ((a.translated.count || 0) / (a.original.count || 1) - (b.translated.count || 0) / (b.original.count || 1));
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
            <TableCell sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <SortableHeader field="originalName" label="Source" />
            </TableCell>
            <TableCell>
              <SortableHeader field="originalLanguage" label="From" />
            </TableCell>
            <TableCell sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <SortableHeader field="translatedName" label="Trnslation" />
            </TableCell>
            <TableCell>
              <SortableHeader field="translatedLanguage" label="To" />
            </TableCell>
            <TableCell>
              <SortableHeader field="username" label="Created By" />
            </TableCell>
            <TableCell>
              <SortableHeader field="created_at" label="Created At" />
            </TableCell>
            <TableCell>
              <SortableHeader field="modified_by" label="Last Modified By" />
            </TableCell>
            <TableCell>
              <SortableHeader field="modified_at" label="Last Modified At" />
            </TableCell>
            <TableCell>
              <SortableHeader field="progress" label="Progress" />
            </TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedPairs.map(({ original, translated }) => (
            <TableRow key={translated.id}>
              <TableCell sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {original.name}
              </TableCell>
              <TableCell>{renderLang(original.language)}</TableCell>
              <TableCell sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {translated.name}
               </TableCell>
              <TableCell>{translated ? renderLang(translated.language) : '-'}</TableCell>
              <TableCell>{extractUsername(translated.username)}</TableCell>
              <TableCell>{formatShortDateTime(translated.created_at_epoch || 0)}</TableCell>
              <TableCell>{extractUsername(translated.modified_by)}</TableCell>
              <TableCell>{formatShortDateTime(translated.modified_at_epoch || 0)}</TableCell>
              <TableCell>{translated.count || 0} / {original.count}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {translated && (
                  <IconButton color="primary" onClick={() => navigate(`/source-edit/${translated.id}`)}>
                    <EditIcon />
                  </IconButton>
                )}
                <Button disabled={!translated} onClick={() =>
                    translated && docx(translated.id, translated.name, translated.language)}>
                  DOCX
                </Button>
                <IconButton sx={{ color: 'lightgray' }} disabled={!translated} onClick={() =>
                    translated && window.confirm(`Are you sure you want to delete ${translated.name}`) && dispatch(deleteSource(translated.id))}>
                  <DeleteIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default SourceTable;
