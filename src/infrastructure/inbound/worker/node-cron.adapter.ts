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
        this.logger.debug('worker:start', { taskCount: this.tasks.length });

        for (const task of this.tasks) {
            this.scheduleTask(task);
        }

        this.logger.debug('worker:ready');
    }

    async stop(): Promise<void> {
        this.logger.info('worker:stop', { runningTasks: this.scheduledTasks.length });

        for (const task of this.scheduledTasks) {
            task.stop();
        }

        this.scheduledTasks.length = 0;
        this.logger.info('worker:stopped');
    }

    /**
     * Schedules an individual cron task and wires up logging + graceful shutdown handling.
     */
    private scheduleTask(task: TaskPort): void {
        this.logger.debug('worker:schedule', { cron: task.schedule, name: task.name });

        const executeSafely = async (): Promise<void> => {
            const start = Date.now();
            this.logger.debug('task:start', { name: task.name });

            try {
                await task.execute();
                this.logger.info('task:success', {
                    durationMs: Date.now() - start,
                    name: task.name,
                });
            } catch (error) {
                this.logger.error('task:error', { error, name: task.name });
            }
        };

        const cronTask = cron.schedule(task.schedule, () => {
            void executeSafely();
        });

        this.scheduledTasks.push(cronTask);

        if (task.executeOnStartup) {
            this.logger.debug('task:startup', { name: task.name });
            void executeSafely();
        }

        cronTask.start();

        // Allow process to exit if cron timers are the only event-loop handles.
        const timerHandle = (cronTask as unknown as { timer?: NodeJS.Timeout }).timer;
        timerHandle?.unref?.();
    }
}
