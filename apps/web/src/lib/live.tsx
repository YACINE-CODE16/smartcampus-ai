import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LiveEvent } from '@smartcampus/shared';
import { useAuth } from './auth';

type Listener = (event: LiveEvent) => void;
const LiveContext = createContext<Set<Listener> | null>(null);

/**
 * Une connexion SSE par onglet, ouverte tant que l'utilisateur est connecté.
 * Le flux est fermé quand la page est masquée (`pagehide`) et rouvert à son retour (`pageshow`) :
 * sinon les pages gardées dans le cache précédent/suivant du navigateur conservent leur connexion
 * et épuisent la limite de 6 connexions par serveur (pages bloquées au chargement).
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [listeners] = useState(() => new Set<Listener>());

  useEffect(() => {
    if (!user) return;
    let source: EventSource | null = null;

    const open = () => {
      if (source) return;
      source = new EventSource('/api/events');
      source.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data as string) as LiveEvent;
          for (const l of listeners) l(event);
        } catch {
          // trame inattendue : ignorée
        }
      };
    };
    const close = () => {
      source?.close();
      source = null;
    };
    const onShow = (e: PageTransitionEvent) => e.persisted && open();

    open();
    window.addEventListener('pagehide', close);
    window.addEventListener('pageshow', onShow);
    return () => {
      window.removeEventListener('pagehide', close);
      window.removeEventListener('pageshow', onShow);
      close();
    };
  }, [user, listeners]);

  return <LiveContext.Provider value={listeners}>{children}</LiveContext.Provider>;
}

/** Abonne un composant aux événements temps réel (le dernier `handler` est toujours utilisé). */
// oxlint-disable-next-line react/only-export-components
export function useLive(handler: Listener): void {
  const listeners = useContext(LiveContext);
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!listeners) return;
    const l: Listener = (e) => ref.current(e);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, [listeners]);
}
