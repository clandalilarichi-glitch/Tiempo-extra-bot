
require('dotenv').config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
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
    .setDescription('Crear una nueva jornada'),

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
