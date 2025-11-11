import React, { useCallback, useEffect, useMemo, useState } from 'react';

import debounce from "lodash.debounce";
import {
  Box,
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
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { useAppDispatch, useAppSelector, RootState } from '../store/store';

import {
  addOrUpdateDictionary,
  addOrUpdateRule,
  fetchDictionaries,
  fetchPrompt,
  fetchRules,
} from '../store/DictionarySlice';
import { Rule } from '../types/frontend-types';
import { formatShortDateTime } from './Utils';

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
    const updatedRule = {...rule, properties: { ...rule.properties, 'text': prompt.text}};
    update(updatedRule);
    setEditing(false);
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

const Dictionary: React.FC<{
  dictionary_id: number,
  dictionary_timestamp_epoch: number,
  dictionaryUpdated: (new_dictionary_timestamp: string) => void,
  refresh?: () => void
}> = ({ dictionary_id, dictionary_timestamp_epoch, dictionaryUpdated, refresh }) => {
  const dispatch = useAppDispatch();
  const {dictionaries, rules, loading, error} = useAppSelector((state: RootState) => state.dictionaries);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [titleEditing, setTitleEditing] = useState<string>('');

  useEffect(() => {
    if (dictionary_id && dictionary_timestamp_epoch) {
      dispatch(fetchPrompt({dictionary_id, dictionary_timestamp: dictionary_timestamp_epoch}));
      dispatch(fetchRules({dictionary_id, dictionary_timestamp: dictionary_timestamp_epoch}));
      dispatch(fetchDictionaries({dictionary_id, dictionary_timestamp: dictionary_timestamp_epoch}));
    }
  }, [dispatch, dictionary_id, dictionary_timestamp_epoch]);

  const dictionary = (dictionary_id && dictionaries[dictionary_id]) || null;
  const dictionaryRules = (dictionary_id && rules[dictionary_id]) || null;

  const updateRule = useCallback(async (rule: Rule) => {
    try {
      if (!rule || !dictionary) {
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
        timestamp: updatedRule.timestamp,
      })).unwrap();
      if (updatedRule.timestamp) {
        dictionaryUpdated(updatedRule.timestamp);
      } else {
        console.error('Expected updated rule timestamp.');
      }
      console.log(updatedRule, updatedDictionary);
    } catch (err) {
      console.error('Failed updating rule.');
    }
  }, [dispatch, dictionary, dictionaryUpdated]);

  return (<Box>
    {error && <Typography>{error}</Typography>}
    {loading && <Typography>loading...</Typography>}
    {dictionary &&
      <Typography variant="h5" component="h5" gutterBottom>
        {!titleEditing && <>
          {dictionary.name}
          <IconButton onClick={() => setTitleEditing(dictionary.name)} size="small">
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </>}
        {titleEditing && <>
          <TextField
            variant="standard"
            InputProps={{ sx: (theme) => ({ ...theme.typography.h6, fontWeight: 'bold', minWidth: '350px' }) }}
            value={titleEditing}
            onChange={(e) => setTitleEditing(e.target.value)}
            autoFocus
            error={titleEditing.trim() === ""}
            helperText={titleEditing.trim() === "" ? "Title is required" : ""}
          />
          <IconButton
            disabled={titleEditing.trim() === ""}
            onClick={async () => {
              const updatedDictionary = await dispatch(addOrUpdateDictionary({
                ...dictionary,
                name: titleEditing,
                // Force update username and timestamp.
                username: undefined,
                timestamp: undefined,
              })).unwrap();
              if (updatedDictionary.timestamp) {
                dictionaryUpdated(updatedDictionary.timestamp);
              } else {
                console.error('Expecting timestamp after dictionary update for', updatedDictionary);
              }
              setTitleEditing("");
            }} size="small">
            <CheckOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={() => setTitleEditing("")} size="small">
            <CloseOutlinedIcon fontSize="small" />
          </IconButton>
        </>}
        <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
          Version: {formatShortDateTime(dictionary.timestamp_epoch || 0)}
          {refresh && <IconButton onClick={refresh} size="small">
            <RefreshIcon fontSize="small" />
          </IconButton>}
        </Typography>
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
