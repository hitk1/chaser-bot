import { SlashCommandBuilder } from 'discord.js';

export const equipmentCommand = new SlashCommandBuilder()
  .setName('equipment')
  .setDescription('Melhor carta para um slot de equipamento')
  .addStringOption((opt) =>
    opt.setName('character').setDescription('Nome do personagem').setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName('slot').setDescription('Slot do equipamento').setRequired(true),
  );
