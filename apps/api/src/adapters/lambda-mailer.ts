import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import type { MailMessage, Mailer } from '../ports/mailer';

/** Événement reçu par la Lambda Notifications pour un email (voir src/lambda/notifications.ts). */
export interface EmailEvent {
  kind: 'email';
  message: MailMessage;
}

/**
 * AWS (MAIL_DRIVER=lambda) : la Lambda Incidents invoque la Lambda Notifications en asynchrone
 * à chaque changement de statut ; c'est elle qui envoie l'email via SES (US-10).
 */
export class LambdaInvokeMailer implements Mailer {
  readonly name = 'lambda';
  private readonly client: LambdaClient;

  constructor(
    private readonly functionName: string,
    region: string,
  ) {
    this.client = new LambdaClient({ region });
  }

  async send(message: MailMessage): Promise<void> {
    const event: EmailEvent = { kind: 'email', message };
    await this.client.send(
      new InvokeCommand({ FunctionName: this.functionName, InvocationType: 'Event', Payload: Buffer.from(JSON.stringify(event)) }),
    );
  }
}
