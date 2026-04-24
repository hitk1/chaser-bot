import { Client } from 'discord.js';
import { Logger } from 'pino';
import { CommandHandler, CommandConfig, splitIntoChunks } from './command-handler';

const MAX_MESSAGE_LENGTH = 2000;

export interface CommandRegistrar {
  registerForGuild(guildId: string): Promise<void>;
}

export class EventHandler {
  constructor(
    private readonly client: Client,
    private readonly commandHandler: CommandHandler,
    private readonly logger: Logger,
    private readonly registrar: CommandRegistrar,
    private readonly commandConfig: CommandConfig,
  ) {}

  register(): void {
    this.client.once('ready', async (readyClient) => {
      this.logger.info({ tag: readyClient.user.tag }, 'Bot online');

      const guilds = [...readyClient.guilds.cache.values()];
      this.logger.info({ guildCount: guilds.length }, 'Registering commands for existing guilds');

      for (const guild of guilds) {
        try {
          await this.registrar.registerForGuild(guild.id);
        } catch (error) {
          this.logger.error({ error, guildId: guild.id }, 'Failed to register commands for guild');
        }
      }
    });

    this.client.on('guildCreate', async (guild) => {
      this.logger.info({ guildId: guild.id, guildName: guild.name }, '[EVENT IN] Joined new guild');
      try {
        await this.registrar.registerForGuild(guild.id);
      } catch (error) {
        this.logger.error({ error, guildId: guild.id }, 'Failed to register commands for new guild');
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.commandHandler.handle(interaction);
    });

    this.client.on('messageCreate', async (message) => {
      // Ignore bots (including ourselves)
      if (message.author.bot) return;

      // Only handle replies to other messages
      if (!message.reference?.messageId) return;

      const repliedToMessageId = message.reference.messageId;

      // Confirm the replied-to message belongs to this bot
      const repliedTo = await message.channel.messages
        .fetch(repliedToMessageId)
        .catch(() => null);

      if (!repliedTo || repliedTo.author.id !== this.client.user?.id) return;

      this.logger.info(
        {
          userId: message.author.id,
          username: message.author.username,
          channelId: message.channelId,
          repliedToMessageId,
        },
        '[EVENT IN] User replied to bot message',
      );

      try {
        const output = await this.commandHandler.handleReply({
          discordUserId: message.author.id,
          username: message.author.username,
          channelId: message.channelId,
          question: message.content,
          repliedToMessageId,
          throttle: this.commandConfig.throttle,
          sessionInactivityMinutes: this.commandConfig.sessionInactivityMinutes,
        });

        const text = output.warningMessage ?? output.answer;
        const chunks = splitIntoChunks(text, MAX_MESSAGE_LENGTH);

        const sentMsg = await message.reply(chunks[0]);

        // Link the new bot message ID so the chain can continue with further replies
        if (!output.warningMessage && output.sessionId && sentMsg) {
          await this.commandHandler.linkMessageToSession(output.sessionId, sentMsg.id);
        }

        for (const chunk of chunks.slice(1)) {
          await message.channel.send(chunk);
        }

        this.logger.info(
          { userId: message.author.id, sessionId: output.sessionId },
          '[EVENT OUT] Reply sent to user',
        );
      } catch (error) {
        this.logger.error({ error, userId: message.author.id }, 'Reply handler error');
        await message.reply('Ocorreu um erro inesperado. Tente novamente.').catch(() => null);
      }
    });
  }
}
