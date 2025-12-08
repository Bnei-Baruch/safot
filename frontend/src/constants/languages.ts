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
];

export const LANG_DIRS = LANGUAGES.reduce((acc: Record<string, 'ltr' | 'rtl'>, op: LanguageOption): Record<string, 'ltr' | 'rtl'> => {
  acc[op.code] = op.direction;
  return acc;
}, {});

