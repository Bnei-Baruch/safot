import React, { useCallback, useEffect, useMemo, useState } from 'react';

import debounce from "lodash.debounce";
import {
  Box,
  Button,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';

import {
  CheckOutlined as CheckOutlinedIcon,
  CloseOutlined as CloseOutlinedIcon,
  EditOutlined as EditOutlinedIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

import { useAppDispatch, useAppSelector, RootState } from '../store/store';

import { useFlow } from '../useFlow';
import {
  addOrUpdateDictionary,
  addOrUpdateRule,
  fetchDictionaries,
  fetchPrompt,
  fetchRules,
} from '../store/DictionarySlice';
import {
  addOrUpdateSource,
} from '../store/SourceSlice';
import { Rule, Source } from '../types/frontend-types';

// We can make the right side panel to be also history for each segment...

type RuleNodeProps = {
  rule: Rule,
  isOpen: boolean,
  toggle: (id: number) => void,
  update: (rule: Rule) => void,
}

function RuleNode({rule, isOpen, toggle, update}: RuleNodeProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState<boolean>(false);
  const defaultPrompt = (rule && rule.properties && rule.properties['text']) || '';
  const [prompt, setPrompt] = useState<{text: string, cursor: number}>({text: defaultPrompt, cursor: defaultPrompt.length});

  const updatePrompt = useMemo(() => debounce((text: string, cursor: number) => {
    setPrompt({ text, cursor });
  }, 500), [setPrompt]);

  const updateRule = useCallback(() => {
    const updatedRule = {...rule, properties: { ...rule.properties, ['text']: prompt.text}};
    update(updatedRule);
  }, [rule, prompt, update]);

  return (
    <>
      <ListItemButton onClick={() => rule.id !== undefined && toggle(rule.id)}>
        <ListItemText primary={rule.name} />
        {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </ListItemButton>
      <Collapse in={isOpen} timeout="auto" unmountOnExit>
        <ListItem sx={{ position: "relative" }}>
          <IconButton
            sx={{ position: "absolute", top: editing ? -13 : 8, right: editing ? 30 : 13, zIndex: 10 }}
            size="small"
            onClick={() => {
              setEditing(!editing);
              setPrompt({text: defaultPrompt, cursor: defaultPrompt.length});
            }}
          >
            {!editing && <EditOutlinedIcon fontSize="small" />}
            {editing && <CloseOutlinedIcon fontSize="small" />}
          </IconButton>
          {editing && <IconButton
            sx={{ position: "absolute", top: -13, right: 63, zIndex: 10 }}
            size="small"
            disabled={prompt.text === defaultPrompt}
            onClick={updateRule}
          >
            <CheckOutlinedIcon fontSize="small" />
          </IconButton>}
          <ListItemButton sx={{ pl: 4 }}>
            {!editing && <Typography sx={{ whiteSpace: 'pre-line', textAlign: 'left' }}>
              {prompt.text}
            </Typography>}
            {editing && <TextField
              inputRef={ref}
              fullWidth
              multiline
              minRows={1}
              maxRows={8}
              defaultValue={prompt.text}
              onChange={(e) => updatePrompt(e.target.value, e.target.selectionStart || 0)}
              placeholder="Prompt text"
            />}
          </ListItemButton>
        </ListItem>
      </Collapse>
    </>
  );
}

const Dictionary: React.FC<{source: Source, sourceUpdated: (source: Source) => void}> = ({ source, sourceUpdated }) => {
  console.log('source', source);
  const dispatch = useAppDispatch();
  const {dictionary_id, dictionary_timestamp_epoch} = source;
  const {dictionaries, rules, loading, error} = useAppSelector((state: RootState) => state.dictionaries);
  const {createDefaultDict, loadingCount} = useFlow();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const anythingLoading = loading || !!loadingCount;

  useEffect(() => {
    if (dictionary_id && dictionary_timestamp_epoch) {
      dispatch(fetchPrompt({dictionary_id, dictionary_timestamp: dictionary_timestamp_epoch}));
      dispatch(fetchRules({dictionary_id, dictionary_timestamp: dictionary_timestamp_epoch}));
      dispatch(fetchDictionaries({dictionary_id, dictionary_timestamp: dictionary_timestamp_epoch}));
    }
  }, [dispatch, dictionary_id, dictionary_timestamp_epoch]);

  const dictionary = (dictionary_id && dictionaries[dictionary_id]) || null;
  console.log('Dictionary', dictionary);
  const dictionaryRules = (dictionary_id && rules[dictionary_id]) || null;
  console.log('Rules', dictionaryRules);

  const updateRule = useCallback(async (rule: Rule) => {
    try {
      if (!rule || !dictionary || !source) {
        return;
      }
      // Clear username, timestamp, modified_by and modified_at to
      // allow backend to fill them properly.
      const updatedRule = await dispatch(addOrUpdateRule({
        ...rule,
        username: undefined,
        timestamp: undefined,
      })).unwrap();
      const updatedDictionary = await dispatch(addOrUpdateDictionary({
        ...dictionary,
        username: undefined,
        timestamp: updatedRule.modified_at_epoch,
      })).unwrap();
      const updatedSource = await dispatch(addOrUpdateSource({
        ...source,
        modified_by: undefined,
        modified_at: undefined,
        dictionary_timestamp: updatedRule.modified_at_epoch,
      })).unwrap();
      console.log(updatedRule, updatedDictionary, updatedSource);
    } catch (err) {
      console.error('Failed updating rule.');
    }
  }, [dispatch, dictionary, source]);

  return (<Box>
    {(!dictionary_id || !dictionary_timestamp_epoch) &&
      <Box>
        <Typography>Default dictionary was used</Typography>
        <Button onClick={async () => {
          const updatedSource = await createDefaultDict(source);
          if (updatedSource) {
            sourceUpdated(updatedSource);
          }
        }}>Create Cutsom Dictionary</Button>
      </Box>
    }
    {error && <Typography>{error}</Typography>}
    {anythingLoading && <Typography>Loading...</Typography>}
    {dictionary &&
      <Typography variant="h5" component="h5" gutterBottom>
        {dictionary.name}
      </Typography>
    }
    {dictionaryRules &&
      <List disablePadding>
        {dictionaryRules.map((rule) =>
          <RuleNode
            key={rule.id}
            rule={rule}
            isOpen={rule.id ? open[rule.id] : false}
            toggle={(id: number) => setOpen({...open, [id]: !open[id]})}
            update={(rule: Rule) => updateRule(rule)} />
        )}
      </List>
    }
  </Box>);
};

export default Dictionary;
