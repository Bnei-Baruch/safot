import { LanguageOption } from '../types/frontend-types';

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', direction: 'ltr' },
  { code: 'fr', label: 'French', direction: 'ltr' },
  { code: 'he', label: 'Hebrew', direction: 'rtl' },
  { code: 'ar', label: 'Arabic', direction: 'rtl' },
  { code: 'es', label: 'Spanish', direction: 'ltr' },
  { code: 'ru', label: 'Russian', direction: 'ltr' },
  { code: 'uk', label: 'Ukrainian', direction: 'ltr' },
  { code: 'tr', label: 'Turkish', direction: 'ltr' },
  { code: 'de', label: 'German', direction: 'ltr' },
  { code: 'it', label: 'Italian', direction: 'ltr' },
  // Additional 20 common languages
  { code: 'bg', label: 'Bulgarian', direction: 'ltr' },
  { code: 'hi', label: 'Hindi', direction: 'ltr' },
  { code: 'pt', label: 'Portuguese', direction: 'ltr' },
  { code: 'zh', label: 'Chinese (Simplified)', direction: 'ltr' },
  { code: 'ja', label: 'Japanese', direction: 'ltr' },
  { code: 'ko', label: 'Korean', direction: 'ltr' },
  { code: 'nl', label: 'Dutch', direction: 'ltr' },
  { code: 'pl', label: 'Polish', direction: 'ltr' },
  { code: 'el', label: 'Greek', direction: 'ltr' },
  { code: 'sv', label: 'Swedish', direction: 'ltr' },
  { code: 'cs', label: 'Czech', direction: 'ltr' },
  { code: 'ro', label: 'Romanian', direction: 'ltr' },
  { code: 'hu', label: 'Hungarian', direction: 'ltr' },
  { code: 'da', label: 'Danish', direction: 'ltr' },
  { code: 'fi', label: 'Finnish', direction: 'ltr' },
  { code: 'no', label: 'Norwegian', direction: 'ltr' },
  { code: 'fa', label: 'Persian (Farsi)', direction: 'rtl' },
  { code: 'ur', label: 'Urdu', direction: 'rtl' },
  { code: 'th', label: 'Thai', direction: 'ltr' },
  { code: 'vi', label: 'Vietnamese', direction: 'ltr' },
];

export const LANG_DIRS = LANGUAGES.reduce((acc: Record<string, 'ltr' | 'rtl'>, op: LanguageOption): Record<string, 'ltr' | 'rtl'> => {
  acc[op.code] = op.direction;
  return acc;
}, {});

