import { Client } from 'discord.js';
import { Logger } from 'pino';
import { CommandHandler } from './command-handler';

export class EventHandler {
  constructor(
    private readonly client: Client,
    private readonly commandHandler: CommandHandler,
    private readonly logger: Logger,
  ) {}

  register(): void {
    this.client.once('ready', (readyClient) => {
      this.logger.info({ tag: readyClient.user.tag }, 'Bot online');
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.commandHandler.handle(interaction);
    });
  }
}
