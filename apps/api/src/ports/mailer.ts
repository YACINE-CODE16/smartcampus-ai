export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Envoi d'emails.
 * - local : boîte d'envoi de développement (console + fichiers `.eml` consultables).
 * - aws (phase 9) : Amazon SES.
 * Un échec d'envoi ne doit jamais faire échouer l'action métier (exigence 21.2) :
 * l'appelant journalise l'erreur et continue.
 */
export interface Mailer {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}
