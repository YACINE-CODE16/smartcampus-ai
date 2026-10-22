import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LiveEvent } from '@smartcampus/shared';
import { useAuth } from './auth';

type Listener = (event: LiveEvent) => void;
const LiveContext = createContext<Set<Listener> | null>(null);

/** Une connexion SSE par onglet, ouverte tant que l'utilisateur est connecté. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [listeners] = useState(() => new Set<Listener>());

  useEffect(() => {
    if (!user) return;
    const source = new EventSource('/api/events');
    source.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data as string) as LiveEvent;
        for (const l of listeners) l(event);
      } catch {
        // trame inattendue : ignorée
      }
    };
    return () => source.close();
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
