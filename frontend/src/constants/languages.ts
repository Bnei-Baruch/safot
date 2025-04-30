import { LanguageOption } from '../types/frontend-types';
import enFlag from '../assets/flags/en.png';
import frFlag from '../assets/flags/fr.png';
import heFlag from '../assets/flags/he.png';
import arFlag from '../assets/flags/ar.png';
import esFlag from '../assets/flags/es.png';
import ruFlag from '../assets/flags/ru.png';

export const LANGUAGES: LanguageOption[] = [
    { code: 'en', label: 'English', flag: enFlag, direction: 'ltr' },
    { code: 'fr', label: 'French', flag: frFlag, direction: 'ltr' },
    { code: 'he', label: 'Hebrew', flag: heFlag, direction: 'rtl' },
    { code: 'ar', label: 'Arabic', flag: arFlag, direction: 'rtl' },
    { code: 'es', label: 'Spanish', flag: esFlag, direction: 'ltr' },
    { code: 'ru', label: 'Russian', flag: ruFlag, direction: 'ltr' },
  ];