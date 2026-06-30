# Contrato API futuro

La web y una futura app movil pueden usar los mismos endpoints:

- POST /api/auth/login
- GET /api/channels
- GET /api/events
- GET /api/events/{id}
- GET /api/agenda?date=YYYY-MM-DD
- GET /api/player/{eventId}
- GET /api/favorites
- POST /api/favorites

Ejemplo para reproductor:

~~~json
{
  "eventId": "arena",
  "streamType": "hls",
  "streamUrl": "https://tu-cdn-autorizado/evento/index.m3u8",
  "qualities": ["auto", "1080p", "720p"]
}
~~~

Usar solo contenido propio, licenciado o autorizado.
