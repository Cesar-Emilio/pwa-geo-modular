// =====================================================================
// geo-helper.js - Módulo reutilizable de geolocalización en Vanilla JS
// Autor: Cesar Emilio Contreras Cortes
//
// Encapsula la API de callbacks navigator.geolocation en Promesas
// (new Promise) para que cualquier flujo de app.js la consuma con
// .then() / .catch(). Sin async/await y sin librerías externas.
// =====================================================================

// Umbral (metros) que separa una lectura satelital de una aproximada
const UMBRAL_PRECISION_ALTA_METROS = 30;

// Fragmento A: traducción de códigos nativos (1, 2, 3) a mensajes claros
function traducirErrorGeolocalizacion(error) {
  switch (error.code) {
    case 1: // error.PERMISSION_DENIED
      return 'Permiso de ubicación denegado. Puedes ingresar tu zona manualmente.';
    case 2: // error.POSITION_UNAVAILABLE
      return 'No fue posible determinar tu ubicación (señal GPS o Wi-Fi no disponible).';
    case 3: // error.TIMEOUT
      return 'Se agotó el tiempo de espera intentando obtener las coordenadas.';
    default:
      return 'Ocurrió un error inesperado al consultar la ubicación.';
  }
}

// Fragmento A: lectura única promisificada con salida normalizada
function obtenerUbicacionActual(opcionesPersonalizadas) {
  const opciones = Object.assign(
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000 // Acepta una lectura reciente de hasta 30 segundos
    },
    opcionesPersonalizadas
  );

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Este navegador no soporta la API de Geolocalización.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        resolve({
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
          precisionMetros: Math.round(posicion.coords.accuracy),
          timestamp: posicion.timestamp
        });
      },
      (error) => {
        const errorTraducido = new Error(traducirErrorGeolocalizacion(error));
        errorTraducido.codigo = error.code; // Conserva el código nativo para decisiones de UI
        reject(errorTraducido);
      },
      opciones
    );
  });
}

// Fragmento B: inspección previa del estado del permiso (Permissions API)
function consultarEstadoPermisoGeo() {
  if (!('permissions' in navigator)) {
    return Promise.resolve('prompt');
  }

  return navigator.permissions.query({ name: 'geolocation' })
    .then((resultado) => resultado.state) // 'granted', 'denied' o 'prompt'
    .catch(() => 'prompt');
}

// Clasifica la calidad de la señal a partir de accuracy (metros)
function clasificarPrecision(precisionMetros) {
  if (typeof precisionMetros !== 'number') {
    return { nivel: 'manual', etiqueta: 'Zona Manual (sin sensor)' };
  }
  if (precisionMetros < UMBRAL_PRECISION_ALTA_METROS) {
    return { nivel: 'alta', etiqueta: 'Precisión GPS Alta' };
  }
  return { nivel: 'aproximada', etiqueta: 'Ubicación Aproximada (Wi-Fi / IP)' };
}

// Distancia en kilómetros entre dos coordenadas (fórmula de Haversine)
function calcularDistanciaKm(latA, lonA, latB, lonB) {
  const radioTierraKm = 6371;
  const aRadianes = (grados) => grados * Math.PI / 180;
  const dLat = aRadianes(latB - latA);
  const dLon = aRadianes(lonB - lonA);
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(aRadianes(latA)) * Math.cos(aRadianes(latB)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return radioTierraKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
