import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { MailMessage, Mailer } from '../ports/mailer';

/**
 * Amazon SES (production). En mode sandbox SES, les destinataires doivent aussi être vérifiés :
 * `redirectTo` (MAIL_REDIRECT_TO) envoie alors tout vers une seule adresse vérifiée, destinataire réel en objet.
 * Identifiants : chaîne par défaut du SDK (rôle IAM de la Lambda).
 */
export class SesMailer implements Mailer {
  readonly name = 'ses';
  private readonly client: SESv2Client;

  constructor(
    private readonly from: string,
    region: string,
    private readonly redirectTo?: string,
  ) {
    this.client = new SESv2Client({ region });
  }

  async send(m: MailMessage): Promise<void> {
    const to = this.redirectTo || m.to;
    const subject = this.redirectTo ? `[→ ${m.to}] ${m.subject}` : m.subject;
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Text: { Data: m.text, Charset: 'UTF-8' } },
          },
        },
      }),
    );
  }
}
