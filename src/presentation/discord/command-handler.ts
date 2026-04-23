import { ChatInputCommandInteraction } from 'discord.js';
import { Logger } from 'pino';
import { BASE_GRANDCHASE_SYSTEM_PROMPT } from '../../application/constants/game-prompts';
import {
  ThrottleConfig,
} from '../../application/use-cases/check-throttle/check-throttle.use-case';
import { AskQuestionUseCase } from '../../application/use-cases/ask-question/ask-question.use-case';
import { SearchWikiUseCase } from '../../application/use-cases/search-wiki/search-wiki.use-case';
import { SearchWebUseCase } from '../../application/use-cases/search-web/search-web.use-case';
import { GetEquipmentAdviceUseCase } from '../../application/use-cases/get-equipment-advice/get-equipment-advice.use-case';
import { GetFarmingStrategyUseCase } from '../../application/use-cases/get-farming-strategy/get-farming-strategy.use-case';
import { GetDamageTipsUseCase } from '../../application/use-cases/get-damage-tips/get-damage-tips.use-case';
import { AddKnowledgeUseCase } from '../../application/use-cases/add-knowledge/add-knowledge.use-case';
import { ListSessionsUseCase } from '../../application/use-cases/list-sessions/list-sessions.use-case';
import { SwitchSessionUseCase } from '../../application/use-cases/switch-session/switch-session.use-case';
import { DeleteSessionUseCase } from '../../application/use-cases/delete-session/delete-session.use-case';

export interface CommandConfig {
  throttle: ThrottleConfig;
  sessionInactivityMinutes: number;
}

export interface UseCases {
  askQuestion: AskQuestionUseCase;
  searchWiki: SearchWikiUseCase;
  searchWeb: SearchWebUseCase;
  getEquipmentAdvice: GetEquipmentAdviceUseCase;
  getFarmingStrategy: GetFarmingStrategyUseCase;
  getDamageTips: GetDamageTipsUseCase;
  addKnowledge: AddKnowledgeUseCase;
  listSessions: ListSessionsUseCase;
  switchSession: SwitchSessionUseCase;
  deleteSession: DeleteSessionUseCase;
}

const HELP_TEXT = `**Comandos disponíveis:**

\`/ask question\` — Faça uma pergunta geral sobre GrandChase
\`/wiki question\` — Pesquisa informações diretamente na wiki do GrandChase
\`/web question\` — Busca informações atualizadas da comunidade (Reddit, fóruns)
\`/equipment character slot\` — Melhor carta para um slot de equipamento
\`/farming target\` — Melhor lugar para farmar um item
\`/damage character\` — Dicas para maximizar o dano de um personagem
\`/add-knowledge content\` — Adicionar conhecimento útil sobre o jogo
\`/session list\` — Listar suas sessões recentes
\`/session switch session_id\` — Retomar uma sessão existente
\`/session delete session_id\` — Deletar uma sessão
\`/help\` — Mostrar esta mensagem`;

const MAX_MESSAGE_LENGTH = 2000;

function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt <= 0) splitAt = maxLength;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export class CommandHandler {
  constructor(
    private readonly useCases: UseCases,
    private readonly commandConfig: CommandConfig,
    private readonly logger: Logger,
  ) {}

  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const handlers: Record<string, () => Promise<void>> = {
      ask: () => this.handleAsk(interaction),
      wiki: () => this.handleWiki(interaction),
      web: () => this.handleWeb(interaction),
      equipment: () => this.handleEquipment(interaction),
      farming: () => this.handleFarming(interaction),
      damage: () => this.handleDamage(interaction),
      'add-knowledge': () => this.handleAddKnowledge(interaction),
      session: () => this.handleSession(interaction),
      help: () => this.handleHelp(interaction),
    };

    const handler = handlers[interaction.commandName];
    if (!handler) return;

    this.logger.info(
      {
        userId: interaction.user.id,
        username: interaction.user.username,
        channelId: interaction.channelId,
        command: interaction.commandName,
      },
      '[EVENT IN] User interaction received',
    );

    try {
      await interaction.deferReply();
      await handler();
      this.logger.info(
        { userId: interaction.user.id, command: interaction.commandName },
        '[EVENT OUT] Response sent to user',
      );
    } catch (error) {
      this.logger.error({ error, command: interaction.commandName }, 'Command error');
      await interaction.editReply('Ocorreu um erro inesperado. Tente novamente.'); // always short
    }
  }

  private async handleAsk(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = interaction.options.getString('question', true);
    const { id: discordUserId, username } = interaction.user;
    const { channelId } = interaction;

    const output = await this.useCases.askQuestion.execute({
      discordUserId,
      channelId,
      username,
      question,
      systemPrompt: BASE_GRANDCHASE_SYSTEM_PROMPT,
      throttle: this.commandConfig.throttle,
      sessionInactivityMinutes: this.commandConfig.sessionInactivityMinutes,
    });

    await this.sendReply(interaction, output.warningMessage ?? output.answer);
  }

  private async handleWiki(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = interaction.options.getString('question', true);
    const { id: discordUserId, username } = interaction.user;
    const { channelId } = interaction;

    const output = await this.useCases.searchWiki.execute({
      discordUserId,
      channelId,
      username,
      question,
      throttle: this.commandConfig.throttle,
      sessionInactivityMinutes: this.commandConfig.sessionInactivityMinutes,
    });

    await this.sendReply(interaction, output.warningMessage ?? output.answer);
  }

  private async handleWeb(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = interaction.options.getString('question', true);
    const { id: discordUserId, username } = interaction.user;
    const { channelId } = interaction;

    const output = await this.useCases.searchWeb.execute({
      discordUserId,
      channelId,
      username,
      question,
      throttle: this.commandConfig.throttle,
      sessionInactivityMinutes: this.commandConfig.sessionInactivityMinutes,
    });

    await this.sendReply(interaction, output.warningMessage ?? output.answer);
  }

  private async handleEquipment(interaction: ChatInputCommandInteraction): Promise<void> {
    const character = interaction.options.getString('character', true);
    const slot = interaction.options.getString('slot', true);
    const { id: discordUserId, username } = interaction.user;
    const { channelId } = interaction;

    const output = await this.useCases.getEquipmentAdvice.execute({
      discordUserId,
      channelId,
      username,
      character,
      slot,
      throttle: this.commandConfig.throttle,
      sessionInactivityMinutes: this.commandConfig.sessionInactivityMinutes,
    });

    await this.sendReply(interaction, output.warningMessage ?? output.answer);
  }

  private async handleFarming(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getString('target', true);
    const { id: discordUserId, username } = interaction.user;
    const { channelId } = interaction;

    const output = await this.useCases.getFarmingStrategy.execute({
      discordUserId,
      channelId,
      username,
      target,
      throttle: this.commandConfig.throttle,
      sessionInactivityMinutes: this.commandConfig.sessionInactivityMinutes,
    });

    await this.sendReply(interaction, output.warningMessage ?? output.answer);
  }

  private async handleDamage(interaction: ChatInputCommandInteraction): Promise<void> {
    const character = interaction.options.getString('character', true);
    const { id: discordUserId, username } = interaction.user;
    const { channelId } = interaction;

    const output = await this.useCases.getDamageTips.execute({
      discordUserId,
      channelId,
      username,
      character,
      throttle: this.commandConfig.throttle,
      sessionInactivityMinutes: this.commandConfig.sessionInactivityMinutes,
    });

    await this.sendReply(interaction, output.warningMessage ?? output.answer);
  }

  private async handleAddKnowledge(interaction: ChatInputCommandInteraction): Promise<void> {
    const content = interaction.options.getString('content', true);
    const { id: discordUserId } = interaction.user;

    const entry = await this.useCases.addKnowledge.execute({
      rawContent: content,
      addedByUserId: discordUserId,
    });

    await this.sendReply(
      interaction,
      `✅ Conhecimento adicionado com ${entry.tags.length} tags: ${entry.tags.join(', ')}.`,
    );
  }

  private async handleSession(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const { id: discordUserId } = interaction.user;
    const { channelId } = interaction;

    if (subcommand === 'list') {
      const sessions = await this.useCases.listSessions.execute({ discordUserId });

      if (sessions.length === 0) {
        await interaction.editReply('Nenhuma sessão encontrada.');
        return;
      }

      const lines = sessions.map(
        (s) =>
          `• \`${s.id}\` — ${s.title ?? 'Sem título'} — ${this.formatRelativeTime(s.lastActiveAt)}`,
      );
      await this.sendReply(interaction, lines.join('\n'));
      return;
    }

    if (subcommand === 'switch') {
      const sessionId = interaction.options.getString('session_id', true);
      const session = await this.useCases.switchSession.execute({
        sessionId,
        discordUserId,
        channelId,
      });
      await this.sendReply(interaction, `✅ Sessão "${session.title ?? sessionId}" ativada.`);
      return;
    }

    if (subcommand === 'delete') {
      const sessionId = interaction.options.getString('session_id', true);
      try {
        await this.useCases.deleteSession.execute({ sessionId, discordUserId });
        await this.sendReply(interaction, '🗑️ Sessão deletada com sucesso.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao deletar sessão.';
        await this.sendReply(interaction, message);
      }
    }
  }

  private async handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
    await this.sendReply(interaction, HELP_TEXT);
  }

  private async sendReply(
    interaction: ChatInputCommandInteraction,
    content: string,
  ): Promise<void> {
    if (content.length <= MAX_MESSAGE_LENGTH) {
      await interaction.editReply(content);
      return;
    }

    const chunks = splitIntoChunks(content, MAX_MESSAGE_LENGTH);
    await interaction.editReply(chunks[0]);
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp(chunks[i]);
    }
  }

  private formatRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora mesmo';
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h atrás`;
    return `${Math.floor(diffH / 24)}d atrás`;
  }
}
