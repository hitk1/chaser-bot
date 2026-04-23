import { ChatInputCommandInteraction } from 'discord.js';
import { Logger } from 'pino';
import { ISessionRepository } from '../../domain/session/session.repository';
import { ThrottleConfig } from '../../application/use-cases/check-throttle/check-throttle.use-case';
import { SearchWikiUseCase } from '../../application/use-cases/search-wiki/search-wiki.use-case';
import { SearchWebUseCase } from '../../application/use-cases/search-web/search-web.use-case';
import { HandleReplyUseCase } from '../../application/use-cases/handle-reply/handle-reply.use-case';
import { HandleReplyInput } from '../../application/use-cases/handle-reply/handle-reply.dto';

export interface CommandConfig {
  throttle: ThrottleConfig;
  sessionInactivityMinutes: number;
}

export interface UseCases {
  searchWiki: SearchWikiUseCase;
  searchWeb: SearchWebUseCase;
  handleReply: HandleReplyUseCase;
  sessionRepository: ISessionRepository;
}

const MAX_MESSAGE_LENGTH = 2000;

export function splitIntoChunks(text: string, maxLength: number): string[] {
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
      await interaction.editReply('Ocorreu um erro inesperado. Tente novamente.');
    }
  }

  private async handleAsk(interaction: ChatInputCommandInteraction): Promise<void> {
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

    if (output.warningMessage) {
      await interaction.editReply(output.warningMessage);
      return;
    }

    const chunks = splitIntoChunks(output.answer, MAX_MESSAGE_LENGTH);
    const sentMsg = await interaction.editReply(chunks[0]);
    await this.useCases.sessionRepository.linkDiscordMessageToSession(output.sessionId, sentMsg.id);

    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp(chunks[i]);
    }
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

  public async handleReply(input: HandleReplyInput): Promise<string> {
    const output = await this.useCases.handleReply.execute(input);
    return output.warningMessage ?? output.answer;
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
}
