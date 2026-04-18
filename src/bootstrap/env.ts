import { z } from 'zod';

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().optional(),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(1024),

  SEARCH_API_KEY: z.string().optional(),
  SEARCH_PROVIDER: z.enum(['brave', 'serper']).default('brave'),

  DATABASE_URL: z.string().min(1),

  THROTTLE_MAX_REQUESTS: z.coerce.number().default(5),
  THROTTLE_WINDOW_SECONDS: z.coerce.number().default(60),
  THROTTLE_WARNING_MESSAGE: z
    .string()
    .default('Hey {username}, calma aí! Aguarde um momento antes de enviar mais mensagens.'),

  SESSION_INACTIVITY_MINUTES: z.coerce.number().default(10),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
});

export type Config = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const config: Config = result.data;
