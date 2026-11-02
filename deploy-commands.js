
const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

// RESULTADOS
const resultados = new SlashCommandBuilder()
  .setName('resultados')
  .setDescription('Introduce los resultados reales de la jornada')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addBooleanOption(option =>
    option
      .setName('jornada_finalizada')
      .setDescription('Confirma que los 15 partidos ya han terminado')
      .setRequired(true)
  );

for (let i = 1; i <= 14; i++) {
  resultados.addStringOption(option =>
    option
      .setName(`partido${i}`)
      .setDescription(`Resultado real del partido ${i}`)
      .setRequired(true)
      .addChoices(
        { name: '1', value: '1' },
        { name: 'X', value: 'X' },
        { name: '2', value: '2' }
      )
  );
}

resultados
  .addStringOption(option =>
    option
      .setName('pleno_local')
      .setDescription('Goles del equipo local del Pleno')
      .setRequired(true)
      .addChoices(
        { name: '0', value: '0' },
        { name: '1', value: '1' },
        { name: '2', value: '2' },
        { name: 'M (3 o más)', value: 'M' }
      )
  )
  .addStringOption(option =>
    option
      .setName('pleno_visitante')
      .setDescription('Goles del equipo visitante del Pleno')
      .setRequired(true)
      .addChoices(
        { name: '0', value: '0' },
        { name: '1', value: '1' },
        { name: '2', value: '2' },
        { name: 'M (3 o más)', value: 'M' }
      )
  );

// CREAR JORNADA
const crearJornada = new SlashCommandBuilder()
  .setName('crearjornada')
  .setDescription('Prepara una nueva jornada para su aprobación')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option
      .setName('nombre')
      .setDescription('Nombre de la nueva jornada')
      .setRequired(true)
  );

for (let i = 1; i <= 14; i++) {
  crearJornada.addStringOption(option =>
    option
      .setName(`partido${i}`)
      .setDescription(`Partido ${i}: Local - Visitante`)
      .setRequired(true)
  );
}

crearJornada
  .addStringOption(option =>
    option
      .setName('pleno_local')
      .setDescription('Equipo local del Pleno al 15')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('pleno_visitante')
      .setDescription('Equipo visitante del Pleno al 15')
      .setRequired(true)
  );

// REPARTIR PREMIOS
const repartirPremios = new SlashCommandBuilder()
  .setName('repartirpremios')
  .setDescription('Reparte los premios del podio')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// RESTO DE COMANDOS
const comandos = [
  new SlashCommandBuilder()
    .setName('quiniela')
    .setDescription('Rellena tu quiniela de Tiempo Extra'),

  new SlashCommandBuilder()
    .setName('mispronosticos')
    .setDescription('Consulta tus pronósticos confirmados'),

  new SlashCommandBuilder()
    .setName('clasificacion')
    .setDescription('Consulta la clasificación de la jornada'),

  resultados,
  crearJornada,
  repartirPremios
].map(comando => comando.toJSON());

// REGISTRO
const rest = new REST({ version: '10' })
  .setToken(process.env.DISCORD_TOKEN);

async function registrarComandos() {
  try {
    console.log('🔄 Registrando comandos...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: comandos }
    );

    console.log('✅ Los 6 comandos se han registrado correctamente.');
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
  }
}

registrarComandos();
