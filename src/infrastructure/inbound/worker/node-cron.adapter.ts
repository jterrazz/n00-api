import { type LoggerPort } from '@jterrazz/logger';
import cron, { type ScheduledTask } from 'node-cron';

import { type TaskPort, type WorkerPort } from '../../../application/ports/inbound/worker.port.js';

export class NodeCronAdapter implements WorkerPort {
    private readonly logger: LoggerPort;
    private readonly scheduledTasks: ScheduledTask[] = [];
    private readonly tasks: TaskPort[];

    constructor(logger: LoggerPort, tasks: TaskPort[]) {
        this.logger = logger;
        this.tasks = tasks;
    }

    async initialize(): Promise<void> {
        this.logger.info(`Initializing ${this.tasks.length} tasks`);

        for (const task of this.tasks) {
            this.logger.info(`Scheduling task: ${task.name} with schedule: ${task.schedule}`);

            const safeExecute = async (): Promise<void> => {
                this.logger.info(`Executing task: ${task.name}`);
                try {
                    await task.execute();
                    this.logger.info(`Task completed successfully: ${task.name}`);
                } catch (error) {
                    this.logger.error(`Task failed: ${task.name}`, { error });
                }
            };

            // Schedule the task. We intentionally "fire-and-forget" the promise returned
            // by `task.execute()` to avoid blocking the event loop or overlapping
            // with other scheduled jobs.
            const cronTask = cron.schedule(task.schedule, () => {
                void safeExecute();
            });

            this.scheduledTasks.push(cronTask);

            if (task.executeOnStartup) {
                this.logger.info(`Executing task on startup: ${task.name}`);
                void safeExecute();
            }

            cronTask.start();

            // Allow the process to exit gracefully even if only cron timers remain.
            // `node-cron` exposes the underlying timer via the private `timer` property
            // in recent versions. We defensively check for the standard `unref` API.

            const timerHandle = (cronTask as unknown as { timer?: NodeJS.Timeout }).timer;
            if (timerHandle?.unref) {
                timerHandle.unref();
            }
        }

        this.logger.info('All tasks initialized and started');
    }

    async stop(): Promise<void> {
        this.logger.info('Stopping all scheduled tasks');

        for (const task of this.scheduledTasks) {
            task.stop();
        }

        this.scheduledTasks.length = 0;
        this.logger.info('All tasks stopped');
    }
}
