import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { MailMessage, Mailer } from '../ports/mailer';

/** Boîte d'envoi locale : rien ne part réellement, chaque email est consultable en `.eml`. */
export class ConsoleMailer implements Mailer {
  readonly name = 'console';
  private readonly dir: string;

  constructor(
    outboxDir: string,
    private readonly from: string,
    private readonly quiet = false,
  ) {
    this.dir = resolve(outboxDir);
  }

  async send(m: MailMessage): Promise<void> {
    const date = new Date();
    const eml = [
      `From: ${this.from}`,
      `To: ${m.to}`,
      `Subject: ${m.subject}`,
      `Date: ${date.toUTCString()}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      m.text,
      '',
    ].join('\r\n');
    await mkdir(this.dir, { recursive: true });
    const file = `${date.toISOString().replace(/[:.]/g, '-')}-${m.to.replace(/[^a-z0-9]/gi, '_')}.eml`;
    await writeFile(join(this.dir, file), eml, 'utf8');
    if (!this.quiet) console.log(`[email] → ${m.to} : ${m.subject}`);
  }
}
