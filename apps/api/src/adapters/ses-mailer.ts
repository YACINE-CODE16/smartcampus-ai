import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { MailMessage, Mailer } from '../ports/mailer';

/**
 * Amazon SES (production). En mode sandbox SES, les destinataires doivent aussi être vérifiés.
 * Identifiants : chaîne par défaut du SDK (rôle IAM de l'instance).
 */
export class SesMailer implements Mailer {
  readonly name = 'ses';
  private readonly client: SESv2Client;

  constructor(
    private readonly from: string,
    region: string,
  ) {
    this.client = new SESv2Client({ region });
  }

  async send(m: MailMessage): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [m.to] },
        Content: {
          Simple: {
            Subject: { Data: m.subject, Charset: 'UTF-8' },
            Body: { Text: { Data: m.text, Charset: 'UTF-8' } },
          },
        },
      }),
    );
  }
}
