import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from './Toast';

import debounce from "lodash.debounce";
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import {
  Add as AddIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  CheckOutlined as CheckOutlinedIcon,
  CloseOutlined as CloseOutlinedIcon,
  Delete as DeleteIcon,
  DeleteOutlined as DeleteOutlinedIcon,
  EditOutlined as EditOutlinedIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Restore as RestoreIcon,
  TextSnippet as TextSnippetIcon,
} from '@mui/icons-material';

import { useAppDispatch, useAppSelector, RootState } from '../store/store';

import {
  addOrUpdateDictionary,
  addOrUpdateRules,
  fetchDictionaries,
  fetchPrompt,
  fetchRules,
  getRulesForDictionaryVersion,
} from '../store/DictionarySlice';
import { Rule } from '../types/frontend-types';
import { formatShortDateTime } from './Utils';
import { LANGUAGES } from '../constants/languages';

// Rule type constants (must match backend)
const RULE_TYPE_TEXT = "text";
// const RULE_TYPE_PROMPT_KEY = "prompt_key";

// We can make the right side panel to be also history for each segment...

type RuleNodeProps = {
  rule: Rule,
  ruleOrder: number,
  totalRules: number,
  isOpen: boolean,
  toggle: (id: number) => void,
  update: (rule: Rule) => void,
  remove: (rule: Rule) => void,
  moveUp: (rule: Rule) => void,
  moveDown: (rule: Rule) => void,
}

function RuleNode({rule, ruleOrder, totalRules, isOpen, toggle, update, remove, moveUp, moveDown}: RuleNodeProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState<boolean>(false);

  // Auto-expand when editing starts
  useEffect(() => {
    if (editing && rule.id && !isOpen) {
      toggle(rule.id);
    }
  }, [editing, rule.id, isOpen, toggle]);

  const defaultPrompt = (rule && rule.properties && rule.properties['text']) || '';
  const [prompt, setPrompt] = useState<{text: string, cursor: number}>({text: defaultPrompt, cursor: defaultPrompt.length});
  const [ruleName, setRuleName] = useState<string>(rule.name);

  const updatePrompt = useMemo(() => debounce((text: string, cursor: number) => {
    setPrompt({ text, cursor });
  }, 500), [setPrompt]);

  const updateRule = useCallback(() => {
    const updatedRule = {
      ...rule,
      name: ruleName,
      properties: { ...rule.properties, 'text': prompt.text}
    };
    update(updatedRule);
    setEditing(false);
  }, [rule, ruleName, prompt, update]);

  return (
    <>
      <ListItemButton
          onClick={() => rule.id !== undefined && toggle(rule.id)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              moveUp(rule);
            }}
            disabled={ruleOrder === 0}
          >
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              moveDown(rule);
            }}
            disabled={ruleOrder === totalRules - 1}
          >
            <ArrowDownwardIcon fontSize="small" />
          </IconButton>
        </Box>
        <ListItemText primary={rule.name} sx={{ flexGrow: 1 }} />
        {editing && <IconButton
          size="small"
          disabled={prompt.text === defaultPrompt && ruleName === rule.name}
          onClick={updateRule}
        >
          <CheckOutlinedIcon fontSize="small" />
        </IconButton>}
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(!editing);
            setRuleName(rule.name);
            setPrompt({text: defaultPrompt, cursor: defaultPrompt.length});
          }}
        >
          {!editing ? <EditOutlinedIcon fontSize="small" /> : <CloseOutlinedIcon fontSize="small" />}
        </IconButton>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            remove(rule);
          }}
        >
          {rule.deleted ? <RestoreIcon fontSize="small" /> : <DeleteIcon fontSize="small" />}
        </IconButton>
        {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </ListItemButton>
      <Collapse in={isOpen} timeout="auto" unmountOnExit>
        <ListItem sx={{ position: "relative" }}>
          <ListItemButton sx={{ pl: 4 }}>
            {!editing && (
              <Typography sx={{ whiteSpace: 'pre-line', textAlign: 'left' }}>
                {prompt.text}
              </Typography>
            )}
            {editing && (
              <Box sx={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Rule Name"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ mb: 2 }}
                  error={ruleName.trim() === ""}
                  helperText={ruleName.trim() === "" ? "Name is required" : ""}
                />
                <TextField
                  inputRef={ref}
                  fullWidth
                  multiline
                  minRows={1}
                  maxRows={8}
                  defaultValue={prompt.text}
                  onChange={(e) => updatePrompt(e.target.value, e.target.selectionStart || 0)}
                  placeholder="Prompt text"
                  label="Rule Text"
                  variant="outlined"
                />
              </Box>
            )}
          </ListItemButton>
        </ListItem>
      </Collapse>
    </>
  );
}

const Dictionary: React.FC<{
  dictionary_id: number,
  dictionary_timestamp_epoch: number,
  dictionaryUpdated: (new_dictionary_timestamp_epoch: number) => void,
  refresh?: () => void
}> = ({ dictionary_id, dictionary_timestamp_epoch, dictionaryUpdated, refresh }) => {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const {dictionaries, rules, prompts, loading, error} = useAppSelector((state: RootState) => state.dictionaries);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [titleEditing, setTitleEditing] = useState<string>('');
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState<boolean>(false);
  const [languagesEditing, setLanguagesEditing] = useState<{
    original: string;
    additional: string[];
    translated: string;
  } | null>(null);

  useEffect(() => {
    if (dictionary_id && dictionary_timestamp_epoch) {
      dispatch(fetchPrompt({dictionary_id, dictionary_timestamp: dictionary_timestamp_epoch}));
      dispatch(fetchRules({dictionary_id, dictionary_timestamp: dictionary_timestamp_epoch}));
      dispatch(fetchDictionaries({dictionary_id, dictionary_timestamp: dictionary_timestamp_epoch}));
    }
  }, [dispatch, dictionary_id, dictionary_timestamp_epoch]);

  // Get the specific version of dictionary based on timestamp
  const dictionary = useMemo(() => {
    return (dictionary_id && dictionary_timestamp_epoch &&
            dictionaries[dictionary_id]?.[dictionary_timestamp_epoch]) || null;
  }, [dictionaries, dictionary_id, dictionary_timestamp_epoch]);

  // Get rules valid for this dictionary version (filters by timestamp)
  const dictionaryRules = useMemo(() => {
    return (dictionary_id && dictionary_timestamp_epoch)
      ? getRulesForDictionaryVersion(rules, dictionary_id, dictionary_timestamp_epoch)
      : null;
  }, [rules, dictionary_id, dictionary_timestamp_epoch]);

  // Filter deleted rules unless showDeleted is true
  const visibleRules = useMemo(() => {
    if (!dictionaryRules) return null;
    return showDeleted ? dictionaryRules : dictionaryRules.filter(r => !r.deleted);
  }, [dictionaryRules, showDeleted]);

  const showPrompt = useCallback(() => {
    const prompt = prompts[dictionary_id]?.[dictionary_timestamp_epoch];
    if (prompt) {
      setPromptDialogOpen(true);
    } else {
      showToast('No prompt available', 'info');
    }
  }, [prompts, dictionary_id, dictionary_timestamp_epoch, showToast]);

  // console.log(`Dictionary: ${dictionary && dictionary.modified_at_epoch}`);
  // console.log(`Rules: ${dictionaryRules && dictionaryRules[0] && dictionaryRules[0].properties && dictionaryRules[0].properties.text}`);

  const updateRules = useCallback(async (rules: Rule[]) => {
    try {
      if (!rules || rules.length === 0 || !dictionary) {
        return;
      }
      // Clear username, timestamp for all rules to allow backend to fill them properly
      const rulesForUpdate = rules.map(rule => ({
        ...rule,
        username: undefined,
        timestamp: undefined,
      }));

      const updatedRules = await dispatch(addOrUpdateRules(rulesForUpdate)).unwrap();

      if (updatedRules.length === 0) {
        console.error('Expected at least one updated rule');
        return;
      }

      // All rules in the batch have the same timestamp, use the first one
      const sharedTimestamp = updatedRules[0].timestamp;
      const sharedTimestampEpoch = updatedRules[0].timestamp_epoch;
      await dispatch(addOrUpdateDictionary({
        ...dictionary,
        username: undefined,
        timestamp: sharedTimestamp,
      })).unwrap();

      if (sharedTimestampEpoch) {
        dictionaryUpdated(sharedTimestampEpoch);
      } else {
        console.error('Expected updated rule timestamp_epoch.');
      }
    } catch (err) {
      console.error('Failed updating rules.');
    }
  }, [dispatch, dictionary, dictionaryUpdated]);

  // Add a new text rule
  const addRule = useCallback(async () => {
    if (!dictionary || !dictionaryRules) return;

    try {
      // Find the maximum order and add at the end
      let newOrder = 0;
      if (dictionaryRules.length > 0) {
        const maxOrder = Math.max(...dictionaryRules.map(r => r.order || 0));
        newOrder = maxOrder + 1;
      }

      const newRule: Rule = {
        name: "New Rule",
        type: RULE_TYPE_TEXT,
        dictionary_id: dictionary_id,
        properties: { text: "Enter rule text here..." },
        order: newOrder,
        // These will be filled by backend
        created_at_epoch: 0,
        created_by: "",
        modified_at_epoch: 0,
        modified_by: "",
      };

      await updateRules([newRule]);

      showToast('Rule added successfully', 'success');
    } catch (err) {
      console.error('Failed adding rule:', err);
      showToast('Failed to add rule', 'error');
    }
  }, [dictionary, dictionaryRules, dictionary_id, updateRules, showToast]);

  // Toggle delete/undelete rule
  const toggleRuleDeleted = useCallback(async (rule: Rule) => {
    if (!dictionary || !dictionaryRules) return;

    if (!rule.id) {
      showToast('Cannot modify rule without ID', 'error');
      return;
    }

    const isDeleting = !rule.deleted;

    // Only validate when deleting (not when undeleting)
    if (isDeleting) {
      // Validate: must keep at least one rule
      const nonDeletedRules = dictionaryRules.filter(r => !r.deleted);
      if (nonDeletedRules.length <= 1) {
        showToast('Cannot remove the last rule', 'error');
        return;
      }

      // eslint-disable-next-line no-restricted-globals
      if (!confirm(`Are you sure you want to remove rule "${rule.name}"?`)) {
        return;
      }
    }

    try {
      // Toggle deleted state
      await updateRules([{
        ...rule,
        deleted: isDeleting,
      }]);
      showToast(isDeleting ? 'Rule removed successfully' : 'Rule restored successfully', 'success');
    } catch (err) {
      console.error(isDeleting ? 'Failed removing rule:' : 'Failed restoring rule:', err);
      showToast(isDeleting ? 'Failed to remove rule' : 'Failed to restore rule', 'error');
    }
  }, [dictionary, dictionaryRules, updateRules, showToast]);

  // Move rule up
  const moveRuleUp = useCallback(async (rule: Rule) => {
    if (!dictionary || !dictionaryRules) return;
    const currentIndex = dictionaryRules.findIndex(r => r.id === rule.id);
    if (currentIndex <= 0) return;

    // Find the previous rule (skip deleted only if not showing them)
    let prevIndex = currentIndex - 1;
    while (prevIndex >= 0 && (!showDeleted && dictionaryRules[prevIndex].deleted)) {
      prevIndex--;
    }

    // No valid rule found above
    if (prevIndex < 0) return;

    const prevRule = dictionaryRules[prevIndex];
    const tempOrder = rule.order;

    // Swap orders
    await updateRules([{ ...rule, order: prevRule.order }, { ...prevRule, order: tempOrder }]);
  }, [dictionary, dictionaryRules, showDeleted, updateRules]);

  // Move rule down
  const moveRuleDown = useCallback(async (rule: Rule) => {
    if (!dictionary || !dictionaryRules) return;
    const currentIndex = dictionaryRules.findIndex(r => r.id === rule.id);
    if (currentIndex < 0 || currentIndex >= dictionaryRules.length - 1) return;

    // Find the next rule (skip deleted only if not showing them)
    let nextIndex = currentIndex + 1;
    while (nextIndex < dictionaryRules.length && (!showDeleted && dictionaryRules[nextIndex].deleted)) {
      nextIndex++;
    }

    // No valid rule found below
    if (nextIndex >= dictionaryRules.length) return;

    const nextRule = dictionaryRules[nextIndex];
    const tempOrder = rule.order;

    // Swap orders
    await updateRules([{ ...rule, order: nextRule.order }, { ...nextRule, order: tempOrder }]);
  }, [dictionary, dictionaryRules, showDeleted, updateRules]);

  return (<Box sx={{ position: 'relative' }}>
    {error && <Typography>{error}</Typography>}
    {loading && <Typography sx={{ position: 'absolute', left: '50%', transform: 'translate(-50%, 0)'}}>loading...</Typography>}
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
              if (updatedDictionary.timestamp_epoch) {
                dictionaryUpdated(updatedDictionary.timestamp_epoch);
              } else {
                console.error('Expecting timestamp_epoch after dictionary update for', updatedDictionary);
              }
              setTitleEditing("");
            }} size="small">
            <CheckOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={() => setTitleEditing("")} size="small">
            <CloseOutlinedIcon fontSize="small" />
          </IconButton>
        </>}
        <Box component="span" sx={{ float: 'right' }}>
          <IconButton onClick={addRule} sx={{ paddingTop: '6px' }}>
            <AddIcon />
          </IconButton>
        </Box>
        <Box component="span" sx={{ float: 'right' }}>
          <Tooltip title="Show Prompt">
            <IconButton onClick={showPrompt} sx={{ paddingTop: '6px' }}>
              <TextSnippetIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Box component="span" sx={{ float: 'right' }}>
          <Tooltip title="Show Deleted">
            <FormControlLabel
              control={
                <Checkbox
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  size="small"
                />
              }
              label={<DeleteOutlinedIcon fontSize="small" sx={{ 'vertical-align': 'sub' }} />}
            />
          </Tooltip>
        </Box>
        <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
          Version: {formatShortDateTime(dictionary.timestamp_epoch || 0)}
          <Box component="span">
            {refresh && <IconButton onClick={refresh} size="small">
              <RefreshIcon fontSize="small" />
            </IconButton>}
          </Box>
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          {!languagesEditing && <>
            <Typography variant="body2" color="text.secondary">
              Languages: {dictionary.original_language || '?'}
              {dictionary.additional_sources_languages?.length ? ` (+${dictionary.additional_sources_languages.join(', ')})` : ''}
              {' → '}{dictionary.translated_language || '?'}
            </Typography>
            <IconButton onClick={() => setLanguagesEditing({
              original: dictionary.original_language || '',
              additional: dictionary.additional_sources_languages || [],
              translated: dictionary.translated_language || '',
            })} size="small">
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </>}
          {languagesEditing && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              select
              label="Original"
              value={languagesEditing.original}
              onChange={(e) => setLanguagesEditing({ ...languagesEditing, original: e.target.value })}
              size="small"
              sx={{ minWidth: 120 }}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>{lang.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Additional"
              value={languagesEditing.additional}
              onChange={(e) => setLanguagesEditing({ ...languagesEditing, additional: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value })}
              size="small"
              sx={{ minWidth: 120 }}
              SelectProps={{ multiple: true }}
            >
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>{lang.label}</MenuItem>
              ))}
            </TextField>
            <Typography>→</Typography>
            <TextField
              select
              label="Translated"
              value={languagesEditing.translated}
              onChange={(e) => setLanguagesEditing({ ...languagesEditing, translated: e.target.value })}
              size="small"
              sx={{ minWidth: 120 }}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>{lang.label}</MenuItem>
              ))}
            </TextField>
            <IconButton
              onClick={async () => {
                const updatedDictionary = await dispatch(addOrUpdateDictionary({
                  ...dictionary,
                  original_language: languagesEditing.original || undefined,
                  additional_sources_languages: languagesEditing.additional.length > 0 ? languagesEditing.additional : undefined,
                  translated_language: languagesEditing.translated || undefined,
                  username: undefined,
                  timestamp: undefined,
                })).unwrap();
                if (updatedDictionary.timestamp_epoch) {
                  dictionaryUpdated(updatedDictionary.timestamp_epoch);
                }
                setLanguagesEditing(null);
              }} size="small">
              <CheckOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton onClick={() => setLanguagesEditing(null)} size="small">
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Box>}
        </Box>
      </Typography>
    }
    {visibleRules &&
      <List>
        {visibleRules.map((rule, index) =>
          <RuleNode
            key={`${rule.id}-${rule.modified_at_epoch}`}
            rule={rule}
            ruleOrder={index}
            totalRules={visibleRules.length}
            isOpen={rule.id ? open[rule.id] : false}
            toggle={(id: number) => setOpen({...open, [id]: !open[id]})}
            update={(rule: Rule) => updateRules([rule])}
            remove={(rule: Rule) => toggleRuleDeleted(rule)}
            moveUp={(rule: Rule) => moveRuleUp(rule)}
            moveDown={(rule: Rule) => moveRuleDown(rule)} />
        )}
      </List>
    }
    <Dialog
      open={promptDialogOpen}
      onClose={() => setPromptDialogOpen(false)}
      aria-labelledby="Prompt"
    >
      <DialogTitle>
        Prompt for {dictionary?.name}
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ whiteSpace: 'pre', fontFamily: 'monospace' }}>
          {prompts[dictionary_id]?.[dictionary_timestamp_epoch]}
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button variant="contained" autoFocus
          onClick={() => setPromptDialogOpen(false)}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  </Box>);
};

export default Dictionary;
