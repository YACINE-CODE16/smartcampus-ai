/** Mentions et données personnelles (RGPD). */
export function MentionsPage() {
  return (
    <article className="prose">
      <h1>Mentions et données personnelles</h1>
      <p className="muted">SmartCampus AI — prototype réalisé dans le cadre du workshop Capgemini × ESIEA.</p>

      <h2>Données collectées</h2>
      <ul>
        <li>Votre nom, votre email école et votre rôle (étudiant, agent, administrateur).</li>
        <li>Les signalements que vous créez : catégorie, lieu, description, urgence et photo éventuelle.</li>
        <li>L'historique de traitement de chaque signalement.</li>
      </ul>
      <p>Aucune donnée sensible n'est demandée. Ne photographiez pas de personnes et n'indiquez pas d'informations personnelles dans vos descriptions.</p>

      <h2>Finalités</h2>
      <p>Traiter les incidents du campus, informer le demandeur de l'avancement et produire des statistiques de pilotage.</p>

      <h2>Accès aux données</h2>
      <ul>
        <li>Un étudiant ne voit que ses propres signalements.</li>
        <li>Un agent voit les signalements qui lui sont affectés et ceux qui ne sont affectés à personne.</li>
        <li>L'administration voit l'ensemble des signalements.</li>
      </ul>

      <h2>Assistant IA</h2>
      <p>
        L'assistant est une intelligence artificielle. Il répond uniquement à partir de la FAQ du campus et de vos propres
        signalements ; ses réponses peuvent être incomplètes. Il n'a jamais accès aux signalements des autres utilisateurs.
      </p>

      <h2>Sécurité et conservation</h2>
      <p>Les échanges sont chiffrés (HTTPS) et les données sont chiffrées au repos. Les données de démonstration sont supprimées à l'issue du workshop.</p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l'accès, la rectification ou la suppression de vos données auprès de l'administration du
        campus ; la demande est traitée manuellement.
      </p>
    </article>
  );
}
