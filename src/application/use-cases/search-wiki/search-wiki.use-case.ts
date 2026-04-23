import { Logger } from 'pino';
import { IWikiSearchService, WikiSearchResult } from '../../ports/wiki-search.port';
import { AskQuestionUseCase } from '../ask-question/ask-question.use-case';
import { AskQuestionInput, AskQuestionOutput } from '../ask-question/ask-question.dto';

export type SearchWikiInput = Omit<AskQuestionInput, 'systemPrompt'>;

function buildWikiSystemPrompt(question: string, result: WikiSearchResult | null): string {
  const wikiContent = result
    ? `Tópico buscado: "${question}"\n\n**${result.pageTitle}**\n\n${result.extract}`
    : `Nenhum resultado encontrado na wiki para "${question}".`;

  return `Você é um assistente especializado no GrandChase MMORPG.

<wiki-results>
${wikiContent}
</wiki-results>

Regras:
1. Baseie sua resposta exclusivamente nos resultados da wiki acima.
2. Complemente com conhecimento geral apenas se a wiki for insuficiente.
3. Se não houver resultados, informe o usuário claramente antes de responder.
4. Cite o título da página da wiki quando usar seus dados.
Responda sempre em português do Brasil.`;
}

export class SearchWikiUseCase {
  constructor(
    private readonly wikiSearch: IWikiSearchService,
    private readonly askQuestion: AskQuestionUseCase,
    private readonly logger: Logger,
  ) {}

  async execute(input: SearchWikiInput): Promise<AskQuestionOutput> {
    const { discordUserId, username, channelId, question } = input;

    this.logger.info(
      { discordUserId, username, channelId, question },
      '[SEARCH-WIKI][USE-CASE] Processing wiki question',
    );

    const wikiResult = await this.wikiSearch.search(question);

    this.logger.info(
      { discordUserId, question, found: wikiResult !== null, pageTitle: wikiResult?.pageTitle },
      '[SEARCH-WIKI][USE-CASE] Wiki search completed',
    );

    const systemPrompt = buildWikiSystemPrompt(question, wikiResult);
    const output = await this.askQuestion.execute({ ...input, systemPrompt });

    this.logger.info(
      { discordUserId, sessionId: output.sessionId, throttled: !!output.warningMessage },
      '[SEARCH-WIKI][USE-CASE] Question processed',
    );

    return output;
  }
}
