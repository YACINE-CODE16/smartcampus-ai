import { describe, expect, it } from 'vitest';
import { bi, localize } from '../config/i18n';
import { detectLanguage } from './language';
import { notificationText } from './notifications';

describe('bi / localize', () => {
  it('picks the requested language and passes plain strings through', () => {
    const m = bi('Bonjour', 'Hello');
    expect(localize(m, 'fr')).toBe('Bonjour');
    expect(localize(m, 'en')).toBe('Hello');
    expect(localize('Texte simple', 'en')).toBe('Texte simple');
  });
});

describe('detectLanguage (US-38)', () => {
  it.each([
    ['le wifi ne marche pas, je fais quoi ?', 'fr'],
    ['où en est mon ticket SC-0044 ?', 'fr'],
    ['the wifi is not working in my room', 'en'],
    ['where is my ticket?', 'en'],
  ] as const)('%s → %s', (text, lang) => expect(detectLanguage(text)).toBe(lang));
  it('falls back to the UI language when undecidable', () => expect(detectLanguage('SC-0044', 'en')).toBe('en'));
});

describe('notificationText (US-10)', () => {
  it('renders status changes in both languages', () => {
    const p = { ticket: 'SC-0042', from: 'NOUVEAU', to: 'EN_COURS' } as const;
    expect(notificationText('STATUS_CHANGED', p, 'fr').body).toContain('« Nouveau » à « En cours »');
    expect(notificationText('STATUS_CHANGED', p, 'en').title).toBe('Ticket SC-0042: In progress');
  });
});
