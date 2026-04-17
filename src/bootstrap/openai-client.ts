import OpenAI from 'openai';
import { Config } from './env';

export function createOpenAiClient(config: Config): OpenAI {
  return new OpenAI({ apiKey: config.OPENAI_API_KEY });
}
