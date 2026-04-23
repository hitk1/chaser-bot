import { Logger } from 'pino';
import { IWebSearchService, SearchResult } from '../../ports/web-search.port';
import { AskQuestionUseCase } from '../ask-question/ask-question.use-case';
import { AskQuestionInput, AskQuestionOutput } from '../ask-question/ask-question.dto';

export type SearchWebInput = Omit<AskQuestionInput, 'systemPrompt'>;

function buildWebSearchSystemPrompt(question: string, results: SearchResult[]): string {
  const resultsContent =
    results.length > 0
      ? results
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nFonte: ${r.url}`)
          .join('\n\n')
      : 'AVISO: Nenhum resultado encontrado na busca web. Informe o usuário antes de responder com conhecimento geral.';

  return `Você é um assistente especializado no GrandChase MMORPG.

<web-search-results>
Query buscada: "${question}"

${resultsContent}
</web-search-results>

Regras:
1. Baseie sua resposta nos resultados acima, priorizando fontes do Reddit (r/Grandchase) e grandchase.fandom.com.
2. Prefira opiniões e estratégias recentes da comunidade em vez de conhecimento estático.
3. Se os resultados não forem relevantes ou não houver resultados, informe o usuário claramente antes de usar conhecimento geral.
Responda sempre em português do Brasil.`;
}

export class SearchWebUseCase {
  constructor(
    private readonly webSearch: IWebSearchService | null,
    private readonly askQuestion: AskQuestionUseCase,
    private readonly logger: Logger,
  ) {}

  async execute(input: SearchWebInput): Promise<AskQuestionOutput> {
    const { discordUserId, username, channelId, question } = input;
    let results: SearchResult[] = [];

    this.logger.info(
      { discordUserId, username, channelId, question },
      '[SEARCH-WEB][USE-CASE] Processing web question',
    );

    if (!this.webSearch) {
      this.logger.warn(
        { discordUserId },
        '[SEARCH-WEB][USE-CASE] No web search service configured (SEARCH_API_KEY not set)',
      );
    } else {
      const query = `GrandChase ${question.slice(0, 150)}`;
      this.logger.info({ discordUserId, query }, '[SEARCH-WEB][USE-CASE] Searching web');
      try {
        results = await this.webSearch.search(query);
        this.logger.info(
          { discordUserId, query, resultCount: results.length, urls: results.map((r) => r.url) },
          '[SEARCH-WEB][USE-CASE] Web search completed',
        );
      } catch (error) {
        this.logger.warn(
          { discordUserId, error },
          '[SEARCH-WEB][USE-CASE] Web search failed, proceeding without results',
        );
      }
    }

    const systemPrompt = buildWebSearchSystemPrompt(question, results);
    const output = await this.askQuestion.execute({ ...input, systemPrompt });

    this.logger.info(
      { discordUserId, sessionId: output.sessionId, throttled: !!output.warningMessage },
      '[SEARCH-WEB][USE-CASE] Question processed',
    );

    return output;
  }
}
