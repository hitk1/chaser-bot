import { SlashCommandBuilder } from 'discord.js';

export const addKnowledgeCommand = new SlashCommandBuilder()
  .setName('add-knowledge')
  .setDescription('Adicionar conhecimento útil sobre o jogo')
  .addStringOption((opt) =>
    opt.setName('content').setDescription('Conteúdo a adicionar').setRequired(true),
  );
