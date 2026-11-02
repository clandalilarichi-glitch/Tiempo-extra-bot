
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
const DATA_DIR = path.join(__dirname, 'storage');
const ARCHIVO = path.join(DATA_DIR, 'quinielas.json');
const ARCHIVO_JORNADAS = path.join(DATA_DIR, 'jornadas.json');
const CANAL_JORNADAS = '1552467310441402450';

let configuracionJornadas;
let JORNADA = null;
let datosJornada = null;
let NOMBRE_JORNADA = null;
let partidos = [];
let pleno = [];

let quinielasGuardadas = {};
const pronosticos = new Map();

// COMPROBAR SI HAY JORNADA ACTIVA
function hayJornadaActiva() {
  return Boolean(
    JORNADA &&
    datosJornada &&
    Array.isArray(partidos) &&
    partidos.length === 14 &&
    Array.isArray(pleno) &&
    pleno.length === 2
  );
}

// CARGAR CONFIGURACIÓN DE JORNADAS
function cargarConfiguracionJornadas() {
  if (!fs.existsSync(ARCHIVO_JORNADAS)) {
    throw new Error(`No existe el archivo: ${ARCHIVO_JORNADAS}`);
  }

  configuracionJornadas = JSON.parse(
    fs.readFileSync(ARCHIVO_JORNADAS, 'utf8')
  );

  if (!configuracionJornadas.jornadas) {
    configuracionJornadas.jornadas = {};
  }

  JORNADA = configuracionJornadas.jornadaActiva || null;
  datosJornada = JORNADA
    ? configuracionJornadas.jornadas[JORNADA]
    : null;

  // PERMITIR QUE EL BOT FUNCIONE SIN JORNADA ACTIVA
  if (!datosJornada) {
    JORNADA = null;
    datosJornada = null;
    NOMBRE_JORNADA = null;
    partidos = [];
    pleno = [];

    configuracionJornadas.jornadaActiva = null;

    console.log('⚠️ No hay ninguna jornada activa.');
    return;
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
  if (!fs.existsSync(ARCHIVO)) {
    throw new Error(`No existe el archivo: ${ARCHIVO}`);
  }

  quinielasGuardadas = JSON.parse(
    fs.readFileSync(ARCHIVO, 'utf8')
  );

  if (
    !quinielasGuardadas ||
    typeof quinielasGuardadas !== 'object' ||
    Array.isArray(quinielasGuardadas)
  ) {
    throw new Error('El contenido de quinielas.json no es válido.');
  }

  if (!quinielasGuardadas._resultados) {
    quinielasGuardadas._resultados = {};
  }

  if (!quinielasGuardadas._saldos) {
    quinielasGuardadas._saldos = {};
  }

  // SOLO CREAR EL REGISTRO SI EXISTE UNA JORNADA ACTIVA
  if (JORNADA && !quinielasGuardadas[JORNADA]) {
    quinielasGuardadas[JORNADA] = {};
  }

  console.log('💾 Datos cargados correctamente.');
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

// COMPROBAR JORNADA ACTIVA
async function exigirJornadaActiva(interaction) {
  if (hayJornadaActiva()) return true;

  await interaction.reply({
    content:
      '⚠️ No hay ninguna jornada activa.\n' +
      'Un administrador debe crear y aprobar una nueva jornada con `/crearjornada`.',
    ephemeral: true
  });

  return false;
}

// CREAR IDENTIFICADOR
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

// SEPARAR PARTIDO
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

// EMBED DE JORNADA
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

  embed.addFields({
    name: '📋 Partidos 1–14',
    value: listaPartidos.map((p, i) =>
      `**${i + 1}.** ${p[0]} - ${p[1]}`
    ).join('\n')
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

// CREAR JORNADA
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

  let listaPartidos = [];

  try {
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
      content: '❌ No encuentro el canal de anuncios de jornadas.',
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
      content: '❌ No he podido publicar la jornada. Comprueba los permisos del bot.',
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
    console.error('Error guardando jornada pendiente:', error);

    await mensaje.edit({
      content: '⚠️ No se pudo guardar la propuesta. No la apruebes.',
      components: []
    }).catch(() => {});

    await interaction.reply({
      content: '❌ Error al guardar la propuesta en jornadas.json.',
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    content: `✅ Vista previa publicada en <#${CANAL_JORNADAS}>. La jornada **${nombre}** necesita aprobación.`,
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
    if (configuracionJornadas.jornadas[id]) {
      await interaction.reply({
        content: '⚠️ Ya existe una jornada con ese identificador.',
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
      console.error('Error activando jornada:', error);

      await interaction.reply({
        content: '❌ No se pudo activar la jornada. Revisa los archivos JSON.',
        ephemeral: true
      });
      return;
    }

    await interaction.update({
      content: '✅ **Jornada aprobada.**',
      embeds: [
        crearEmbedJornada(NOMBRE_JORNADA, partidos, pleno, 'aprobada')
      ],
      components: [botonesJornada(id, true)]
    });

    await interaction.channel.send({
      content:
        `🏆 **¡Nueva jornada activa en Tiempo Extra!**\n` +
        `⚽ **${NOMBRE_JORNADA}**\n` +
        `Ya podéis utilizar \`/quiniela\` para enviar vuestros pronósticos.`
    }).catch(console.error);

    console.log(`✅ Jornada activada: ${JORNADA}`);
    return;
  }

  if (accion === 'rechazar_jornada') {
    configuracionJornadas.jornadaPendiente = null;

    try {
      guardarConfiguracionJornadas();
    } catch (error) {
      console.error('Error rechazando jornada:', error);

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
        crearMenu('pleno_local', `Goles de ${pleno[0]}`, goles, estado.plenoLocal)
      )
    );

    filas.push(
      new ActionRowBuilder().addComponents(
        crearMenu('pleno_visitante', `Goles de ${pleno[1]}`, goles, estado.plenoVisitante)
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

// CALCULAR RESULTADOS
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

    const aciertoLocal = apuesta.plenoLocal === resultados.plenoLocal;
    const aciertoVisitante = apuesta.plenoVisitante === resultados.plenoVisitante;

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

// REPARTIR PREMIOS
function repartirPremiosJornada() {
  const resultados =
    quinielasGuardadas._resultados[JORNADA];

  if (!resultados) {
    return { error: 'Primero debes introducir los resultados con /resultados.' };
  }

  if (resultados.jornadaFinalizada !== true) {
    return { error: 'La jornada no está confirmada como finalizada.' };
  }

  if (resultados.premiosRepartidos) {
    return { error: 'Los premios de esta jornada ya se han repartido.' };
  }

  const clasificacion = resultados.clasificacion;

  if (!clasificacion || clasificacion.length === 0) {
    return { error: 'No hay participantes para repartir los premios.' };
  }

  const premios = [1000, 600, 300];

  for (let i = 0; i < Math.min(3, clasificacion.length); i++) {
    const jugador = clasificacion[i];
    const premio = premios[i];

    jugador.premio = premio;

    const apuesta = quinielasGuardadas[JORNADA][jugador.userId];
    apuesta.premioJornada = premio;

    const saldoActual =
      quinielasGuardadas._saldos[jugador.userId] || 0;

    quinielasGuardadas._saldos[jugador.userId] =
      saldoActual + premio;
  }

  resultados.premiosRepartidos = true;
  resultados.fechaRepartoPremios = new Date().toISOString();

  guardarQuinielas();

  return { clasificacion, error: null };
}

// CLASIFICACIÓN
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

// MOSTRAR JORNADAS
async function mostrarJornadas(interaction) {
  const jornadas = configuracionJornadas.jornadas || {};
  const activa = configuracionJornadas.jornadaActiva;
  const pendiente = configuracionJornadas.jornadaPendiente;

  const embed = new EmbedBuilder()
    .setColor(0x00AEEF)
    .setTitle('⚽ JORNADAS | TIEMPO EXTRA')
    .setDescription('Consulta las jornadas registradas en el sistema.');

  const lista = Object.entries(jornadas);

  if (lista.length === 0) {
    embed.addFields({
      name: '📭 Sin jornadas',
      value: 'Todavía no hay jornadas registradas.'
    });
  } else {
    for (const [id, jornada] of lista.slice(0, 24)) {
      const esActiva = id === activa;
      const resultado = quinielasGuardadas._resultados?.[id];

      let estado = esActiva ? '🟢 ACTIVA' : '⚪ ANTERIOR';

      if (resultado?.jornadaFinalizada) {
        estado = '🏁 FINALIZADA';
      }

      embed.addFields({
        name: `${esActiva ? '🟢' : '📋'} ${jornada.nombre || id}`,
        value:
          `**Estado:** ${estado}\n` +
          `**Partidos:** ${jornada.partidos?.length || 0}\n` +
          `**Fecha de activación:** ${
            jornada.fechaActivacion
              ? new Date(jornada.fechaActivacion).toLocaleDateString('es-ES')
              : 'No registrada'
          }\n` +
          `**ID:** \`${id}\``
      });
    }
  }

  if (pendiente && embed.data.fields.length < 25) {
    embed.addFields({
      name: '⏳ Jornada pendiente',
      value:
        `**${pendiente.datos.nombre}**\n` +
        'Estado: Pendiente de aprobación.'
    });
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: false
  });
}

// MENÚ PARA ELIMINAR JORNADA
async function mostrarEliminarJornada(interaction) {
  if (!esAdministrador(interaction)) {
    await interaction.reply({
      content: '⛔ Solo los administradores pueden eliminar jornadas.',
      ephemeral: true
    });
    return;
  }

  const jornadas = Object.entries(
    configuracionJornadas.jornadas || {}
  );

  if (jornadas.length === 0) {
    await interaction.reply({
      content: '📭 No hay jornadas registradas para eliminar.',
      ephemeral: true
    });
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId('seleccionar_eliminar_jornada')
    .setPlaceholder('Selecciona la jornada que quieres eliminar')
    .addOptions(
      jornadas.slice(0, 25).map(([id, jornada]) => ({
        label: (jornada.nombre || id).slice(0, 100),
        description: id.slice(0, 100),
        value: id
      }))
    );

  await interaction.reply({
    content:
      '🗑️ **ELIMINAR JORNADA**\n' +
      'Selecciona la jornada que deseas borrar.',
    components: [
      new ActionRowBuilder().addComponents(menu)
    ],
    ephemeral: true
  });
}

// ELIMINAR JORNADA
async function confirmarEliminarJornada(interaction, id) {
  if (!esAdministrador(interaction)) {
    await interaction.reply({
      content: '⛔ No tienes permiso para eliminar jornadas.',
      ephemeral: true
    });
    return;
  }

  const jornada = configuracionJornadas.jornadas?.[id];

  if (!jornada) {
    await interaction.update({
      content: '⚠️ Esa jornada ya no existe.',
      components: []
    });
    return;
  }

  const esActiva = configuracionJornadas.jornadaActiva === id;

  // BUSCAR OTRA JORNADA PARA ACTIVAR
  const restantes = Object.entries(
    configuracionJornadas.jornadas
  ).filter(([otroId]) => otroId !== id);

  restantes.sort((a, b) =>
    new Date(b[1].fechaActivacion || 0) -
    new Date(a[1].fechaActivacion || 0)
  );

  const nuevaActiva = restantes.length > 0
    ? restantes[0][0]
    : null;

  // PREPARAR COPIAS PARA EVITAR CAMBIOS PARCIALES
  const copiaJornadas = JSON.parse(
    JSON.stringify(configuracionJornadas)
  );

  const copiaQuinielas = JSON.parse(
    JSON.stringify(quinielasGuardadas)
  );

  // DESCONTAR MONEDAS Y PREMIOS DE ESA JORNADA
  const participantes = copiaQuinielas[id] || {};

  for (const [userId, apuesta] of Object.entries(participantes)) {
    const monedasGanadas = Number(apuesta.monedas || 0);
    const premio = Number(apuesta.premioJornada || 0);
    const descuento = monedasGanadas + premio;

    const saldo = Number(copiaQuinielas._saldos[userId] || 0);

    copiaQuinielas._saldos[userId] =
      Math.max(0, saldo - descuento);
  }

  // BORRAR PRONÓSTICOS Y RESULTADOS
  delete copiaQuinielas[id];

  if (copiaQuinielas._resultados) {
    delete copiaQuinielas._resultados[id];
  }

  // BORRAR JORNADA
  delete copiaJornadas.jornadas[id];

  // CAMBIAR JORNADA ACTIVA O DEJARLA VACÍA
  if (esActiva) {
    copiaJornadas.jornadaActiva = nuevaActiva;
  }

  try {
    // GUARDAR LAS COPIAS ANTES DE ACTUALIZAR LA MEMORIA
    const temporalJornadas = ARCHIVO_JORNADAS + '.tmp';
    const temporalQuinielas = ARCHIVO + '.tmp';

    fs.writeFileSync(
      temporalJornadas,
      JSON.stringify(copiaJornadas, null, 2)
    );

    fs.writeFileSync(
      temporalQuinielas,
      JSON.stringify(copiaQuinielas, null, 2)
    );

    fs.renameSync(temporalJornadas, ARCHIVO_JORNADAS);
    fs.renameSync(temporalQuinielas, ARCHIVO);

    // ACTUALIZAR DATOS EN MEMORIA
    configuracionJornadas = copiaJornadas;
    quinielasGuardadas = copiaQuinielas;

    cargarConfiguracionJornadas();
    pronosticos.clear();

    let mensajeActiva;

    if (esActiva && nuevaActiva) {
      mensajeActiva =
        `🟢 Nueva jornada activa: **${NOMBRE_JORNADA}**`;
    } else if (esActiva) {
      mensajeActiva =
        '⚠️ No queda ninguna jornada activa. Crea una nueva con `/crearjornada`.';
    } else {
      mensajeActiva = '✅ La jornada activa no ha cambiado.';
    }

    await interaction.update({
      content:
        `🗑️ **Jornada eliminada correctamente.**\n\n` +
        `⚽ Jornada eliminada: **${jornada.nombre || id}**\n` +
        `${mensajeActiva}\n` +
        `💰 Se han ajustado las monedas ganadas en esa jornada.`,
      embeds: [],
      components: []
    });

    console.log(`🗑️ Jornada eliminada: ${id}`);
  } catch (error) {
    console.error('Error eliminando jornada:', error);

    await interaction.update({
      content:
        '❌ Ha ocurrido un error al guardar los cambios. ' +
        'Comprueba los archivos JSON antes de volver a intentarlo.',
      embeds: [],
      components: []
    }).catch(() => {});
  }
}

// BOT CONECTADO Y DIAGNÓSTICO FADEHOST
client.once(Events.ClientReady, () => {
  try {
    console.log('========== DIAGNÓSTICO FADEHOST ==========');
    console.log('📁 DATA_DIR:', DATA_DIR);
    console.log('📄 ARCHIVO:', ARCHIVO);
    console.log('📄 ARCHIVO_JORNADAS:', ARCHIVO_JORNADAS);
    console.log('📂 Directorio actual:', process.cwd());
    console.log('📂 __dirname:', __dirname);

    console.log(
      '📂 Contenido de /data:',
      fs.existsSync('/data') ? fs.readdirSync('/data') : 'NO EXISTE'
    );

    console.log(
      '📂 Contenido de /data/storage:',
      fs.existsSync('/data/storage') ? fs.readdirSync('/data/storage') : 'NO EXISTE'
    );

    console.log(
      '📂 Contenido de /data/app:',
      fs.existsSync('/data/app') ? fs.readdirSync('/data/app') : 'NO EXISTE'
    );

    console.log(
      '📂 Contenido de /data/app/storage:',
      fs.existsSync('/data/app/storage') ? fs.readdirSync('/data/app/storage') : 'NO EXISTE'
    );

    console.log(
      '📂 Contenido de la carpeta del proyecto:',
      fs.existsSync(__dirname) ? fs.readdirSync(__dirname) : 'NO EXISTE'
    );

    console.log('🔎 Existe quinielas.json:', fs.existsSync(ARCHIVO));
    console.log('🔎 Existe jornadas.json:', fs.existsSync(ARCHIVO_JORNADAS));
    console.log('========================================');

    if (!fs.existsSync(ARCHIVO)) {
      throw new Error(`No existe quinielas.json en: ${ARCHIVO}`);
    }

    if (!fs.existsSync(ARCHIVO_JORNADAS)) {
      throw new Error(`No existe jornadas.json en: ${ARCHIVO_JORNADAS}`);
    }

    cargarConfiguracionJornadas();
    cargarQuinielas();

    console.log(`⚽ Conectado como ${client.user.tag}`);

    if (hayJornadaActiva()) {
      console.log(`📋 Jornada activa: ${NOMBRE_JORNADA}`);
      console.log(`⚽ Partidos cargados: ${partidos.length + 1}`);
    } else {
      console.log('⚠️ El bot está conectado sin jornada activa.');
    }

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
        if (!await exigirJornadaActiva(interaction)) return;

        if (quinielasGuardadas._resultados[JORNADA]) {
          await interaction.reply({
            content: '🔒 Esta jornada ya está cerrada. No se aceptan más pronósticos.',
            ephemeral: true
          });
          return;
        }

        const guardada = quinielasGuardadas[JORNADA]?.[interaction.user.id];

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
        await interaction.reply(crearPantalla(interaction.user.id, 0));
        return;
      }

      if (interaction.commandName === 'mispronosticos') {
        if (!await exigirJornadaActiva(interaction)) return;
        await mostrarPronosticos(interaction);
        return;
      }

      if (interaction.commandName === 'clasificacion') {
        if (!await exigirJornadaActiva(interaction)) return;
        await mostrarClasificacion(interaction);
        return;
      }

      if (interaction.commandName === 'jornadas') {
        await mostrarJornadas(interaction);
        return;
      }

      if (interaction.commandName === 'eliminarjornada') {
        await mostrarEliminarJornada(interaction);
        return;
      }

      if (interaction.commandName === 'crearjornada') {
        await crearJornadaDesdeComando(interaction);
        return;
      }

      // RESULTADOS
      if (interaction.commandName === 'resultados') {
        if (!esAdministrador(interaction)) {
          await interaction.reply({
            content: '⛔ Solo los administradores pueden introducir resultados.',
            ephemeral: true
          });
          return;
        }

        if (!await exigirJornadaActiva(interaction)) return;

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
            content: '⚠️ Los resultados de esta jornada ya se han calculado.',
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

      // REPARTIR PREMIOS
      if (interaction.commandName === 'repartirpremios') {
        if (!esAdministrador(interaction)) {
          await interaction.reply({
            content: '⛔ Solo los administradores pueden repartir premios.',
            ephemeral: true
          });
          return;
        }

        if (!await exigirJornadaActiva(interaction)) return;

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

    // APROBAR / RECHAZAR JORNADA
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

    // SELECTOR PARA ELIMINAR JORNADA
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === 'seleccionar_eliminar_jornada'
    ) {
      if (!esAdministrador(interaction)) {
        await interaction.reply({
          content: '⛔ No tienes permiso.',
          ephemeral: true
        });
        return;
      }

      const id = interaction.values[0];
      const jornada = configuracionJornadas.jornadas?.[id];

      if (!jornada) {
        await interaction.update({
          content: '⚠️ La jornada ya no existe.',
          components: []
        });
        return;
      }

      const botones = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirmar_eliminar:${id}`)
          .setLabel('Sí, eliminar')
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId('cancelar_eliminar')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({
        content:
          `⚠️ **¿Estás seguro de eliminar esta jornada?**\n\n` +
          `⚽ Jornada: **${jornada.nombre || id}**\n` +
          'Se borrarán sus pronósticos, resultados y recompensas asociadas.',
        components: [botones]
      });

      return;
    }

    // CONFIRMAR O CANCELAR ELIMINACIÓN
    if (
      interaction.isButton() &&
      (
        interaction.customId.startsWith('confirmar_eliminar:') ||
        interaction.customId === 'cancelar_eliminar'
      )
    ) {
      if (!esAdministrador(interaction)) {
        await interaction.reply({
          content: '⛔ No tienes permiso.',
          ephemeral: true
        });
        return;
      }

      if (interaction.customId === 'cancelar_eliminar') {
        await interaction.update({
          content: '✅ Eliminación cancelada.',
          components: []
        });
        return;
      }

      const id = interaction.customId.split(':')[1];
      await confirmarEliminarJornada(interaction, id);
      return;
    }

    // MENÚS DE QUINIELA
    if (interaction.isStringSelectMenu()) {
      if (!hayJornadaActiva()) {
        await interaction.reply({
          content: '⚠️ No hay ninguna jornada activa. Espera a que se apruebe una nueva.',
          ephemeral: true
        });
        return;
      }

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
        const numero = Number(interaction.customId.split('_')[1]);
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

    // BOTONES DE QUINIELA
    if (interaction.isButton()) {
      if (!hayJornadaActiva()) {
        await interaction.reply({
          content: '⚠️ No hay ninguna jornada activa.',
          ephemeral: true
        });
        return;
      }

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

        console.log(`💾 Quiniela guardada: ${interaction.user.username}`);
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
