/** Écran provisoire pour une fonctionnalité d'une étape ultérieure. */
export function Placeholder({ title, story }: { title: string; story: string }) {
  return (
    <section className="empty">
      <h1>{title}</h1>
      <p className="muted">Bientôt disponible ({story}).</p>
    </section>
  );
}
