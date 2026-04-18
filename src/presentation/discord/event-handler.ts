import { Client } from 'discord.js';
import { Logger } from 'pino';
import { CommandHandler } from './command-handler';

export interface CommandRegistrar {
  registerForGuild(guildId: string): Promise<void>;
}

export class EventHandler {
  constructor(
    private readonly client: Client,
    private readonly commandHandler: CommandHandler,
    private readonly logger: Logger,
    private readonly registrar: CommandRegistrar,
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
  }
}
