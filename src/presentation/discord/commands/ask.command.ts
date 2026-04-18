import { SlashCommandBuilder } from 'discord.js';

export const askCommand = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Faça uma pergunta sobre GrandChase')
  .addStringOption((opt) =>
    opt.setName('question').setDescription('Sua pergunta').setRequired(true),
  );
