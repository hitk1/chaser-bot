import { SlashCommandBuilder } from 'discord.js';

export const sessionCommand = new SlashCommandBuilder()
  .setName('session')
  .setDescription('Gerenciar sessões de conversa')
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar suas sessões recentes'))
  .addSubcommand((sub) =>
    sub
      .setName('switch')
      .setDescription('Retomar uma sessão existente')
      .addStringOption((opt) =>
        opt.setName('session_id').setDescription('ID da sessão').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('Deletar uma sessão')
      .addStringOption((opt) =>
        opt.setName('session_id').setDescription('ID da sessão').setRequired(true),
      ),
  );
