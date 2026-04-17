import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  base: {
    service: 'obsidian-lens',
    timestamp: () => new Date().toISOString(),
  },
  transport: isProduction ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true,
      ignore: 'pid,hostname',
    }
  } : undefined,
});

// Helper for job-specific logging
export function jobLogger(jobId: string, stage?: string) {
  return logger.child({ jobId, stage });
}

export default logger;
