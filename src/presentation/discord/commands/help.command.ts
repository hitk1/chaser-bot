import { SlashCommandBuilder } from 'discord.js';

export const helpCommand = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Listar todos os comandos disponíveis');
