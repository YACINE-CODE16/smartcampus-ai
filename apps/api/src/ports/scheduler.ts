export interface ScheduledJob {
  name: string;
  /** Expression cron 5 champs (ex. `0 3 * * *`), réutilisée telle quelle pour EventBridge. */
  cron: string;
  run(now: Date): Promise<void>;
}

/**
 * Tâches planifiées (fermeture J+7, plus tard anonymisation).
 * - local : minuterie dans le processus de l'API.
 * - aws (phase 9) : une Lambda par tâche, déclenchée par EventBridge Scheduler.
 */
export interface Scheduler {
  readonly name: string;
  register(job: ScheduledJob): void;
  /** Exécution immédiate (démo, tests, script). */
  runNow(jobName: string): Promise<void>;
  start(): void;
  stop(): Promise<void>;
}
