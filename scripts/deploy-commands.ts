import { REST, Routes } from 'discord.js';
import { config } from '../src/bootstrap/env';
import { askCommand } from '../src/presentation/discord/commands/ask.command';
import { equipmentCommand } from '../src/presentation/discord/commands/equipment.command';
import { farmingCommand } from '../src/presentation/discord/commands/farming.command';
import { damageCommand } from '../src/presentation/discord/commands/damage.command';
import { addKnowledgeCommand } from '../src/presentation/discord/commands/add-knowledge.command';
import { sessionCommand } from '../src/presentation/discord/commands/session.command';
import { helpCommand } from '../src/presentation/discord/commands/help.command';

const body = [
  askCommand,
  equipmentCommand,
  farmingCommand,
  damageCommand,
  addKnowledgeCommand,
  sessionCommand,
  helpCommand,
].map((c) => c.toJSON());

const rest = new REST().setToken(config.DISCORD_BOT_TOKEN);

await rest.put(
  Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
  { body },
);

console.log(`✅ ${body.length} slash commands registered successfully.`);
