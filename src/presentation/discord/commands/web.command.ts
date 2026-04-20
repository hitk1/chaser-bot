import { SlashCommandBuilder } from 'discord.js';

export const webCommand = new SlashCommandBuilder()
  .setName('web')
  .setDescription('Busca informações atualizadas da comunidade GrandChase (Reddit, fóruns, wiki)')
  .addStringOption((opt) =>
    opt.setName('question').setDescription('O que você quer pesquisar?').setRequired(true),
  );
