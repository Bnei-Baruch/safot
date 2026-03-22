import { MenuItem, TextField, Typography } from '@mui/material';
import { Dictionary } from '../types/frontend-types';
import { getDictionaryIds, getLatestDictionary } from '../store/DictionarySlice';

interface DictionarySelectorProps {
  value: number | null | undefined;
  onChange: (dictionaryId: number | null, timestamp: number | null) => void;
  sourceLanguages: string[];
  translatedLanguage: string;
  dictionaries: Record<number, Record<number, Dictionary>>;
  disabled?: boolean;
}

export const DictionarySelector = ({
  value,
  onChange,
  sourceLanguages,
  translatedLanguage,
  dictionaries,
  disabled = false,
}: DictionarySelectorProps) => {
  const handleChange = (newDictionaryId: number | null) => {
    if (!newDictionaryId) {
      onChange(null, null);
      return;
    }

    const dictionary = getLatestDictionary(dictionaries, newDictionaryId);
    if (!dictionary) {
      onChange(null, null);
      return;
    }

    // Validate languages
    const sourcesSortedLanguages = sourceLanguages.sort().join(',');
    const dictionarySortedLanguages = [
      dictionary.original_language,
      ...(dictionary.additional_sources_languages || []),
    ].sort().join(',');

    if (
      translatedLanguage !== dictionary.translated_language ||
      sourcesSortedLanguages !== dictionarySortedLanguages
    ) {
      // eslint-disable-next-line no-restricted-globals
      const confirmed = confirm(
        `Dictionary languages (${dictionarySortedLanguages} => ${dictionary.translated_language}) don't match the source languages (${sourcesSortedLanguages} => ${translatedLanguage}). Continue anyway?`
      );
      if (!confirmed) {
        return;
      }
    }

    onChange(dictionary.id ?? null, dictionary.timestamp_epoch ?? null);
  };

  return (
    <TextField
      select
      label="Dictionary"
      value={value || 0}
      onChange={(e) => {
        const id = Number(e.target.value);
        handleChange(id || null);
      }}
      disabled={disabled}
      sx={{ minWidth: 200, fontFamily: 'Kanit, sans-serif' }}
      InputLabelProps={{ sx: { fontFamily: 'Kanit, sans-serif' } }}
      size="small"
    >
      <MenuItem value={0}>
        <Typography sx={{ fontFamily: 'inherit' }}>Default</Typography>
      </MenuItem>
      {getDictionaryIds(dictionaries).map((id) => (
        <MenuItem key={id} value={id}>
          <Typography sx={{ fontFamily: 'inherit' }}>
            {getLatestDictionary(dictionaries, id)?.name}
          </Typography>
        </MenuItem>
      ))}
    </TextField>
  );
};
