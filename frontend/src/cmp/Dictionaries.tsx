import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
	Container,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogContentText,
  DialogActions,
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

import { useAppDispatch, useAppSelector, RootState } from '../store/store';
import { extractUsername, formatShortDateTime } from './Utils';
import { fetchPrompt, fetchDictionaries } from '../store/DictionarySlice';

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
  const [sortField, setSortField] = useState<SortField>(localStorage.getItem(PREFERRED_ORDER) as SortField || 'modified_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>(localStorage.getItem(PREFERRED_DIRECTION) as SortDirection || 'asc');
	const [promptDictionaryId, setPromptDictionaryId] = useState<number | undefined>(undefined);
  const {dictionaries, prompts, loading, error} = useAppSelector((state: RootState) => state.dictionaries);

  useEffect(() => {
    dispatch(fetchDictionaries());
  }, [dispatch]);

  useEffect(() => {
    if (promptDictionaryId) {
      dispatch(fetchPrompt({dictionary_id: promptDictionaryId}));
    }
  }, [dispatch, promptDictionaryId]);

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

  const sorted = useMemo(() => Object.values(dictionaries).sort((a, b) => {
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
        throw "Not Implemented";
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
    <Container maxWidth="xl">
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
										<Button onClick={async () => setPromptDictionaryId(dictionary.id)}>
											PROMPT
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			}
			<Dialog
        open={!!promptDictionaryId}
        onClose={() => setPromptDictionaryId(undefined)}
        aria-labelledby="Prompt"
      >
        <DialogTitle>Prompt for {promptDictionaryId && dictionaries[promptDictionaryId].name}</DialogTitle>

        <DialogContent>
					<Typography sx={{ whiteSpace: 'pre-line' }}>
						{promptDictionaryId && prompts[promptDictionaryId]}
					</Typography>
        </DialogContent>

        <DialogActions>
          <Button variant="contained" autoFocus
						onClick={() => setPromptDictionaryId(undefined)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Dictionaries;

