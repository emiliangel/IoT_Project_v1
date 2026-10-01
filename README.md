# IoT Project v1

Plataforma IoT completa: un broker MQTT con autenticación contra MongoDB, una API en Express, un dashboard en Nuxt 2 y firmware para ESP32.


---

## Arquitectura

```
                        ┌─────────────────────────────────────────────────────────┐
             MQTT :1883 │                    SERVICES (Docker)                    │
 ┌──────────┐  sdata ►  │    ┌──────────────────────┐    [3]      ┌───────────┐   │
 │  ESP32   │◄──[2]─────┼───►│     EMQX 4.4.19      ├────────────►│  MongoDB  │   │
 │ FIRMWARE │ ◄ actdata │    │     broker MQTT      │             │    6.0    │   │
 └────┬─────┘           │    └─┬─────▲────────────▲─┘             └─────▲─────┘   │
      │                 └──────┼─────┼────────────┼─────────────────────┼─────────┘
      │                        │     │            │                     │
      │                    [4] │     │[5]         │[8]                  │
      │                   HTTP │     │ HTTP :8085 │MQTT/WS :8083        │
      │                        │     │ MQTT :1883 │                     │
      │                 ┌──────▼─────┴──┐         │     [6]             │
      │ [1] HTTP :3001  │  API Express  ├─────────┼─────────────────────┘
      └────────────────►│ APP/api :3001 │         │
                        └───────▲───────┘         │
                                │                 │
                                │[7]              │
                                │HTTP             │
                        ┌───────┴─────────────────▼────┐
                        │        Nuxt 2  :3000         │
                        │        APP (frontend)        │
                        └──────────────────────────────┘
```

**Protocolos:** `MQTT :1883` es MQTT directo sobre TCP, lo usan el ESP32 [2] y el cliente superusuario de la API [5]. `MQTT/WS :8083` es MQTT encapsulado en WebSocket [8], porque el navegador no puede abrir conexiones TCP directas. Ambos llegan al mismo broker y comparten los mismos topics, así que un comando publicado por WebSocket le llega al ESP32 por TCP. `HTTP` son peticiones/respuestas: la flecha indica quién inicia la petición.

| # | Conexión | Protocolo | Para qué |
| --- | --- | --- | --- |
| 1 | ESP32 → API | HTTP `:3001` | `POST /api/getdevicescredentials`: el dispositivo pide sus credenciales MQTT con `dId` + contraseña |
| 2 | ESP32 ⇄ EMQX | MQTT `:1883` | Publica telemetría en `.../sdata` y se suscribe a `.../actdata` para recibir comandos |
| 3 | EMQX → MongoDB | Mongo | Autenticación y ACL de cada cliente MQTT (colección `emqxauthrules`) |
| 4 | EMQX → API | HTTP (webhook) | Las reglas de EMQX llaman a `/api/saver-webhook` (guardar datos) y `/api/alarm-webhook` (alarmas) |
| 5 | API → EMQX | HTTP `:8085` + MQTT `:1883` | API de gestión v4 para crear recursos y reglas; y cliente MQTT superusuario que publica las notificaciones `.../notif` |
| 6 | API ⇄ MongoDB | mongoose | Usuarios, dispositivos, plantillas, datos, reglas y notificaciones |
| 7 | Frontend → API | HTTP (axios) | Login, CRUD de dispositivos/plantillas/alarmas y obtención de las credenciales MQTT del usuario web |
| 8 | Frontend ⇄ EMQX | MQTT sobre WebSocket `:8083` | Se suscribe a `.../sdata` y `.../notif`; **publica en `.../actdata` los comandos de los widgets** (botón, switch) |

**Flujo de telemetría:** el ESP32 obtiene sus credenciales por HTTP [1], publica en `sdata` [2]; el frontend lo recibe en tiempo real por WebSocket [8] y, si el payload trae `save: 1`, la regla de EMQX llama al webhook [4] y la API lo guarda en MongoDB [6].

**Flujo de comandos (frontend → ESP32):** la API **no** reenvía los comandos. El frontend primero pide a la API sus credenciales MQTT [7] y luego publica directamente en el broker por WebSocket [8] en `{userId}/{dId}/{variable}/actdata`; EMQX entrega el mensaje al ESP32, que está suscrito a ese topic [2].

**Flujo de alarmas:** una regla de alarma en EMQX llama a `/api/alarm-webhook` [4]; la API guarda la notificación [6] y la publica en `{userId}/dummy-did/dummy-var/notif` [5], que el frontend recibe por WebSocket [8].

### Estructura del repositorio

| Carpeta | Contenido |
| --- | --- |
| `SERVICES/` | `docker-compose.yml` con MongoDB 6.0 y EMQX 4.4.19 |
| `APP/` | Frontend Nuxt 2 (raíz) y backend Express (`APP/api/`), comparten un solo `package.json` |
| `FIRMWARE/` | Proyecto PlatformIO para ESP32 (`esp32doit-devkit-v1`) |

### Topics MQTT

| Topic | Dirección | Uso |
| --- | --- | --- |
| `{userId}/{dId}/{variable}/sdata` | dispositivo → servidor | Telemetría. Se guarda en Mongo si el payload trae `save: 1` |
| `{userId}/{dId}/{variable}/actdata` | frontend → dispositivo | Comandos hacia actuadores (los publican los widgets del dashboard) |
| `{userId}/dummy-did/dummy-var/notif` | API → frontend | Notificaciones de alarmas |

---

## Requisitos previos

| Herramienta | Versión recomendada | Notas |
| --- | --- | --- |
| Docker + Docker Compose | v2 o superior | Para MongoDB y EMQX |
| Node.js | 16 o 18 (LTS) | Con Node 20+ ver la nota de `--openssl-legacy-provider` más abajo |
| npm | 8+ | |
| PlatformIO | Última | Extensión de VS Code o `pip install platformio` |

En Linux, el paquete `bcrypt` puede necesitar compilarse: instala `build-essential` y `python3` si `npm install` falla.

---

## Puertos

| Puerto | Servicio | Dónde corre |
| --- | --- | --- |
| 3000 | Frontend Nuxt | Host |
| 3001 | API Express | Host |
| 27017 | MongoDB | Docker |
| 1883 | MQTT TCP (dispositivos) | Docker |
| 8083 | MQTT sobre WebSocket (frontend) | Docker |
| 8883 | MQTT sobre TLS | Docker |
| 18083 | Dashboard web de EMQX | Docker |
| 8085 | API de gestión de EMQX (v4) | Docker (mapeado desde el 8081 interno) |

---

## Paso 1 — Levantar los servicios

Crea el archivo `SERVICES/.env` (está en `.gitignore`, por eso no viene en el repo):

```bash
# SERVICES/.env
TZ=America/Caracas                                              # libre: tu zona horaria

MONGO_USERNAME=TU_USUARIO_MONGO                                 # libre
MONGO_PASSWORD=TU_CLAVE_MONGO                                   # libre
MONGO_EXT_PORT=27017                                            # OBLIGATORIO: no lo cambies

EMQX_DEFAULT_USER_PASSWORD=TU_CLAVE_DEL_DASHBOARD_EMQX          # libre
EMQX_DEFAULT_APPLICATION_SECRET=TU_SECRETO_DE_APLICACION_EMQX   # libre
```

Los valores en mayúsculas son referenciales: reemplázalos por los tuyos. Elige claves propias, no las de este ejemplo. Los marcados como **OBLIGATORIO** son valores fijos que el proyecto espera; si los cambias, algo deja de funcionar.

> **Importante:** deja `MONGO_EXT_PORT=27017`. Ese valor se usa también para que EMQX se conecte a Mongo *dentro* de la red de Docker (`EMQX_AUTH__MONGO__SERVER: "mongo:${MONGO_EXT_PORT}"`), donde el contenedor siempre escucha en el 27017. Si lo cambias, la autenticación de EMQX deja de funcionar.

Levanta los contenedores:

```bash
cd SERVICES
docker compose up -d
docker compose ps
```

Verifica que EMQX arrancó entrando a <http://localhost:18083> con el usuario `admin` y la contraseña de `EMQX_DEFAULT_USER_PASSWORD`.

---

## Paso 2 — Configurar la aplicación

Crea el archivo `APP/.env`. Este archivo lo leen tanto la API (vía `dotenv`) como Nuxt:

```bash
# APP/.env

# --- API ---
API_PORT=3001                                                   # libre, pero debe coincidir con AXIOS_BASE_URL,
                                                                # con la URL del webhook y con el firmware

# --- MongoDB (debe coincidir con SERVICES/.env) ---
MONGO_USERNAME=TU_USUARIO_MONGO                                 # el mismo de SERVICES/.env
MONGO_PASSWORD=TU_CLAVE_MONGO                                   # la misma de SERVICES/.env
MONGO_HOST=localhost
MONGO_PORT=27017                                                # OBLIGATORIO
MONGO_DATABASE=iotgl2                                           # OBLIGATORIO: lo espera EMQX

# --- EMQX ---
EMQX_NODE_HOST=localhost
EMQX_DEFAULT_APPLICATION_SECRET=TU_SECRETO_DE_APLICACION_EMQX   # el mismo de SERVICES/.env
EMQX_API_TOKEN=TU_TOKEN_PARA_LOS_WEBHOOKS                       # libre
EMQX_NODE_SUPERUSER_USER=admin                                  # OBLIGATORIO: fijado en el código
EMQX_NODE_SUPERUSER_PASSWORD=emqxdashpass                       # OBLIGATORIO: fijado en el código
EMQX_RESOURCES_DELAY=10000                                      # libre: milisegundos de espera

# --- Frontend ---
AXIOS_BASE_URL=http://localhost:3001                            # debe apuntar al API_PORT
MQTT_PREFIX=ws://                                               # OBLIGATORIO
MQTT_HOST=localhost
MQTT_PORT=8083                                                  # OBLIGATORIO: puerto WebSocket de EMQX
```

Notas sobre estos valores:

- Los nombres en mayúsculas (`TU_USUARIO_MONGO`, `TU_CLAVE_MONGO`, etc.) son referenciales; ponlos con tus propios valores.
- `MONGO_USERNAME`, `MONGO_PASSWORD` y `EMQX_DEFAULT_APPLICATION_SECRET` tienen que ser **idénticos** a los que pusiste en `SERVICES/.env`.
- `MONGO_DATABASE` **debe** ser `iotgl2`: es el nombre que el `docker-compose.yml` le indica a EMQX para buscar las reglas de autenticación (`EMQX_AUTH__MONGO__DATABASE`).
- `EMQX_NODE_SUPERUSER_USER` / `EMQX_NODE_SUPERUSER_PASSWORD` son la excepción entre las claves: **no los inventes**, deben ser literalmente `admin` / `emqxdashpass`, porque son los valores con los que la API crea el superusuario MQTT en Mongo (función `check_mqtt_superuser` en `APP/api/routes/emqxapi.js`). Si cambias esa contraseña en el código, cámbiala también aquí.
- `EMQX_API_TOKEN` es un valor libre que tú eliges, pero se usa en los dos extremos: la API lo inyecta en las cabeceras de las reglas de EMQX y lo valida al recibir los webhooks.
- `EMQX_RESOURCES_DELAY` son milisegundos de espera antes de que la API consulte los recursos de EMQX; dale margen para que el broker termine de arrancar.
- Si cambias `API_PORT`, actualiza también `AXIOS_BASE_URL`, la URL del webhook en `APP/api/routes/emqxapi.js` y el `webhook_endpoint` del firmware.
- No hace falta configurar el puerto de la API de gestión de EMQX: el `8085` está escrito directamente en el código de la API.

### Ajustar la IP de los webhooks

EMQX corre dentro de Docker, así que para llamar a la API necesita una dirección del host, no `localhost`. Esa URL está escrita a mano en `APP/api/routes/emqxapi.js` (función `createResources`, en los objetos `data1` y `data2`):

```js
url: "http://192.168.0.102:3001",
```

Cámbiala por una de estas dos opciones:

- `http://host.docker.internal:3001` — funciona porque el `docker-compose.yml` ya define `extra_hosts: host.docker.internal:host-gateway`.
- `http://TU_IP_LAN:3001` — la IP de tu máquina en la red local (`ip addr` o `hostname -I`).

Si ya habías arrancado la API antes con la IP incorrecta, borra los recursos viejos en el dashboard de EMQX (<http://localhost:18083> → Resources) y reinicia la API. La API solo funciona con exactamente con 0 o 2 recursos: si encuentra otra cantidad, imprime una advertencia en bucle.

---

## Paso 3 — Instalar dependencias y arrancar

```bash
cd APP
npm install
```

`nodemon` no está en el `package.json`, instálalo si vas a usar el script `devn`:

```bash
npm install --save-dev nodemon
```

Abre **dos terminales**, ambas dentro de `APP/`:

```bash
# Terminal 1 — API (Express, puerto 3001)
npm run devn
```

```bash
# Terminal 2 — Frontend (Nuxt, puerto 3000)
npm run dev
```

La API está lista cuando ves `Susccesfully connected` (Mongo) y `MQTT CONNECTION -> success`. El frontend queda en <http://localhost:3000>.

> Nuxt 2.15 usa Webpack 4, que no arranca con Node 17+. Si ves `error:0308010C:digital envelope routines::unsupported`, usa Node 16/18 con `nvm use 18`, o exporta `NODE_OPTIONS=--openssl-legacy-provider` antes de `npm run dev`.

---

## Paso 4 — Primer uso del dashboard

1. Entra a <http://localhost:3000/register> y crea un usuario.
2. Inicia sesión. La API genera automáticamente las credenciales MQTT del usuario web y las guarda en la colección `emqxauthrules`.
3. Ve a **Templates** y crea una plantilla con las variables del dispositivo. El firmware de ejemplo espera este orden de variables:

   | Índice | Variable | Tipo |
   | --- | --- | --- |
   | 0 | temperatura | sensor |
   | 1 | humedad | sensor |
   | 2 | encender LED | actuador (`true`) |
   | 3 | apagar LED | actuador (`false`) |
   | 4 | estado del LED | indicador |

4. Ve a **Devices** y crea un dispositivo. Anota el **dId** y la **contraseña**: van al firmware.

---

## Paso 5 — Firmware del ESP32

Edita las constantes al inicio de `FIRMWARE/src/main.cpp`:

```cpp
String dId = "11111";                 // el dId del dispositivo creado en el dashboard
String webhook_pass = "CLAVE_DEL_DISPOSITIVO";  // la contraseña que generó el dashboard

// IP de la red LAN de la PC donde corre la API (no localhost)
String webhook_endpoint = "http://192.168.0.102:3001/api/getdevicescredentials";
// La misma IP LAN de la PC, aquí es donde EMQX expone el broker
const char* mqtt_server = "192.168.0.102";

// SSID y contraseña de la red WiFi a la que está conectada la PC
const char* wifi_ssid = "NOMBRE_DE_TU_RED_WIFI";
const char* wifi_password = "CLAVE_DE_TU_RED_WIFI";
```

`webhook_endpoint` y `mqtt_server` deben apuntar a la **IP de la red LAN de tu PC**, la que le asigna el router (algo como `192.168.x.x`). No sirve `localhost` ni `127.0.0.1`, porque desde el ESP32 esas direcciones se refieren al propio ESP32, no a tu computadora. Puedes obtenerla con:

```bash
hostname -I        # Linux
ip addr show       # Linux, más detallado
ipconfig           # Windows
```

`wifi_ssid` y `wifi_password` son los de **la red WiFi a la que está conectada tu PC**, no credenciales del proyecto. El ESP32 y la computadora tienen que estar en la misma red para que el ESP32 pueda alcanzar esa IP LAN.

> Esa IP suele cambiar cuando reinicias el router, ya que normalmente se asigna por DHCP. Si el ESP32 deja de conectar de un día para otro, vuelve a consultarla. Para evitarlo, puedes reservar una IP fija para tu PC en la configuración del router.

Compila y sube:

```bash
cd FIRMWARE
pio run --target upload
pio device monitor
```

El monitor serie va a 921600 baudios (definido en `platformio.ini`). La placa configurada es `esp32doit-devkit-v1`; cámbiala en `platformio.ini` si usas otra.

---

## Orden de arranque resumido

```bash
# 1. Servicios
cd SERVICES && docker compose up -d

# 2. API
cd ../APP && npm run devn

# 3. Frontend (otra terminal)
cd APP && npm run dev

# 4. Firmware (opcional)
cd FIRMWARE && pio run --target upload
```

Para detener los servicios:

```bash
cd SERVICES
docker compose down          # conserva los datos
docker compose down -v       # borra también los volúmenes de Mongo y EMQX
```

---

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `Connection Failed` al arrancar la API | Credenciales o host de Mongo incorrectos | Revisa que `MONGO_USERNAME`/`MONGO_PASSWORD` coincidan en los dos `.env` y que el contenedor esté arriba |
| `error:0308010C:digital envelope routines::unsupported` | Node 17+ con Webpack 4 | `nvm use 18` o `NODE_OPTIONS=--openssl-legacy-provider` |
| `DELETE ALL WEBHOOK RESOURCES AND RESTART NODE` en bucle | EMQX tiene una cantidad de recursos distinta de 0 o 2 | Borra todos los recursos en <http://localhost:18083> → Resources y reinicia la API |
| Los datos llegan al broker pero no se guardan en Mongo | La URL del webhook apunta a una IP inalcanzable desde el contenedor | Corrige la URL en `createResources` (`APP/api/routes/emqxapi.js`) y recrea los recursos |
| El ESP32 se reinicia con `Error getting mqtt credentials` | `dId`/`webhook_pass` no coinciden con el dispositivo, o el endpoint no es alcanzable | Verifica los datos del dispositivo y usa la IP LAN del host |
| El dispositivo no conecta al broker | EMQX rechaza conexiones anónimas (`EMQX_ALLOW_ANONYMOUS: false`) | Confirma que existe la regla en `emqxauthrules` para ese dispositivo |
| El frontend no recibe datos en tiempo real | El WebSocket no conecta | Revisa `MQTT_PREFIX`, `MQTT_HOST` y `MQTT_PORT=8083` en `APP/.env` |
| `nodemon: not found` | No está instalado | `npm install --save-dev nodemon` |

---

## Notas de seguridad

Esta configuración es para desarrollo local. Antes de exponer el proyecto:

- El secreto de firma de los JWT está escrito a mano en el código, en la llamada a `jwt.sign` de `APP/api/routes/users.js` y en `jwt.verify` de `APP/api/middlewares/authentication.js`. Muévelo a una variable de entorno y cambia el valor.
- La contraseña del superusuario MQTT también está en el código, en la función `check_mqtt_superuser` de `APP/api/routes/emqxapi.js`. Si la cambias ahí, actualiza `EMQX_NODE_SUPERUSER_PASSWORD` en `APP/.env` para que coincida.
- Las contraseñas MQTT se guardan en Mongo en texto plano (`EMQX_AUTH__MONGO__AUTH_QUERY__PASSWORD_HASH: plain`).
- El firmware lleva las credenciales WiFi y la clave del dispositivo escritas en `FIRMWARE/src/main.cpp`, que sí está versionado en git. Considera moverlas a un archivo ignorado o a `build_flags` en `platformio.ini`.
- Nunca subas los archivos `.env` al repositorio; ya están cubiertos por el `.gitignore`.
