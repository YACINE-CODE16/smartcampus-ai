export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envoi d'emails (US-10).
 * - `console` : affichage dans la console + fichier `.eml` dans `MAIL_OUTBOX_DIR`.
 * - `ses` : Amazon SES (expéditeur `MAIL_FROM` vérifié).
 * L'appelant ne laisse jamais un échec d'envoi faire échouer l'action métier.
 */
export interface Mailer {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}
