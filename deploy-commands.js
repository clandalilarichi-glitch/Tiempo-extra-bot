
require('dotenv').config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const comandos = [

  new SlashCommandBuilder()
    .setName('quiniela')
    .setDescription('Realizar los pronósticos de la jornada'),

  new SlashCommandBuilder()
    .setName('mispronosticos')
    .setDescription('Consultar mis pronósticos'),

  new SlashCommandBuilder()
    .setName('clasificacion')
    .setDescription('Ver la clasificación de la quiniela'),

  new SlashCommandBuilder()
    .setName('crearjornada')
    .setDescription('Crear una nueva jornada')
    .addStringOption(o => o.setName('nombre').setDescription('Nombre de la jornada').setRequired(true))
    .addStringOption(o => o.setName('partido1').setDescription('Partido 1: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido2').setDescription('Partido 2: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido3').setDescription('Partido 3: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido4').setDescription('Partido 4: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido5').setDescription('Partido 5: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido6').setDescription('Partido 6: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido7').setDescription('Partido 7: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido8').setDescription('Partido 8: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido9').setDescription('Partido 9: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido10').setDescription('Partido 10: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido11').setDescription('Partido 11: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido12').setDescription('Partido 12: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido13').setDescription('Partido 13: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('partido14').setDescription('Partido 14: Local - Visitante').setRequired(true))
    .addStringOption(o => o.setName('pleno_local').setDescription('Equipo local del Pleno al 15').setRequired(true))
    .addStringOption(o => o.setName('pleno_visitante').setDescription('Equipo visitante del Pleno al 15').setRequired(true))
    .addStringOption(o => o.setName('apertura').setDescription('Apertura: DD/MM/AAAA HH:mm').setRequired(true))
    .addStringOption(o => o.setName('cierre').setDescription('Cierre: DD/MM/AAAA HH:mm').setRequired(true)),

  new SlashCommandBuilder()
    .setName('jornadas')
    .setDescription('Consultar las jornadas registradas'),

  new SlashCommandBuilder()
    .setName('eliminarjornada')
    .setDescription('Eliminar una jornada registrada'),

  new SlashCommandBuilder()
    .setName('resultados')
    .setDescription('Introducir los resultados de una jornada')
    .addBooleanOption(o => o.setName('jornada_finalizada').setDescription('Confirmar que todos los partidos han terminado').setRequired(true))
    .addStringOption(o => o.setName('partido1').setDescription('Resultado partido 1: 1, X o 2').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido2').setDescription('Resultado partido 2').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido3').setDescription('Resultado partido 3').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido4').setDescription('Resultado partido 4').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido5').setDescription('Resultado partido 5').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido6').setDescription('Resultado partido 6').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido7').setDescription('Resultado partido 7').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido8').setDescription('Resultado partido 8').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido9').setDescription('Resultado partido 9').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido10').setDescription('Resultado partido 10').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido11').setDescription('Resultado partido 11').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido12').setDescription('Resultado partido 12').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido13').setDescription('Resultado partido 13').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('partido14').setDescription('Resultado partido 14').setRequired(true).addChoices(
      { name: '1', value: '1' }, { name: 'X', value: 'X' }, { name: '2', value: '2' }
    ))
    .addStringOption(o => o.setName('pleno_local').setDescription('Goles del equipo local').setRequired(true).addChoices(
      { name: '0', value: '0' }, { name: '1', value: '1' }, { name: '2', value: '2' }, { name: '3 o más', value: 'M' }
    ))
    .addStringOption(o => o.setName('pleno_visitante').setDescription('Goles del equipo visitante').setRequired(true).addChoices(
      { name: '0', value: '0' }, { name: '1', value: '1' }, { name: '2', value: '2' }, { name: '3 o más', value: 'M' }
    )),

  new SlashCommandBuilder()
    .setName('repartirpremios')
    .setDescription('Repartir los premios de una jornada')

].map(comando => comando.toJSON());

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
