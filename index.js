const fs = require('fs');
const path = require('path');

const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ALMACENAMIENTO PERSISTENTE FADEHOST
const DATA_DIR = process.env.DATA_DIR || __dirname;

const ARCHIVO = path.join(DATA_DIR, 'quinielas.json');
const ARCHIVO_JORNADAS = path.join(DATA_DIR, 'jornadas.json');

const CANAL_JORNADAS = '1552467310441402450';

let configuracionJornadas;
let JORNADA;
let datosJornada;
let NOMBRE_JORNADA;
let partidos;
let pleno;

let quinielasGuardadas = {};
const pronosticos = new Map();

// CARGAR Y VALIDAR LA JORNADA ACTIVA
function cargarConfiguracionJornadas() {
  if (!fs.existsSync(ARCHIVO_JORNADAS)) {
    throw new Error('No existe el archivo jornadas.json.');
  }

  configuracionJornadas = JSON.parse(
    fs.readFileSync(ARCHIVO_JORNADAS, 'utf8')
  );

  JORNADA = configuracionJornadas.jornadaActiva;
  datosJornada = configuracionJornadas.jornadas?.[JORNADA];

  if (!datosJornada) {
    throw new Error('No se ha encontrado la jornada activa.');
  }

  NOMBRE_JORNADA = datosJornada.nombre;
  partidos = datosJornada.partidos;
  pleno = datosJornada.pleno;

  if (
    !Array.isArray(partidos) ||
    partidos.length !== 14 ||
    !partidos.every(p =>
      Array.isArray(p) &&
      p.length === 2 &&
      p[0] &&
      p[1]
    ) ||
    !Array.isArray(pleno) ||
    pleno.length !== 2 ||
    !pleno[0] ||
    !pleno[1]
  ) {
    throw new Error('La configuración de la jornada no es válida.');
  }
}

// GUARDAR JORNADAS DE FORMA SEGURA
function guardarConfiguracionJornadas() {
  const temporal = ARCHIVO_JORNADAS + '.tmp';

  fs.writeFileSync(
    temporal,
    JSON.stringify(configuracionJornadas, null, 2)
  );

  fs.renameSync(temporal, ARCHIVO_JORNADAS);
}

// CARGAR DATOS DE QUINIELAS
function cargarQuinielas() {
  try {
    if (fs.existsSync(ARCHIVO)) {
      quinielasGuardadas = JSON.parse(
        fs.readFileSync(ARCHIVO, 'utf8')
      );
    } else {
      fs.writeFileSync(ARCHIVO, '{}');
    }

    if (!quinielasGuardadas._resultados) {
      quinielasGuardadas._resultados = {};
    }

    if (!quinielasGuardadas._saldos) {
      quinielasGuardadas._saldos = {};
    }

    if (!quinielasGuardadas[JORNADA]) {
      quinielasGuardadas[JORNADA] = {};
    }

    console.log('💾 Datos cargados correctamente.');
  } catch (error) {
    console.error('Error leyendo datos:', error);
    throw error;
  }
}

// GUARDAR QUINIELAS
function guardarQuinielas() {
  const temporal = ARCHIVO + '.tmp';

  fs.writeFileSync(
    temporal,
    JSON.stringify(quinielasGuardadas, null, 2)
  );

  fs.renameSync(temporal, ARCHIVO);
}

// COMPROBAR ADMINISTRADOR
function esAdministrador(interaction) {
  return Boolean(
    interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    )
  );
}

// CREAR IDENTIFICADOR DE JORNADA
function crearIdJornada(nombre) {
  const base = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 35) || 'JORNADA';

  return `${base}-${Date.now().toString().slice(-8)}`;
}

// LEER PARTIDO ESCRITO COMO "LOCAL - VISITANTE"
function separarPartido(texto, numero) {
  const separador = texto.indexOf('-');

  if (separador <= 0 || separador === texto.length - 1) {
    throw new Error(
      `El partido ${numero} debe escribirse como: Equipo local - Equipo visitante.`
    );
  }

  const local = texto.slice(0, separador).trim();
  const visitante = texto.slice(separador + 1).trim();

  if (!local || !visitante) {
    throw new Error(`El partido ${numero} tiene algún equipo vacío.`);
  }

  return [local, visitante];
}

// CREAR VISTA PREVIA DE UNA JORNADA
function crearEmbedJornada(
  nombre,
  listaPartidos,
  equipoPleno,
  estado = 'pendiente'
) {
  const embed = new EmbedBuilder()
    .setColor(
      estado === 'aprobada' ? 0x00C853 :
      estado === 'rechazada' ? 0xD32F2F :
      0x00AEEF
    )
    .setTitle(`⚽ ${nombre}`)
    .setDescription(
      estado === 'pendiente'
        ? 'Revisa los encuentros. Un administrador debe aprobar o rechazar esta jornada.'
        : estado === 'aprobada'
          ? '✅ Jornada aprobada y activada.'
          : '❌ Jornada rechazada.'
    );

  const lineas = listaPartidos.map((p, i) =>
    `**${i + 1}.** ${p[0]} - ${p[1]}`
  );

  embed.addFields({
    name: '📋 Partidos 1–14',
    value: lineas.join('\n')
  });

  embed.addFields({
    name: '🎯 Pleno al 15',
    value: `${equipoPleno[0]} - ${equipoPleno[1]}`
  });

  return embed;
}

// BOTONES DE APROBACIÓN
function botonesJornada(id, desactivados = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`aprobar_jornada:${id}`)
      .setLabel('Aprobar jornada')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(desactivados),

    new ButtonBuilder()
      .setCustomId(`rechazar_jornada:${id}`)
      .setLabel('Rechazar jornada')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(desactivados)
  );
}

// PROCESAR /CREARJORNADA
async function crearJornadaDesdeComando(interaction) {
  if (!esAdministrador(interaction)) {
    await interaction.reply({
      content: '⛔ Solo los administradores pueden proponer jornadas.',
      ephemeral: true
    });
    return;
  }

  if (configuracionJornadas.jornadaPendiente) {
    await interaction.reply({
      content: '⚠️ Ya hay una jornada pendiente de aprobación. Resuélvela antes de crear otra.',
      ephemeral: true
    });
    return;
  }

  const nombre = interaction.options.getString('nombre', true).trim();

  if (!nombre) {
    await interaction.reply({
      content: '⚠️ Debes indicar el nombre de la jornada.',
      ephemeral: true
    });
    return;
  }

  let listaPartidos;

  try {
    listaPartidos = [];

    for (let i = 1; i <= 14; i++) {
      const texto = interaction.options.getString(`partido${i}`, true);
      listaPartidos.push(separarPartido(texto, i));
    }
  } catch (error) {
    await interaction.reply({
      content: `⚠️ ${error.message}`,
      ephemeral: true
    });
    return;
  }

  const equipoPleno = [
    interaction.options.getString('pleno_local', true).trim(),
    interaction.options.getString('pleno_visitante', true).trim()
  ];

  if (!equipoPleno[0] || !equipoPleno[1]) {
    await interaction.reply({
      content: '⚠️ Debes indicar los dos equipos del Pleno al 15.',
      ephemeral: true
    });
    return;
  }

  const id = crearIdJornada(nombre);
  const canal = await client.channels.fetch(CANAL_JORNADAS).catch(() => null);

  if (!canal || !canal.isTextBased()) {
    await interaction.reply({
      content: '❌ No encuentro el canal de anuncios de jornadas. Comprueba el ID y los permisos del bot.',
      ephemeral: true
    });
    return;
  }

  const embed = crearEmbedJornada(nombre, listaPartidos, equipoPleno);

  let mensaje;

  try {
    mensaje = await canal.send({
      content: '📢 **Nueva jornada pendiente de aprobación**',
      embeds: [embed],
      components: [botonesJornada(id)]
    });
  } catch (error) {
    console.error('No se pudo publicar la vista previa:', error);

    await interaction.reply({
      content: '❌ No he podido publicar la jornada. Comprueba que el bot puede ver y enviar mensajes en el canal.',
      ephemeral: true
    });
    return;
  }

  configuracionJornadas.jornadaPendiente = {
    id,
    datos: {
      nombre,
      estado: 'pendiente',
      fecha: null,
      fuente: 'manual',
      partidos: listaPartidos,
      pleno: equipoPleno
    },
    creadaPor: interaction.user.id,
    creadaEn: new Date().toISOString(),
    mensajeId: mensaje.id,
    canalId: canal.id
  };

  try {
    guardarConfiguracionJornadas();
  } catch (error) {
    console.error('Error guardando la jornada pendiente:', error);

    await mensaje.edit({
      content: '⚠️ No se pudo guardar la propuesta. No la apruebes; contacta con el administrador del bot.',
      components: []
    }).catch(() => {});

    await interaction.reply({
      content: '❌ Error al guardar la propuesta en jornadas.json.',
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    content: `✅ Vista previa publicada en <#${CANAL_JORNADAS}>. La jornada **${nombre}** todavía no está activa: necesita aprobación.`,
    ephemeral: true
  });
}

// APROBAR O RECHAZAR JORNADA
async function gestionarJornada(interaction) {
  if (!esAdministrador(interaction)) {
    await interaction.reply({
      content: '⛔ Solo los administradores pueden aprobar o rechazar jornadas.',
      ephemeral: true
    });
    return;
  }

  const [accion, id] = interaction.customId.split(':');
  const pendiente = configuracionJornadas.jornadaPendiente;

  if (!pendiente || pendiente.id !== id) {
    await interaction.reply({
      content: '⚠️ Esta propuesta ya no está pendiente o ha sido sustituida.',
      ephemeral: true
    });
    return;
  }

  if (accion === 'aprobar_jornada') {
    if (!configuracionJornadas.jornadas) {
      configuracionJornadas.jornadas = {};
    }

    if (configuracionJornadas.jornadas[id]) {
      await interaction.reply({
        content: '⚠️ Ya existe una jornada con ese identificador. No se ha modificado nada.',
        ephemeral: true
      });
      return;
    }

    configuracionJornadas.jornadas[id] = {
      ...pendiente.datos,
      estado: 'activa',
      fechaActivacion: new Date().toISOString()
    };

    configuracionJornadas.jornadaActiva = id;
    configuracionJornadas.jornadaPendiente = null;

    try {
      guardarConfiguracionJornadas();
      cargarConfiguracionJornadas();

      if (!quinielasGuardadas[JORNADA]) {
        quinielasGuardadas[JORNADA] = {};
        guardarQuinielas();
      }

      pronosticos.clear();
    } catch (error) {
      console.error('Error activando la jornada:', error);

      await interaction.reply({
        content: '❌ No se pudo activar la jornada. Revisa los archivos JSON antes de volver a intentarlo.',
        ephemeral: true
      });
      return;
    }

    await interaction.update({
      content: '✅ **Jornada aprobada.**',
      embeds: [
        crearEmbedJornada(
          NOMBRE_JORNADA,
          partidos,
          pleno,
          'aprobada'
        )
      ],
      components: [botonesJornada(id, true)]
    });

    await interaction.channel.send({
      content:
        `🏆 **¡Nueva jornada activa en Tiempo Extra!**\n` +
        `⚽ **${NOMBRE_JORNADA}**\n` +
        `Ya podéis utilizar \`/quiniela\` para enviar vuestros pronósticos.`
    }).catch(error => {
      console.error('No se pudo anunciar la activación:', error);
    });

    console.log(`✅ Jornada activada: ${JORNADA}`);
    return;
  }

  if (accion === 'rechazar_jornada') {
    configuracionJornadas.jornadaPendiente = null;

    try {
      guardarConfiguracionJornadas();
    } catch (error) {
      console.error('Error rechazando la jornada:', error);

      await interaction.reply({
        content: '❌ No se pudo guardar el rechazo.',
        ephemeral: true
      });
      return;
    }

    await interaction.update({
      content: '❌ **Jornada rechazada.** La jornada activa no ha cambiado.',
      embeds: [
        crearEmbedJornada(
          pendiente.datos.nombre,
          pendiente.datos.partidos,
          pendiente.datos.pleno,
          'rechazada'
        )
      ],
      components: [botonesJornada(id, true)]
    });

    console.log(`❌ Jornada rechazada: ${id}`);
  }
}

// ESTADO DEL USUARIO
function obtenerEstado(userId) {
  if (!pronosticos.has(userId)) {
    pronosticos.set(userId, {
      pagina: 0,
      partidos: {},
      plenoLocal: null,
      plenoVisitante: null
    });
  }

  return pronosticos.get(userId);
}

// MENÚ DE SELECCIÓN
function crearMenu(id, placeholder, opciones, seleccionado) {
  return new StringSelectMenuBuilder()
    .setCustomId(id)
    .setPlaceholder(placeholder)
    .addOptions(
      opciones.map(opcion => ({
        label: opcion.label,
        value: opcion.value,
        default: seleccionado === opcion.value
      }))
    );
}

// PANTALLA DE QUINIELA
function crearPantalla(userId, pagina) {
  const estado = obtenerEstado(userId);
  estado.pagina = pagina;

  const embed = new EmbedBuilder()
    .setColor(0x00AEEF)
    .setTitle('⚽ QUINIELA | TIEMPO EXTRA')
    .setDescription(
      `**${NOMBRE_JORNADA}**\n` +
      `Selecciona tus pronósticos.\nPágina ${pagina + 1} de 4`
    );

  const filas = [];
  const inicio = pagina * 4;
  const final = pagina === 3 ? 14 : inicio + 4;

  for (let i = inicio; i < final; i++) {
    const numero = i + 1;
    const [local, visitante] = partidos[i];
    const elegido = estado.partidos[numero] || null;

    embed.addFields({
      name: `${numero}. ${local} - ${visitante}`,
      value: `Pronóstico: **${elegido || 'Pendiente'}**`
    });

    filas.push(
      new ActionRowBuilder().addComponents(
        crearMenu(
          `partido_${numero}`,
          `Partido ${numero}`,
          [
            { label: `1 - Gana ${local}`, value: '1' },
            { label: 'X - Empate', value: 'X' },
            { label: `2 - Gana ${visitante}`, value: '2' }
          ],
          elegido
        )
      )
    );
  }

  if (pagina === 3) {
    embed.addFields({
      name: `15. PLENO AL 15: ${pleno[0]} - ${pleno[1]}`,
      value:
        `Goles local: **${estado.plenoLocal ?? 'Pendiente'}**\n` +
        `Goles visitante: **${estado.plenoVisitante ?? 'Pendiente'}**`
    });

    const goles = ['0', '1', '2', 'M'].map(valor => ({
      label: valor === 'M' ? '3 o más goles' : `${valor} goles`,
      value: valor
    }));

    filas.push(
      new ActionRowBuilder().addComponents(
        crearMenu(
          'pleno_local',
          `Goles de ${pleno[0]}`,
          goles,
          estado.plenoLocal
        )
      )
    );

    filas.push(
      new ActionRowBuilder().addComponents(
        crearMenu(
          'pleno_visitante',
          `Goles de ${pleno[1]}`,
          goles,
          estado.plenoVisitante
        )
      )
    );
  }

  filas.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('anterior')
        .setLabel('Anterior')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina === 0),

      new ButtonBuilder()
        .setCustomId('siguiente')
        .setLabel('Siguiente')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pagina === 3),

      new ButtonBuilder()
        .setCustomId('confirmar')
        .setLabel('Confirmar quiniela')
        .setStyle(ButtonStyle.Success)
    )
  );

  return {
    embeds: [embed],
    components: filas,
    ephemeral: true
  };
}

// CONSULTAR PRONÓSTICOS
async function mostrarPronosticos(interaction) {
  const guardada =
    quinielasGuardadas[JORNADA]?.[interaction.user.id];

  if (!guardada) {
    await interaction.reply({
      content: '📭 Todavía no tienes una quiniela confirmada.',
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00AEEF)
    .setTitle('📋 TUS PRONÓSTICOS')
    .setDescription(`⚽ ${NOMBRE_JORNADA}`);

  for (let i = 0; i < partidos.length; i++) {
    const numero = i + 1;
    const [local, visitante] = partidos[i];

    embed.addFields({
      name: `${numero}. ${local} - ${visitante}`,
      value: `Pronóstico: **${guardada.partidos[numero]}**`
    });
  }

  embed.addFields({
    name: `15. PLENO AL 15: ${pleno[0]} - ${pleno[1]}`,
    value:
      `Goles de ${pleno[0]}: **${guardada.plenoLocal}**\n` +
      `Goles de ${pleno[1]}: **${guardada.plenoVisitante}**`
  });

  if (guardada.puntosCalculados) {
    embed.addFields({
      name: '🏆 RESULTADO',
      value:
        `Puntos: **${guardada.puntos}**\n` +
        `Monedas ganadas: **${guardada.monedas}**\n` +
        `Premio de jornada: **${guardada.premioJornada || 0}**`
    });
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

// CALCULAR RESULTADOS Y MONEDAS POR ACIERTOS
function calcularJornada(resultados) {
  if (
    !resultados ||
    !resultados.partidos ||
    !Array.from({ length: 14 }, (_, i) => i + 1).every(i =>
      ['1', 'X', '2'].includes(resultados.partidos[i])
    ) ||
    !['0', '1', '2', 'M'].includes(resultados.plenoLocal) ||
    !['0', '1', '2', 'M'].includes(resultados.plenoVisitante)
  ) {
    throw new Error('Faltan resultados o hay valores no válidos.');
  }

  const participantes = Object.entries(
    quinielasGuardadas[JORNADA] || {}
  );

  const clasificacion = [];

  for (const [userId, apuesta] of participantes) {
    let puntos = 0;
    let monedas = 0;

    for (let i = 1; i <= 14; i++) {
      if (apuesta.partidos[i] === resultados.partidos[i]) {
        puntos += 3;
        monedas += 100;
      }
    }

    const aciertoLocal =
      apuesta.plenoLocal === resultados.plenoLocal;

    const aciertoVisitante =
      apuesta.plenoVisitante === resultados.plenoVisitante;

    if (aciertoLocal) {
      puntos += 2;
      monedas += 100;
    }

    if (aciertoVisitante) {
      puntos += 2;
      monedas += 100;
    }

    if (aciertoLocal && aciertoVisitante) {
      puntos += 5;
    }

    apuesta.puntos = puntos;
    apuesta.monedas = monedas;
    apuesta.puntosCalculados = true;
    apuesta.premioJornada = 0;

    const saldoActual =
      quinielasGuardadas._saldos[userId] || 0;

    quinielasGuardadas._saldos[userId] =
      saldoActual + monedas;

    clasificacion.push({
      userId,
      usuario: apuesta.usuario || 'Usuario',
      puntos,
      monedas,
      premio: 0
    });
  }

  clasificacion.sort((a, b) =>
    b.puntos - a.puntos ||
    b.monedas - a.monedas ||
    a.usuario.localeCompare(b.usuario)
  );

  quinielasGuardadas._resultados[JORNADA] = {
    ...resultados,
    jornadaFinalizada: true,
    fechaCalculo: new Date().toISOString(),
    clasificacion,
    premiosRepartidos: false
  };

  guardarQuinielas();

  return clasificacion;
}

// REPARTIR PREMIOS DEL PODIO
function repartirPremiosJornada() {
  const resultados =
    quinielasGuardadas._resultados[JORNADA];

  if (!resultados) {
    return {
      error: 'Primero debes introducir los resultados con /resultados.'
    };
  }

  if (resultados.jornadaFinalizada !== true) {
    return {
      error: 'La jornada no está confirmada como finalizada. No se pueden repartir premios.'
    };
  }

  if (resultados.premiosRepartidos) {
    return {
      error: 'Los premios de esta jornada ya se han repartido.'
    };
  }

  const clasificacion = resultados.clasificacion;

  if (!clasificacion || clasificacion.length === 0) {
    return {
      error: 'No hay participantes para repartir los premios.'
    };
  }

  const premios = [1000, 600, 300];

  for (let i = 0; i < Math.min(3, clasificacion.length); i++) {
    const jugador = clasificacion[i];
    const premio = premios[i];

    jugador.premio = premio;

    const apuesta =
      quinielasGuardadas[JORNADA][jugador.userId];

    apuesta.premioJornada = premio;

    const saldoActual =
      quinielasGuardadas._saldos[jugador.userId] || 0;

    quinielasGuardadas._saldos[jugador.userId] =
      saldoActual + premio;
  }

  resultados.premiosRepartidos = true;
  resultados.fechaRepartoPremios = new Date().toISOString();

  guardarQuinielas();

  return {
    clasificacion,
    error: null
  };
}

// MOSTRAR CLASIFICACIÓN
async function mostrarClasificacion(interaction) {
  const resultados =
    quinielasGuardadas._resultados[JORNADA];

  if (!resultados) {
    await interaction.reply({
      content: '📊 Todavía no se han calculado los resultados de esta jornada.',
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🏆 CLASIFICACIÓN | TIEMPO EXTRA')
    .setDescription(`⚽ ${NOMBRE_JORNADA}`);

  const lista = resultados.clasificacion;

  if (!lista.length) {
    embed.setDescription('Todavía no hay participantes.');
  } else {
    const lineas = lista.slice(0, 10).map((jugador, i) => {
      const medalla = ['🥇', '🥈', '🥉'][i] || '🏅';

      return (
        `${medalla} **${i + 1}. ${jugador.usuario}**\n` +
        `   ${jugador.puntos} puntos · ${jugador.monedas} monedas ` +
        `· Premio: ${jugador.premio || 0} monedas`
      );
    });

    embed.setDescription(lineas.join('\n\n'));
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: false
  });
}

// BOT CONECTADO
client.once(Events.ClientReady, () => {
  try {
    // Comprobar que existe el almacenamiento
    if (!fs.existsSync(DATA_DIR)) {
      throw new Error(`No existe el directorio de datos: ${DATA_DIR}`);
    }

    cargarConfiguracionJornadas();
    cargarQuinielas();

    console.log(`⚽ Conectado como ${client.user.tag}`);
    console.log(`📋 Jornada activa: ${NOMBRE_JORNADA}`);
    console.log(`⚽ Partidos cargados: ${partidos.length + 1}`);
    console.log(`💾 Directorio de datos: ${DATA_DIR}`);
  } catch (error) {
    console.error('❌ No se pudo iniciar el bot:', error);
    process.exit(1);
  }
});

// INTERACCIONES
client.on(Events.InteractionCreate, async interaction => {
  try {
    // COMANDOS
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'quiniela') {
        if (quinielasGuardadas._resultados[JORNADA]) {
          await interaction.reply({
            content: '🔒 Esta jornada ya está cerrada. No se aceptan más pronósticos.',
            ephemeral: true
          });
          return;
        }

        const guardada =
          quinielasGuardadas[JORNADA]?.[interaction.user.id];

        if (guardada) {
          await interaction.reply({
            content:
              '✅ Ya tienes una quiniela confirmada.\n' +
              'Utiliza `/mispronosticos` para consultarla.',
            ephemeral: true
          });
          return;
        }

        obtenerEstado(interaction.user.id);

        await interaction.reply(
          crearPantalla(interaction.user.id, 0)
        );
        return;
      }

      if (interaction.commandName === 'mispronosticos') {
        await mostrarPronosticos(interaction);
        return;
      }

      if (interaction.commandName === 'clasificacion') {
        await mostrarClasificacion(interaction);
        return;
      }

      if (interaction.commandName === 'crearjornada') {
        await crearJornadaDesdeComando(interaction);
        return;
      }

      // INTRODUCIR RESULTADOS
      if (interaction.commandName === 'resultados') {
        if (!esAdministrador(interaction)) {
          await interaction.reply({
            content: '⛔ Solo los administradores pueden introducir resultados.',
            ephemeral: true
          });
          return;
        }

        const jornadaFinalizada =
          interaction.options.getBoolean('jornada_finalizada', true);

        if (!jornadaFinalizada) {
          await interaction.reply({
            content: '🔒 Debes confirmar que todos los partidos de la jornada han terminado.',
            ephemeral: true
          });
          return;
        }

        if (quinielasGuardadas._resultados[JORNADA]) {
          await interaction.reply({
            content:
              '⚠️ Los resultados de esta jornada ya se han calculado. ' +
              'No se volverán a repartir monedas.',
            ephemeral: true
          });
          return;
        }

        const resultados = {
          partidos: {},
          plenoLocal: interaction.options.getString('pleno_local'),
          plenoVisitante: interaction.options.getString('pleno_visitante')
        };

        for (let i = 1; i <= 14; i++) {
          resultados.partidos[i] =
            interaction.options.getString(`partido${i}`);
        }

        const clasificacion = calcularJornada(resultados);

        const embed = new EmbedBuilder()
          .setColor(0x00C853)
          .setTitle('✅ RESULTADOS CALCULADOS')
          .setDescription(
            `Se han calculado los puntos y las monedas por aciertos de ${clasificacion.length} participantes.\n\n` +
            '🏆 Para entregar los premios del podio, utiliza `/repartirpremios`.'
          );

        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });

        return;
      }

      // REPARTIR PREMIOS DEL PODIO
      if (interaction.commandName === 'repartirpremios') {
        if (!esAdministrador(interaction)) {
          await interaction.reply({
            content: '⛔ Solo los administradores pueden repartir premios.',
            ephemeral: true
          });
          return;
        }

        const resultado = repartirPremiosJornada();

        if (resultado.error) {
          await interaction.reply({
            content: `⚠️ ${resultado.error}`,
            ephemeral: true
          });
          return;
        }

        const premios = [1000, 600, 300];
        const medallas = ['🥇', '🥈', '🥉'];

        const lineas = resultado.clasificacion
          .slice(0, 3)
          .map((jugador, i) =>
            `${medallas[i]} **${jugador.usuario}** — ${premios[i]} monedas`
          );

        const embed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('🏆 PREMIOS REPARTIDOS')
          .setDescription(
            `Jornada: **${NOMBRE_JORNADA}**\n\n` +
            lineas.join('\n') +
            '\n\n💰 Los premios se han añadido a los saldos.'
          );

        await interaction.reply({
          embeds: [embed],
          ephemeral: false
        });

        return;
      }
    }

    // BOTONES DE APROBACIÓN / RECHAZO
    if (
      interaction.isButton() &&
      (
        interaction.customId.startsWith('aprobar_jornada:') ||
        interaction.customId.startsWith('rechazar_jornada:')
      )
    ) {
      await gestionarJornada(interaction);
      return;
    }

    // MENÚS DE SELECCIÓN
    if (interaction.isStringSelectMenu()) {
      if (quinielasGuardadas._resultados[JORNADA]) {
        await interaction.reply({
          content: '🔒 Esta jornada ya está cerrada.',
          ephemeral: true
        });
        return;
      }

      const estado = obtenerEstado(interaction.user.id);
      const valor = interaction.values[0];

      if (interaction.customId.startsWith('partido_')) {
        const numero = Number(
          interaction.customId.split('_')[1]
        );

        estado.partidos[numero] = valor;
      }

      if (interaction.customId === 'pleno_local') {
        estado.plenoLocal = valor;
      }

      if (interaction.customId === 'pleno_visitante') {
        estado.plenoVisitante = valor;
      }

      await interaction.update(
        crearPantalla(interaction.user.id, estado.pagina)
      );
      return;
    }

    // BOTONES DE LA QUINIELA
    if (interaction.isButton()) {
      if (quinielasGuardadas._resultados[JORNADA]) {
        await interaction.reply({
          content: '🔒 Esta jornada ya está cerrada.',
          ephemeral: true
        });
        return;
      }

      const estado = obtenerEstado(interaction.user.id);

      if (interaction.customId === 'anterior') {
        await interaction.update(
          crearPantalla(
            interaction.user.id,
            Math.max(0, estado.pagina - 1)
          )
        );
        return;
      }

      if (interaction.customId === 'siguiente') {
        await interaction.update(
          crearPantalla(
            interaction.user.id,
            Math.min(3, estado.pagina + 1)
          )
        );
        return;
      }

      if (interaction.customId === 'confirmar') {
        const completos = partidos.every(
          (_, i) => estado.partidos[i + 1]
        );

        if (
          !completos ||
          estado.plenoLocal === null ||
          estado.plenoVisitante === null
        ) {
          await interaction.reply({
            content: '⚠️ Te faltan pronósticos por completar.',
            ephemeral: true
          });
          return;
        }

        if (quinielasGuardadas[JORNADA]?.[interaction.user.id]) {
          await interaction.update({
            content: 'Ya tienes una quiniela confirmada.',
            embeds: [],
            components: []
          });
          return;
        }

        if (!quinielasGuardadas[JORNADA]) {
          quinielasGuardadas[JORNADA] = {};
        }

        quinielasGuardadas[JORNADA][interaction.user.id] = {
          usuario: interaction.user.username,
          partidos: { ...estado.partidos },
          plenoLocal: estado.plenoLocal,
          plenoVisitante: estado.plenoVisitante,
          fechaConfirmacion: new Date().toISOString(),
          puntos: 0,
          monedas: 0,
          puntosCalculados: false,
          premioJornada: 0
        };

        guardarQuinielas();
        pronosticos.delete(interaction.user.id);

        await interaction.update({
          content:
            '🏆 ¡Tu quiniela ha sido confirmada y guardada!\n' +
            '💾 Tus 14 pronósticos y el Pleno al 15 están almacenados.',
          embeds: [],
          components: []
        });

        console.log(
          `💾 Quiniela guardada: ${interaction.user.username}`
        );

        return;
      }
    }
  } catch (error) {
    console.error('Error en interacción:', error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Ha ocurrido un error. Inténtalo de nuevo.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
