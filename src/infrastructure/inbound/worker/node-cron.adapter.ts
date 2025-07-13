import { type LoggerPort } from '@jterrazz/logger';
import cron, { type ScheduledTask } from 'node-cron';

import { type TaskPort, type WorkerPort } from '../../../application/ports/inbound/worker.port.js';

export class NodeCronAdapter implements WorkerPort {
    private readonly scheduledTasks: ScheduledTask[] = [];

    constructor(
        private readonly logger: LoggerPort,
        private readonly tasks: TaskPort[],
    ) {}

    async initialize(): Promise<void> {
        this.logger.debug('Starting worker', { tasks: this.tasks.length });

        for (const task of this.tasks) {
            this.scheduleTask(task);
        }

        this.logger.debug('Worker initialization complete');
    }

    async stop(): Promise<void> {
        this.logger.info('Stopping worker', { runningTasks: this.scheduledTasks.length });

        for (const task of this.scheduledTasks) {
            task.stop();
        }

        this.scheduledTasks.length = 0;
        this.logger.info('Worker has stopped');
    }

    /**
     * Schedules an individual cron task and wires up logging + graceful shutdown handling.
     */
    private scheduleTask(task: TaskPort): void {
        this.logger.debug('Scheduling task', { schedule: task.schedule, task: task.name });

        const executeSafely = async (): Promise<void> => {
            const start = Date.now();
            this.logger.debug('Task started', { task: task.name });

            try {
                await task.execute();
                this.logger.info('Task completed successfully', {
                    durationMs: Date.now() - start,
                    task: task.name,
                });
            } catch (error) {
                this.logger.error('Task execution error', { error, task: task.name });
            }
        };

        const cronTask = cron.schedule(task.schedule, () => {
            void executeSafely();
        });

        this.scheduledTasks.push(cronTask);

        if (task.executeOnStartup) {
            this.logger.debug('Executing startup task', { task: task.name });
            void executeSafely();
        }

        cronTask.start();

        // Allow process to exit if cron timers are the only event-loop handles.
        const timerHandle = (cronTask as unknown as { timer?: NodeJS.Timeout }).timer;
        timerHandle?.unref?.();
    }
}
