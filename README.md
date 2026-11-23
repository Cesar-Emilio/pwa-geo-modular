# PWA Geo Modular

**Autor:** Cesar Emilio Contreras Cortes

Práctica del tema 6.3 de *Desarrollo de Aplicaciones Web Progresivas*: geolocalización consciente y reutilizable con un módulo promisificado (`geo-helper.js`), patrón Pre-Permiso, Plan B manual y diagnóstico de precisión.

**Demo (GitHub Pages):** https://cesar-emilio.github.io/pwa-geo-modular/

## Estructura

```
pwa-geo-modular/
├── index.html      # geo-helper.js se carga ANTES de app.js
├── styles.css
├── geo-helper.js   # Módulo reutilizable (new Promise): ubicación, permisos, precisión, distancia
├── app.js          # UI, Pre-Permiso, Plan B y consumo del helper (.then / .catch)
├── sw.js           # Cache First; ./geo-helper.js incluido en el App Shell
├── manifest.json
└── icons/          # 192x192 y 512x512
```

## API de `geo-helper.js`

| Función | Descripción |
| --- | --- |
| `obtenerUbicacionActual(opciones)` | Envuelve `getCurrentPosition()` en `new Promise()`. Resuelve `{ latitud, longitud, precisionMetros, timestamp }`. |
| `traducirErrorGeolocalizacion(error)` | Traduce los códigos 1, 2 y 3 a mensajes claros. |
| `consultarEstadoPermisoGeo()` | Permissions API → `'granted'`, `'denied'` o `'prompt'` (con respaldo `'prompt'`). |
| `clasificarPrecision(metros)` | `< 30 m` → "Precisión GPS Alta"; en otro caso → "Ubicación Aproximada (Wi-Fi / IP)". |
| `calcularDistanciaKm(...)` | Distancia Haversine entre dos coordenadas. |

## Flujo de "Adjuntar mi ubicación"

- **granted:** lectura directa con `obtenerUbicacionActual()`.
- **prompt:** tarjeta explicativa; la lectura real solo ocurre al pulsar "Compartir mi ubicación" (gesto directo, requisito de iOS).
- **denied:** selector manual de zona + instrucciones para reactivar el permiso.
- **TIMEOUT / sin señal:** mensaje traducido y selector manual (la app nunca se bloquea).

El mismo módulo se reutiliza en "Buscar sucursal cercana" con `enableHighAccuracy: false` y `maximumAge: 60000`.
