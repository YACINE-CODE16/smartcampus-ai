import type { ReactNode } from 'react';

/** Conteneur de tableau défilant : focusable et nommé pour la navigation au clavier (US-35). */
export function TableWrap({ label, card = true, children }: { label: string; card?: boolean; children: ReactNode }) {
  return (
    <div className={`${card ? 'card ' : ''}table-wrap`} role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
