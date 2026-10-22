import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LANG, isLang, localize, type Bilingual, type CategoryRef, type Lang } from '@smartcampus/shared';
import { setRequestLang } from './api';

const STORAGE_KEY = 'sc_lang';

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // stockage indisponible (navigation privée) : on garde le défaut
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LANG;
}

interface I18n {
  lang: Lang;
  setLang(lang: Lang): void;
  /** Texte de l'interface, écrit dans les deux langues à l'endroit où il est utilisé. */
  t(fr: string, en: string): string;
  /** Libellé métier bilingue (statuts, rôles, urgences…). */
  label(value: Bilingual): string;
  /** Message bilingue venant de l'API (commentaires générés, motifs de fusion). */
  text(value: string): string;
  category(c: CategoryRef): string;
  locale: string;
}

const I18nContext = createContext<I18n | null>(null);

/** US-38 : langue de l'interface, mémorisée sur l'appareil et transmise à l'API. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    setRequestLang(lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // sans persistance, le choix vaut pour la session
    }
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (fr, en) => (lang === 'en' ? en : fr),
      label: (v) => v[lang],
      text: (v) => localize(v, lang),
      category: (c) => (lang === 'en' && c.labelEn ? c.labelEn : c.label),
      locale: lang === 'en' ? 'en-GB' : 'fr-FR',
    }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Le hook vit avec son contexte ; le Fast Refresh de ce fichier n'est pas utile.
// oxlint-disable-next-line react/only-export-components
export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n doit être utilisé dans <I18nProvider>');
  return ctx;
}
