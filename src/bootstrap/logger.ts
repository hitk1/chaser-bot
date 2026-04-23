import pino from 'pino';

export function createLogger(component: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const level = process.env.LOG_LEVEL ?? (isTest ? 'silent' : 'info');

  const logger = pino(
    { level },
    isProduction
      ? undefined
      : pino.transport({ target: 'pino-pretty', options: { colorize: true , singleLine: true} }),
  );

  return logger.child({ component });
}
