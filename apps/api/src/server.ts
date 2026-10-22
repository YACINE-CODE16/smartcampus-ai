import { SETTINGS } from '@smartcampus/shared';
import { env } from './config/env';
import { createContainer } from './container';
import { createApp } from './http/app';
import { checkOverdue } from './jobs/overdue';

const container = createContainer(env);
const server = createApp(container).listen(env.PORT, () => {
  console.log(
    `API SmartCampus prête sur http://localhost:${env.PORT} ` +
      `(stockage : ${env.STORAGE_DRIVER}, emails : ${env.MAIL_DRIVER}, IA : ${env.AI_DRIVER}, base documentaire : ${env.KB_DRIVER})`,
  );
});

// US-18 : contrôle périodique des délais cibles (instance unique).
async function runOverdueCheck() {
  try {
    const n = await checkOverdue(container);
    if (n > 0) console.log(`[délais] ${n} ticket(s) en retard signalé(s)`);
  } catch (err) {
    console.error('[délais] échec du contrôle :', err);
  }
}
const overdueTimer = setInterval(runOverdueCheck, SETTINGS.overdueCheckMinutes * 60_000);
setTimeout(runOverdueCheck, 5_000);

async function shutdown() {
  clearInterval(overdueTimer);
  server.close();
  await container.dispose();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
