import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  DialogActions,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import {
  Edit as EditIcon,
  TextSnippet as TextSnippetIcon,
} from '@mui/icons-material';

import { useAppDispatch, useAppSelector, RootState } from '../store/store';
import { extractUsername, formatShortDateTime } from './Utils';
import {
  fetchPrompt,
  fetchDictionaries,
  getLatestDictionary,
  getLatestDictionaries,
  createPromptDictionary,
} from '../store/DictionarySlice';
import { Dictionary as DictionaryType } from '../types/frontend-types';
import Dictionary from './Dictionary';
import LanguageSelector from './LanguageSelector';
import { useToast } from './Toast';
import { DEFAULT_PROMPT_KEY } from '../constants/prompts';

const PREFERRED_ORDER = 'dictionaries_preffered_order';
const PREFERRED_DIRECTION = 'dictionaries_preffered_direction';

type SortDirection = 'asc' | 'desc';
type SortField =
  'id' |
  'created_by' |
  'created_at' |
  'modified_by' |
  'modified_at' |
  'name' |
  'labels';

const Dictionaries: React.FC = () => {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const [sortField, setSortField] = useState<SortField>(localStorage.getItem(PREFERRED_ORDER) as SortField || 'modified_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>(localStorage.getItem(PREFERRED_DIRECTION) as SortDirection || 'asc');
  const [promptDictionary, setPromptDictionary] = useState<DictionaryType | undefined>(undefined);
  const [editDictionaryId, setEditDictionaryId] = useState<number | undefined>(undefined);
  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [dictionaryName, setDictionaryName] = useState<string>('');
  const [sourceLang, setSourceLang] = useState<string>('');
  const [targetLang, setTargetLang] = useState<string>('');
  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);
  const {dictionaries, prompts, loading, error} = useAppSelector((state: RootState) => state.dictionaries);
  const editDictionaryTimestamp = dictionaries && editDictionaryId ? getLatestDictionary(dictionaries, editDictionaryId)?.timestamp_epoch : undefined;

  useEffect(() => {
    dispatch(fetchDictionaries());
  }, [dispatch]);

  useEffect(() => {
    if (promptDictionary && promptDictionary.id && promptDictionary.timestamp_epoch) {
      dispatch(fetchPrompt({dictionary_id: promptDictionary.id, dictionary_timestamp: promptDictionary.timestamp_epoch}));
    }
  }, [dispatch, promptDictionary]);

  const handleSort = useCallback((field: SortField) => {
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
  }, [sortField, setSortField, sortDirection, setSortDirection]);

  const handleCloseCreateDialog = useCallback(() => {
    setCreateDialogOpen(false);
    setDictionaryName('');
    setSourceLang('');
    setTargetLang('');
    setSubmitAttempted(false);
  }, []);

  const handleCreateDictionary = useCallback(async () => {
    setSubmitAttempted(true);
    if (!dictionaryName.trim() || !sourceLang || !targetLang) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    setSubmitAttempted(false);

    try {
      await dispatch(createPromptDictionary({
        name: dictionaryName.trim(),
        prompt_key: DEFAULT_PROMPT_KEY,
        original_language: sourceLang,
        translated_language: targetLang,
      })).unwrap();
      showToast('Dictionary created successfully', 'success');
      dispatch(fetchDictionaries());
    } catch (error) {
      showToast('Failed to create dictionary', 'error');
    }

    handleCloseCreateDialog();
  }, [dispatch, dictionaryName, sourceLang, targetLang, showToast, handleCloseCreateDialog]);

  // Get only the latest version of each dictionary for display
  const sorted = useMemo(() => getLatestDictionaries(dictionaries).sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortField) {
      case 'id':
        return direction * ((a.id || 0) - (b.id || 0));
      case 'name':
        return direction * a.name.localeCompare(b.name);
      case 'created_by':
        return direction * extractUsername(a.created_by).localeCompare(extractUsername(b.created_by));
      case 'created_at':
        return direction * ((a.created_at_epoch || 0) - (b.created_at_epoch || 0));
      case 'modified_by':
        return direction * extractUsername(a.modified_by).localeCompare(extractUsername(b.created_by));
      case 'modified_at':
        return direction * ((a.modified_at_epoch || 0) - (b.modified_at_epoch || 0));
      case 'labels':
        throw new Error("Not Implemented");
      default:
        return 0;
    }
  }), [dictionaries, sortField, sortDirection]);

  const SortableHeader = useCallback(({ field, label }: { field: SortField; label: string }) => {
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
  }, [sortField, sortDirection, handleSort]);

  return (
    <Container maxWidth="xl" sx={{ position: 'relative' }}>
      <Tooltip title="Create Dictionary">
        <Button
          color="primary"
          onClick={() => setCreateDialogOpen(true)}
          sx={{ mb: 2, position: 'absolute', top: -40, right: 5 }}
        >
          Create Dictionary
        </Button>
      </Tooltip>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography color="error">Error: {error}</Typography>}
      {!loading && !error && (!sorted || !sorted.length) && <Typography variant="h6">No results</Typography>}
      {sorted.length && !loading && !error &&
        <TableContainer component={Paper} sx={{ margin: "auto", width: "100%" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <SortableHeader field="id" label="#" />
                </TableCell>
                <TableCell sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <SortableHeader field="name" label="Dictionary" />
                </TableCell>
                <TableCell>
                  <SortableHeader field="created_by" label="Created By" />
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
                  <SortableHeader field="labels" label="Labels" />
                </TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((dictionary) => (
                <TableRow key={dictionary.id}>
                  <TableCell>{dictionary.id}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {dictionary.name}
                  </TableCell>
                  <TableCell>{extractUsername(dictionary.created_by)}</TableCell>
                  <TableCell>{formatShortDateTime(dictionary.created_at_epoch || 0)}</TableCell>
                  <TableCell>{extractUsername(dictionary.modified_by)}</TableCell>
                  <TableCell>{formatShortDateTime(dictionary.modified_at_epoch || 0)}</TableCell>
                  <TableCell>{(dictionary.labels || []).join(',')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <IconButton color="primary" onClick={() => setEditDictionaryId(dictionary.id)}>
                      <EditIcon />
                    </IconButton>
                    <Tooltip title="Show Prompt">
                      <IconButton color="primary" onClick={() => setPromptDictionary(dictionary)}>
                        <TextSnippetIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      }
      <Dialog
        open={!!editDictionaryId}
        onClose={() => setEditDictionaryId(undefined)}
        aria-labelledby="Edit"
      >
        <DialogContent>
          {editDictionaryId && editDictionaryTimestamp && <Dictionary
            dictionary_id={editDictionaryId}
            dictionary_timestamp_epoch={editDictionaryTimestamp}
            dictionaryUpdated={async (newDictionaryTimestampEpoch) => {
              dispatch(fetchPrompt({dictionary_id: editDictionaryId}));
            }}
          />}
        </DialogContent>

        <DialogActions>
          <Button variant="contained" autoFocus
            onClick={() => setEditDictionaryId(undefined)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!promptDictionary}
        onClose={() => setPromptDictionary(undefined)}
        aria-labelledby="Prompt"
      >
        <DialogTitle>
          Prompt for {promptDictionary?.name}
        </DialogTitle>

        <DialogContent>
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {promptDictionary && promptDictionary.id && promptDictionary.timestamp_epoch &&
             prompts[promptDictionary.id]?.[promptDictionary.timestamp_epoch]}
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button variant="contained" autoFocus
            onClick={() => setPromptDictionary(undefined)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        aria-labelledby="Create Dictionary"
      >
        <DialogTitle>Create New Dictionary</DialogTitle>

        <DialogContent sx={{ 'padding-top': '10px !important' }}>
          <TextField
            label="Dictionary Name"
            value={dictionaryName}
            onChange={(e) => setDictionaryName(e.target.value)}
            variant="outlined"
            error={submitAttempted && !dictionaryName.trim()}
            helperText={submitAttempted && !dictionaryName.trim() ? 'Required' : ' '}
            disabled={loading}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          />
          <LanguageSelector
            sourceLang={sourceLang}
            targetLang={targetLang}
            onSourceLangChange={setSourceLang}
            onTargetLangChange={setTargetLang}
            submitAttempted={submitAttempted}
            disabled={loading}
            size="small"
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateDictionary}
            disabled={loading}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Dictionaries;

