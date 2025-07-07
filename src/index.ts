import { createContainer } from './di/container.js';

const start = async () => {
    const container = createContainer();
    const logger = container.get('Logger');
    const config = container.get('Configuration');
    const newRelic = container.get('NewRelic');
    const server = container.get('Server');
    const worker = container.get('Worker');

    try {
        logger.info('Starting application');

        const { host, port } = config.getInboundConfiguration().http;

        await newRelic.initialize();
        await worker.initialize();
        await server.start({
            host,
            port,
        });

        logger.info('Application started successfully ✓');
    } catch (error) {
        logger.error('Failed to start application ✗', { error });
        process.exit(1);
    }
};

start();
