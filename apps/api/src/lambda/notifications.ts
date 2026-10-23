import type { ScheduledEvent } from 'aws-lambda';
import type { EmailEvent } from '../adapters/lambda-mailer';
import { SesMailer } from '../adapters/ses-mailer';
import { env } from '../config/env';
import { createContainer } from '../container';
import { checkOverdue } from '../jobs/overdue';

// Cette Lambda envoie elle-même via SES : la configurer en MAIL_DRIVER=lambda la ferait s'invoquer en boucle.
if (env.MAIL_DRIVER === 'lambda') throw new Error('La Lambda Notifications doit utiliser MAIL_DRIVER=ses (ou console).');

const container = createContainer(env);
const ses = new SesMailer(env.MAIL_FROM, env.AWS_REGION, env.MAIL_REDIRECT_TO);

/**
 * Lambda Notifications, deux déclencheurs :
 *  - EventBridge `rate(15 minutes)` → US-18 : tickets NOUVEAU au-delà du délai cible (remplace le minuteur local) ;
 *  - invocation asynchrone par la Lambda Incidents à chaque changement de statut → US-10 : email via SES.
 */
export async function handler(event: EmailEvent | ScheduledEvent): Promise<{ sent?: number; overdue?: number }> {
  if ('kind' in event && event.kind === 'email') {
    await ses.send(event.message);
    return { sent: 1 };
  }
  const overdue = await checkOverdue(container);
  console.log(`[délais] ${overdue} ticket(s) en retard signalé(s)`);
  return { overdue };
}
