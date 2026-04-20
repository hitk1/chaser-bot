import { SlashCommandBuilder } from 'discord.js';

export const wikiCommand = new SlashCommandBuilder()
  .setName('wiki')
  .setDescription('Busca informações diretamente na wiki do GrandChase (grandchase.fandom.com)')
  .addStringOption((opt) =>
    opt.setName('question').setDescription('O que você quer pesquisar na wiki?').setRequired(true),
  );
