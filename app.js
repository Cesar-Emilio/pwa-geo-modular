// =====================================================================
// app.js - UI, Pre-Permiso y consumo de geo-helper.js
// Autor: Cesar Emilio Contreras Cortes
// Sin async/await: toda la asincronía se consume con .then() / .catch().
// =====================================================================

// ---------------------------------------------------------------------
// Datos de apoyo: zonas para el Plan B y sucursales de ejemplo
// ---------------------------------------------------------------------
const ZONAS = [
  { id: 'cdmx', nombre: 'Ciudad de México', latitud: 19.4326, longitud: -99.1332 },
  { id: 'gdl', nombre: 'Guadalajara', latitud: 20.6597, longitud: -103.3496 },
  { id: 'mty', nombre: 'Monterrey', latitud: 25.6866, longitud: -100.3161 },
  { id: 'pue', nombre: 'Puebla', latitud: 19.0414, longitud: -98.2063 },
  { id: 'qro', nombre: 'Querétaro', latitud: 20.5888, longitud: -100.3899 },
  { id: 'mid', nombre: 'Mérida', latitud: 20.9674, longitud: -89.5926 },
  { id: 'tij', nombre: 'Tijuana', latitud: 32.5149, longitud: -117.0382 }
];

const SUCURSALES = [
  { nombre: 'Sucursal Centro CDMX', latitud: 19.4342, longitud: -99.1386 },
  { nombre: 'Sucursal Zapopan', latitud: 20.7214, longitud: -103.3918 },
  { nombre: 'Sucursal San Pedro (MTY)', latitud: 25.6573, longitud: -100.4022 },
  { nombre: 'Sucursal Angelópolis (PUE)', latitud: 19.0300, longitud: -98.2325 },
  { nombre: 'Sucursal Juriquilla (QRO)', latitud: 20.7036, longitud: -100.4446 },
  { nombre: 'Sucursal Paseo Montejo (MID)', latitud: 20.9802, longitud: -89.6206 },
  { nombre: 'Sucursal Zona Río (TIJ)', latitud: 32.5246, longitud: -117.0247 }
];

// Opciones de lectura según el caso de uso
const OPCIONES_POR_ACCION = {
  reporte: { enableHighAccuracy: true, timeout: 7000 },
  sucursal: { enableHighAccuracy: false, maximumAge: 60000 }
};

const MOTIVO_POR_ACCION = {
  reporte: 'Necesitamos tu ubicación para adjuntar las coordenadas al reporte técnico. Así el equipo de campo sabrá exactamente dónde ocurrió la incidencia.',
  sucursal: 'Necesitamos tu ubicación aproximada para calcular la sucursal más cercana a ti. Basta con una lectura de baja precisión.'
};

// ---------------------------------------------------------------------
// Referencias y estado
// ---------------------------------------------------------------------
const el = (id) => document.getElementById(id);

const btnAdjuntar = el('btn-adjuntar-ubicacion');
const btnSucursal = el('btn-sucursal');
const btnConfirmar = el('btn-confirmar-ubicacion');
const btnCancelar = el('btn-cancelar-ubicacion');
const btnUsarZona = el('btn-usar-zona');
const btnInstalar = el('btn-instalar');
const avisoUbicacion = el('aviso-ubicacion');
const selectorManual = el('selector-manual');
const ayudaPermiso = el('ayuda-permiso');
const selectZona = el('zona-manual');
const estadoUbicacion = el('estado-ubicacion');
const resultadoSucursal = el('resultado-sucursal');

let accionPendiente = 'reporte'; // 'reporte' | 'sucursal'
let ubicacionAdjunta = null;
let eventoInstalacionDiferido = null;

// ---------------------------------------------------------------------
// Helpers de interfaz (nombres del Fragmento C)
// ---------------------------------------------------------------------
function mensajeDeAccion(accion, texto) {
  if (accion === 'sucursal') {
    resultadoSucursal.hidden = false;
    resultadoSucursal.textContent = texto;
  } else {
    estadoUbicacion.textContent = texto;
  }
}

function mostrarCargando(texto) {
  mensajeDeAccion(accionPendiente, texto);
  btnAdjuntar.disabled = true;
  btnSucursal.disabled = true;
}

function finalizarCarga() {
  btnAdjuntar.disabled = false;
  btnSucursal.disabled = false;
}

function mostrarMensajeError(texto) {
  mensajeDeAccion(accionPendiente, '⚠ ' + texto);
}

function ocultarTarjetas() {
  avisoUbicacion.hidden = true;
  selectorManual.hidden = true;
  ayudaPermiso.hidden = true;
}

// Plan B: nunca bloquear al usuario
function habilitarSelectorManualZona(permisoBloqueado) {
  avisoUbicacion.hidden = true;
  selectorManual.hidden = false;
  ayudaPermiso.hidden = !permisoBloqueado;
  selectorManual.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mostrarAvisoPrePermiso(accion) {
  el('aviso-motivo').textContent = MOTIVO_POR_ACCION[accion];
  avisoUbicacion.hidden = false;
  avisoUbicacion.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Indicador de calidad de señal + datos de la lectura
function renderizarResultadoUbicacion(ubicacion) {
  const calidad = clasificarPrecision(ubicacion.precisionMetros);
  const indicador = el('indicador-precision');

  indicador.textContent = calidad.etiqueta;
  indicador.className = 'indicador indicador-' + calidad.nivel;

  el('dato-latitud').textContent = ubicacion.latitud.toFixed(6);
  el('dato-longitud').textContent = ubicacion.longitud.toFixed(6);
  el('dato-precision').textContent = typeof ubicacion.precisionMetros === 'number'
    ? '± ' + ubicacion.precisionMetros.toLocaleString('es-MX') + ' m'
    : 'No aplica (zona manual)';
  el('dato-origen').textContent = ubicacion.origen === 'manual'
    ? 'Selector manual: ' + ubicacion.zona + (ubicacion.direccion ? ' — ' + ubicacion.direccion : '')
    : 'Sensor del dispositivo';
  el('dato-hora').textContent = new Date(ubicacion.timestamp).toLocaleString('es-MX');

  const enlace = el('enlace-mapa');
  enlace.href = 'https://www.openstreetmap.org/?mlat=' + ubicacion.latitud +
                '&mlon=' + ubicacion.longitud + '#map=16/' +
                ubicacion.latitud + '/' + ubicacion.longitud;
  enlace.hidden = false;

  el('resultado-ubicacion').hidden = false;
  estadoUbicacion.textContent = 'Ubicación adjunta al reporte.';
}

function renderizarSucursal(ubicacion) {
  let masCercana = null;
  let menorDistancia = Infinity;

  SUCURSALES.forEach((sucursal) => {
    const distancia = calcularDistanciaKm(ubicacion.latitud, ubicacion.longitud, sucursal.latitud, sucursal.longitud);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      masCercana = sucursal;
    }
  });

  const calidad = clasificarPrecision(ubicacion.precisionMetros);
  resultadoSucursal.hidden = false;
  resultadoSucursal.textContent = masCercana.nombre + ' — a ' +
    menorDistancia.toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' km (' + calidad.etiqueta + ').';
}

// ---------------------------------------------------------------------
// Consumo del helper (Fragmento C)
// ---------------------------------------------------------------------
function aplicarUbicacion(accion, ubicacion) {
  if (accion === 'sucursal') {
    renderizarSucursal(ubicacion);
  } else {
    ubicacionAdjunta = ubicacion;
    renderizarResultadoUbicacion(ubicacion);
  }
}

// Lectura real: solo se invoca desde un clic (granted o confirmación del aviso)
function ejecutarLecturaUbicacion(accion) {
  accionPendiente = accion;
  ocultarTarjetas();
  mostrarCargando('Obteniendo coordenadas...');

  return obtenerUbicacionActual(OPCIONES_POR_ACCION[accion])
    .then((ubicacion) => {
      ubicacion.origen = 'sensor';
      console.log('[Geo] Lectura obtenida:', ubicacion);
      aplicarUbicacion(accion, ubicacion);
      finalizarCarga();
    })
    .catch((error) => {
      console.warn('[Geo] Fallback activado:', error.message);
      mostrarMensajeError(error.message);
      habilitarSelectorManualZona(error.codigo === 1); // Plan B sin bloquear al usuario
      finalizarCarga();
    });
}

// Flujo de Pre-Permiso: decide según el estado actual del permiso
function solicitarUbicacion(accion) {
  accionPendiente = accion;
  ocultarTarjetas();

  return consultarEstadoPermisoGeo()
    .then((estado) => {
      console.log('[Geo] Estado del permiso:', estado);

      if (estado === 'granted') {
        return ejecutarLecturaUbicacion(accion);
      }

      if (estado === 'denied') {
        mostrarMensajeError('El permiso de ubicación está bloqueado. Elige tu zona manualmente.');
        habilitarSelectorManualZona(true);
        return null;
      }

      // 'prompt': explicar antes de lanzar el diálogo nativo
      mensajeDeAccion(accion, 'Lee el aviso para decidir si compartes tu ubicación.');
      mostrarAvisoPrePermiso(accion);
      return null;
    })
    .catch((error) => {
      mostrarMensajeError(error.message);
      habilitarSelectorManualZona(false);
    });
}

// Uso 2 del Fragmento C
function buscarSucursalesCercanas() {
  return solicitarUbicacion('sucursal');
}

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------
btnAdjuntar.addEventListener('click', () => {
  solicitarUbicacion('reporte');
});

btnSucursal.addEventListener('click', () => {
  buscarSucursalesCercanas();
});

// Confirmación consciente: la lectura nace directamente de este clic (requisito iOS)
btnConfirmar.addEventListener('click', () => {
  ejecutarLecturaUbicacion(accionPendiente);
});

btnCancelar.addEventListener('click', () => {
  mensajeDeAccion(accionPendiente, 'No se solicitó el permiso. Elige tu zona manualmente.');
  habilitarSelectorManualZona(false);
});

btnUsarZona.addEventListener('click', () => {
  const zona = ZONAS.find((z) => z.id === selectZona.value);
  if (!zona) {
    selectZona.focus();
    mensajeDeAccion(accionPendiente, 'Selecciona una zona para continuar.');
    return;
  }

  const ubicacionManual = {
    latitud: zona.latitud,
    longitud: zona.longitud,
    precisionMetros: null,
    timestamp: Date.now(),
    origen: 'manual',
    zona: zona.nombre,
    direccion: el('direccion-manual').value.trim()
  };

  selectorManual.hidden = true;
  aplicarUbicacion(accionPendiente, ubicacionManual);
});

el('form-reporte').addEventListener('submit', (event) => {
  event.preventDefault();
  const titulo = el('titulo').value.trim();

  if (!titulo) {
    el('titulo').focus();
    estadoUbicacion.textContent = 'Escribe un título para el reporte.';
    return;
  }

  const datosFormulario = {
    titulo: titulo,
    descripcion: el('descripcion').value.trim(),
    fecha: new Date().toISOString()
  };

  const paqueteCompleto = Object.assign({}, datosFormulario, {
    coordenadas: ubicacionAdjunta // null si el usuario decidió no adjuntarla
  });

  console.log('Paquete listo para enviar o encolar en IndexedDB:', paqueteCompleto);
  el('json-reporte').textContent = JSON.stringify(paqueteCompleto, null, 2);
  el('salida-reporte').hidden = false;
  el('salida-reporte').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------------------------------------------------------------------
// Instalabilidad (Android + guía iOS)
// ---------------------------------------------------------------------
function estaInstalada() {
  return window.navigator.standalone === true ||
         window.matchMedia('(display-mode: standalone)').matches;
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  eventoInstalacionDiferido = event;
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacionDiferido) return;
  eventoInstalacionDiferido.prompt();
  eventoInstalacionDiferido.userChoice
    .then((resultado) => {
      if (resultado.outcome === 'accepted') btnInstalar.hidden = true;
      eventoInstalacionDiferido = null;
    })
    .catch(() => {
      eventoInstalacionDiferido = null;
    });
});

function verificarEntornoIOS() {
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (esIOS && !estaInstalada()) {
    el('instrucciones-ios').hidden = false;
  }
}

// ---------------------------------------------------------------------
// Inicialización (sin pedir ubicación: solo tras un clic)
// ---------------------------------------------------------------------
ZONAS.forEach((zona) => {
  const opcion = document.createElement('option');
  opcion.value = zona.id;
  opcion.textContent = zona.nombre;
  selectZona.appendChild(opcion);
});

el('modo-visualizacion').textContent = estaInstalada() ? 'Modo: app instalada' : 'Modo: navegador';
verificarEntornoIOS();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then((registro) => console.log('[SW] Registrado con scope:', registro.scope))
    .catch((error) => console.error('[SW] Error al registrar:', error));
}
