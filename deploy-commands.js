
require('dotenv').config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const comandos = [

  // 🎟️ Quiniela
  new SlashCommandBuilder()
    .setName('quiniela')
    .setDescription('Realizar los pronósticos de la jornada'),

  new SlashCommandBuilder()
    .setName('mispronosticos')
    .setDescription('Consultar mis pronósticos'),

  new SlashCommandBuilder()
    .setName('clasificacion')
    .setDescription('Ver la clasificación de la quiniela'),

  // 🏆 Jornadas
  new SlashCommandBuilder()
    .setName('crearjornada')
    .setDescription('Crear una nueva jornada')
    .addStringOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de la jornada')
        .setRequired(true)
    )
    .addStringOption(option => option.setName('partido1').setDescription('Partido 1: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido2').setDescription('Partido 2: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido3').setDescription('Partido 3: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido4').setDescription('Partido 4: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido5').setDescription('Partido 5: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido6').setDescription('Partido 6: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido7').setDescription('Partido 7: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido8').setDescription('Partido 8: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido9').setDescription('Partido 9: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido10').setDescription('Partido 10: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido11').setDescription('Partido 11: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido12').setDescription('Partido 12: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido13').setDescription('Partido 13: Local - Visitante').setRequired(true))
    .addStringOption(option => option.setName('partido14').setDescription('Partido 14: Local - Visitante').setRequired(true))
    .addStringOption(option =>
      option.setName('pleno_local')
        .setDescription('Equipo local del Pleno al 15')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('pleno_visitante')
        .setDescription('Equipo visitante del Pleno al 15')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('jornadas')
    .setDescription('Consultar las jornadas registradas'),

  new SlashCommandBuilder()
    .setName('eliminarjornada')
    .setDescription('Eliminar una jornada registrada'),

  // ⚽ Resultados
  new SlashCommandBuilder()
    .setName('resultados')
    .setDescription('Introducir los resultados de una jornada'),

  new SlashCommandBuilder()
    .setName('repartirpremios')
    .setDescription('Repartir los premios de una jornada')

].map(comando => comando.toJSON());

// Registrar comandos
const rest = new REST({ version: '10' })
  .setToken(process.env.DISCORD_TOKEN);

async function registrarComandos() {
  try {
    console.log('Registrando comandos...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: comandos }
    );

    console.log('✅ Comandos registrados correctamente.');
  } catch (error) {
    console.error('❌ Error al registrar comandos:', error);
  }
}

registrarComandos();
