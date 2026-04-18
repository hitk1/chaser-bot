import { SlashCommandBuilder } from 'discord.js';

export const farmingCommand = new SlashCommandBuilder()
  .setName('farming')
  .setDescription('Melhor lugar para farmar um item')
  .addStringOption((opt) =>
    opt.setName('target').setDescription('Item ou recurso alvo').setRequired(true),
  );
