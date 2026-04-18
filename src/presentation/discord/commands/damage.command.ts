import { SlashCommandBuilder } from 'discord.js';

export const damageCommand = new SlashCommandBuilder()
  .setName('damage')
  .setDescription('Dicas para maximizar o dano de um personagem')
  .addStringOption((opt) =>
    opt.setName('character').setDescription('Nome do personagem').setRequired(true),
  );
