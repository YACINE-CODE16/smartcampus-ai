import { useI18n } from '../../lib/i18n';

/** Mentions et données personnelles (RGPD), en français et en anglais (US-38). */
export function MentionsPage() {
  const { t } = useI18n();
  return (
    <article className="prose">
      <h1>{t('Mentions et données personnelles', 'Legal notice and personal data')}</h1>
      <p className="muted">
        {t('SmartCampus AI — prototype réalisé dans le cadre du workshop Capgemini × ESIEA.', 'SmartCampus AI — prototype built during the Capgemini × ESIEA workshop.')}
      </p>

      <h2>{t('Données collectées', 'Data collected')}</h2>
      <ul>
        <li>{t('Votre nom, votre email école et votre rôle (étudiant, agent, administrateur).', 'Your name, school email and role (student, agent, administrator).')}</li>
        <li>
          {t(
            'Les signalements que vous créez : catégorie, lieu, description, urgence et photo éventuelle.',
            'The reports you create: category, location, description, urgency and optional photo.',
          )}
        </li>
        <li>{t("L'historique de traitement de chaque signalement et votre note éventuelle.", 'The handling history of each report and your optional rating.')}</li>
      </ul>
      <p>
        {t(
          "Aucune donnée sensible n'est demandée. Ne photographiez pas de personnes et n'indiquez pas d'informations personnelles dans vos descriptions.",
          'No sensitive data is requested. Do not photograph people and do not include personal information in your descriptions.',
        )}
      </p>

      <h2>{t('Finalités', 'Purposes')}</h2>
      <p>
        {t(
          "Traiter les incidents du campus, informer le demandeur de l'avancement (dans l'application et par email) et produire des statistiques de pilotage.",
          'Handle campus incidents, inform the requester of progress (in the app and by email) and produce management statistics.',
        )}
      </p>

      <h2>{t('Accès aux données', 'Who can see what')}</h2>
      <ul>
        <li>{t('Un étudiant ne voit que ses propres signalements.', 'A student only sees their own reports.')}</li>
        <li>
          {t(
            'Un agent voit les signalements qui lui sont affectés et ceux qui ne sont affectés à personne.',
            'An agent sees the reports assigned to them and those not assigned to anyone.',
          )}
        </li>
        <li>{t("L'administration voit l'ensemble des signalements.", 'The administration sees all reports.')}</li>
        <li>
          {t(
            "Les notes internes des agents ne sont jamais visibles par l'étudiant. Les actions sensibles sont tracées dans un journal d'audit.",
            'Agents’ internal notes are never visible to students. Sensitive actions are recorded in an audit log.',
          )}
        </li>
      </ul>

      <h2>{t('Assistant IA', 'AI assistant')}</h2>
      <p>
        {t(
          "L'assistant est une intelligence artificielle. Il répond uniquement à partir de la base documentaire du campus et de vos propres signalements ; ses réponses peuvent être incomplètes. Il n'a jamais accès aux signalements des autres utilisateurs. Le texte de vos questions n'est pas conservé : seuls le type de réponse, les sources utilisées et votre avis (👍/👎) sont enregistrés à des fins statistiques.",
          'The assistant is an artificial intelligence. It only answers from the campus knowledge base and your own reports; its answers may be incomplete. It never has access to other users’ reports. The text of your questions is not kept: only the answer type, the sources used and your feedback (👍/👎) are recorded for statistics.',
        )}
      </p>

      <h2>{t('Sécurité', 'Security')}</h2>
      <p>
        {t(
          'Les échanges sont chiffrés (HTTPS), les données sont chiffrées au repos (base de données et stockage des photos), et les photos ne sont servies qu’aux personnes autorisées à voir le ticket.',
          'Traffic is encrypted (HTTPS), data is encrypted at rest (database and photo storage), and photos are only served to people allowed to see the ticket.',
        )}
      </p>

      <h2>{t('Vos droits', 'Your rights')}</h2>
      <p>
        {t(
          "Vous pouvez demander l'accès, la rectification ou la suppression de vos données auprès de l'administration du campus. Sur demande, l'administration anonymise votre compte : vos descriptions, photos, commentaires, notifications et échanges avec l'assistant sont supprimés ; vos signalements restent uniquement sous forme anonyme dans les statistiques.",
          'You can ask the campus administration to access, correct or delete your data. On request, the administration anonymises your account: your descriptions, photos, comments, notifications and assistant exchanges are deleted; your reports only remain anonymously in the statistics.',
        )}
      </p>
    </article>
  );
}
