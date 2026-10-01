# IoT Project v1

**English** | [Español](README.es.md)

A complete IoT platform: an MQTT broker with authentication against MongoDB, an Express API, a Nuxt 2 dashboard and ESP32 firmware.


---

## Architecture

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

**Protocols:** `MQTT :1883` is plain MQTT over TCP, used by the ESP32 [2] and by the API's superuser client [5]. `MQTT/WS :8083` is MQTT wrapped in WebSocket [8], because the browser can't open raw TCP connections. Both reach the same broker and share the same topics, so a command published over WebSocket reaches the ESP32 over TCP. `HTTP` connections are request/response: the arrow shows who starts the request.

| # | Connection | Protocol | Purpose |
| --- | --- | --- | --- |
| 1 | ESP32 → API | HTTP `:3001` | `POST /api/getdevicescredentials`: the device requests its MQTT credentials with its `dId` + password |
| 2 | ESP32 ⇄ EMQX | MQTT `:1883` | Publishes telemetry on `.../sdata` and subscribes to `.../actdata` to receive commands |
| 3 | EMQX → MongoDB | Mongo | Authentication and ACL for every MQTT client (`emqxauthrules` collection) |
| 4 | EMQX → API | HTTP (webhook) | EMQX rules call `/api/saver-webhook` (store data) and `/api/alarm-webhook` (alarms) |
| 5 | API → EMQX | HTTP `:8085` + MQTT `:1883` | v4 management API to create resources and rules; and an MQTT superuser client that publishes `.../notif` notifications |
| 6 | API ⇄ MongoDB | mongoose | Users, devices, templates, data, rules and notifications |
| 7 | Frontend → API | HTTP (axios) | Login, CRUD for devices/templates/alarms, and fetching the web user's MQTT credentials |
| 8 | Frontend ⇄ EMQX | MQTT over WebSocket `:8083` | Subscribes to `.../sdata` and `.../notif`; **publishes widget commands on `.../actdata`** (button, switch) |

**Telemetry flow:** the ESP32 gets its credentials over HTTP [1] and publishes on `sdata` [2]; the frontend receives it in real time over WebSocket [8] and, if the payload contains `save: 1`, the EMQX rule calls the webhook [4] and the API stores it in MongoDB [6].

**Command flow (frontend → ESP32):** the API does **not** relay commands. The frontend first asks the API for its MQTT credentials [7] and then publishes directly to the broker over WebSocket [8] on `{userId}/{dId}/{variable}/actdata`; EMQX delivers the message to the ESP32, which is subscribed to that topic [2].

**Alarm flow:** an alarm rule in EMQX calls `/api/alarm-webhook` [4]; the API stores the notification [6] and publishes it on `{userId}/dummy-did/dummy-var/notif` [5], which the frontend receives over WebSocket [8].

### Repository structure

| Folder | Contents |
| --- | --- |
| `SERVICES/` | `docker-compose.yml` with MongoDB 6.0 and EMQX 4.4.19 |
| `APP/` | Nuxt 2 frontend (root) and Express backend (`APP/api/`), sharing a single `package.json` |
| `FIRMWARE/` | PlatformIO project for the ESP32 (`esp32doit-devkit-v1`) |

### MQTT topics

| Topic | Direction | Use |
| --- | --- | --- |
| `{userId}/{dId}/{variable}/sdata` | device → server | Telemetry. Stored in Mongo if the payload contains `save: 1` |
| `{userId}/{dId}/{variable}/actdata` | frontend → device | Commands for actuators (published by the dashboard widgets) |
| `{userId}/dummy-did/dummy-var/notif` | API → frontend | Alarm notifications |

---

## Prerequisites

| Tool | Recommended version | Notes |
| --- | --- | --- |
| Docker + Docker Compose | v2 or later | For MongoDB and EMQX |
| Node.js | 16 or 18 (LTS) | With Node 20+, see the `--openssl-legacy-provider` note below |
| npm | 8+ | |
| PlatformIO | Latest | VS Code extension or `pip install platformio` |

On Linux, the `bcrypt` package may need to be compiled: install `build-essential` and `python3` if `npm install` fails.

---

## Ports

| Port | Service | Where it runs |
| --- | --- | --- |
| 3000 | Nuxt frontend | Host |
| 3001 | Express API | Host |
| 27017 | MongoDB | Docker |
| 1883 | MQTT TCP (devices) | Docker |
| 8083 | MQTT over WebSocket (frontend) | Docker |
| 8883 | MQTT over TLS | Docker |
| 18083 | EMQX web dashboard | Docker |
| 8085 | EMQX management API (v4) | Docker (mapped from internal port 8081) |

---

## Step 1 — Start the services

Create the file `SERVICES/.env` (it's in `.gitignore`, which is why it isn't in the repo):

```bash
# SERVICES/.env
TZ=America/Caracas                                              # free: your time zone

MONGO_USERNAME=YOUR_MONGO_USER                                  # free
MONGO_PASSWORD=YOUR_MONGO_PASSWORD                              # free
MONGO_EXT_PORT=27017                                            # REQUIRED: don't change it

EMQX_DEFAULT_USER_PASSWORD=YOUR_EMQX_DASHBOARD_PASSWORD         # free
EMQX_DEFAULT_APPLICATION_SECRET=YOUR_EMQX_APPLICATION_SECRET    # free
```

The uppercase values are placeholders: replace them with your own. Choose your own passwords, not the ones in this example. Values marked **REQUIRED** are fixed values the project expects; if you change them, something stops working.

> **Important:** keep `MONGO_EXT_PORT=27017`. This value is also used for EMQX to connect to Mongo *inside* the Docker network (`EMQX_AUTH__MONGO__SERVER: "mongo:${MONGO_EXT_PORT}"`), where the container always listens on 27017. If you change it, EMQX authentication stops working.

Start the containers:

```bash
cd SERVICES
docker compose up -d
docker compose ps
```

Check that EMQX started by opening <http://localhost:18083> with the user `admin` and the password from `EMQX_DEFAULT_USER_PASSWORD`.

---

## Step 2 — Configure the application

Create the file `APP/.env`. It's read by both the API (via `dotenv`) and Nuxt:

```bash
# APP/.env

# --- API ---
API_PORT=3001                                                   # free, but must match AXIOS_BASE_URL,
                                                                # the webhook URL and the firmware

# --- MongoDB (must match SERVICES/.env) ---
MONGO_USERNAME=YOUR_MONGO_USER                                  # same as in SERVICES/.env
MONGO_PASSWORD=YOUR_MONGO_PASSWORD                              # same as in SERVICES/.env
MONGO_HOST=localhost
MONGO_PORT=27017                                                # REQUIRED
MONGO_DATABASE=iotgl2                                           # REQUIRED: EMQX expects it

# --- EMQX ---
EMQX_NODE_HOST=localhost
EMQX_DEFAULT_APPLICATION_SECRET=YOUR_EMQX_APPLICATION_SECRET    # same as in SERVICES/.env
EMQX_API_TOKEN=YOUR_WEBHOOK_TOKEN                               # free
EMQX_NODE_SUPERUSER_USER=admin                                  # REQUIRED: hardcoded
EMQX_NODE_SUPERUSER_PASSWORD=emqxdashpass                       # REQUIRED: hardcoded
EMQX_RESOURCES_DELAY=10000                                      # free: wait time in milliseconds

# --- Frontend ---
AXIOS_BASE_URL=http://localhost:3001                            # must point to API_PORT
MQTT_PREFIX=ws://                                               # REQUIRED
MQTT_HOST=localhost
MQTT_PORT=8083                                                  # REQUIRED: EMQX WebSocket port
```

Notes on these values:

- The uppercase names (`YOUR_MONGO_USER`, `YOUR_MONGO_PASSWORD`, etc.) are placeholders; fill them in with your own values.
- `MONGO_USERNAME`, `MONGO_PASSWORD` and `EMQX_DEFAULT_APPLICATION_SECRET` must be **identical** to the ones in `SERVICES/.env`.
- `MONGO_DATABASE` **must** be `iotgl2`: it's the name `docker-compose.yml` gives EMQX to look up the authentication rules (`EMQX_AUTH__MONGO__DATABASE`).
- `EMQX_NODE_SUPERUSER_USER` / `EMQX_NODE_SUPERUSER_PASSWORD` are the exception among the credentials: **don't make them up**. They must be literally `admin` / `emqxdashpass`, because those are the values the API uses to create the MQTT superuser in Mongo (function `check_mqtt_superuser` in `APP/api/routes/emqxapi.js`). If you change that password in the code, change it here too.
- `EMQX_API_TOKEN` is a free value you choose, but it's used on both ends: the API injects it into the headers of the EMQX rules and checks it when it receives the webhooks.
- `EMQX_RESOURCES_DELAY` is how many milliseconds the API waits before querying the EMQX resources; give the broker enough time to finish starting.
- If you change `API_PORT`, also update `AXIOS_BASE_URL`, the webhook URL in `APP/api/routes/emqxapi.js` and the firmware's `webhook_endpoint`.
- You don't need to configure the EMQX management API port: `8085` is hardcoded in the API.

### Set the webhook IP

EMQX runs inside Docker, so to call the API it needs a host address, not `localhost`. That URL is hardcoded in `APP/api/routes/emqxapi.js` (function `createResources`, in the `data1` and `data2` objects):

```js
url: "http://192.168.0.102:3001",
```

Change it to one of these two options:

- `http://host.docker.internal:3001` — works because `docker-compose.yml` already defines `extra_hosts: host.docker.internal:host-gateway`.
- `http://YOUR_LAN_IP:3001` — your machine's IP on the local network (`ip addr` or `hostname -I`).

If you already started the API with the wrong IP, delete the old resources in the EMQX dashboard (<http://localhost:18083> → Resources) and restart the API. The API only works with exactly 0 or 2 resources: if it finds any other number, it prints a warning in a loop.

---

## Step 3 — Install dependencies and start

```bash
cd APP
npm install
```

`nodemon` isn't in `package.json`; install it if you'll use the `devn` script:

```bash
npm install --save-dev nodemon
```

Open **two terminals**, both inside `APP/`:

```bash
# Terminal 1 — API (Express, port 3001)
npm run devn
```

```bash
# Terminal 2 — Frontend (Nuxt, port 3000)
npm run dev
```

The API is ready when you see `Susccesfully connected` (Mongo) and `MQTT CONNECTION -> success`. The frontend runs at <http://localhost:3000>.

> Nuxt 2.15 uses Webpack 4, which doesn't start on Node 17+. If you see `error:0308010C:digital envelope routines::unsupported`, use Node 16/18 with `nvm use 18`, or export `NODE_OPTIONS=--openssl-legacy-provider` before `npm run dev`.

---

## Step 4 — First use of the dashboard

1. Go to <http://localhost:3000/register> and create a user.
2. Log in. The API automatically generates the web user's MQTT credentials and stores them in the `emqxauthrules` collection.
3. Go to **Templates** and create a template with the device's variables. The example firmware expects the variables in this order:

   | Index | Variable | Type |
   | --- | --- | --- |
   | 0 | temperature | sensor |
   | 1 | humidity | sensor |
   | 2 | turn LED on | actuator (`true`) |
   | 3 | turn LED off | actuator (`false`) |
   | 4 | LED status | indicator |

4. Go to **Devices** and create a device. Write down the **dId** and the **password**: they go in the firmware.

---

## Step 5 — ESP32 firmware

Edit the constants at the top of `FIRMWARE/src/main.cpp`:

```cpp
String dId = "11111";                 // the dId of the device created in the dashboard
String webhook_pass = "DEVICE_PASSWORD";  // the password the dashboard generated

// LAN IP of the PC running the API (not localhost)
String webhook_endpoint = "http://192.168.0.102:3001/api/getdevicescredentials";
// The same LAN IP of the PC; this is where EMQX exposes the broker
const char* mqtt_server = "192.168.0.102";

// SSID and password of the WiFi network the PC is connected to
const char* wifi_ssid = "YOUR_WIFI_NETWORK_NAME";
const char* wifi_password = "YOUR_WIFI_PASSWORD";
```

`webhook_endpoint` and `mqtt_server` must point to **your PC's LAN IP**, the one the router assigns to it (something like `192.168.x.x`). `localhost` and `127.0.0.1` don't work, because from the ESP32 those addresses refer to the ESP32 itself, not your computer. You can find it with:

```bash
hostname -I        # Linux
ip addr show       # Linux, more detail
ipconfig           # Windows
```

`wifi_ssid` and `wifi_password` are those of **the WiFi network your PC is connected to**, not project credentials. The ESP32 and the computer must be on the same network for the ESP32 to reach that LAN IP.

> That IP often changes when you restart the router, since it's usually assigned by DHCP. If the ESP32 stops connecting from one day to the next, check it again. To avoid this, you can reserve a fixed IP for your PC in the router settings.

Build and upload:

```bash
cd FIRMWARE
pio run --target upload
pio device monitor
```

The serial monitor runs at 921600 baud (set in `platformio.ini`). The configured board is `esp32doit-devkit-v1`; change it in `platformio.ini` if you use a different one.

---

## Startup order summary

```bash
# 1. Services
cd SERVICES && docker compose up -d

# 2. API
cd ../APP && npm run devn

# 3. Frontend (another terminal)
cd APP && npm run dev

# 4. Firmware (optional)
cd FIRMWARE && pio run --target upload
```

To stop the services:

```bash
cd SERVICES
docker compose down          # keeps the data
docker compose down -v       # also deletes the Mongo and EMQX volumes
```

---

## Troubleshooting

| Symptom | Likely cause | Solution |
| --- | --- | --- |
| `Connection Failed` when starting the API | Wrong Mongo credentials or host | Check that `MONGO_USERNAME`/`MONGO_PASSWORD` match in both `.env` files and that the container is up |
| `error:0308010C:digital envelope routines::unsupported` | Node 17+ with Webpack 4 | `nvm use 18` or `NODE_OPTIONS=--openssl-legacy-provider` |
| `DELETE ALL WEBHOOK RESOURCES AND RESTART NODE` in a loop | EMQX has a number of resources other than 0 or 2 | Delete all resources at <http://localhost:18083> → Resources and restart the API |
| Data reaches the broker but isn't stored in Mongo | The webhook URL points to an IP the container can't reach | Fix the URL in `createResources` (`APP/api/routes/emqxapi.js`) and recreate the resources |
| The ESP32 restarts with `Error getting mqtt credentials` | `dId`/`webhook_pass` don't match the device, or the endpoint isn't reachable | Check the device data and use the host's LAN IP |
| The device doesn't connect to the broker | EMQX rejects anonymous connections (`EMQX_ALLOW_ANONYMOUS: false`) | Confirm that the rule for that device exists in `emqxauthrules` |
| The frontend doesn't receive real-time data | The WebSocket doesn't connect | Check `MQTT_PREFIX`, `MQTT_HOST` and `MQTT_PORT=8083` in `APP/.env` |
| `nodemon: not found` | It isn't installed | `npm install --save-dev nodemon` |

---

## Security notes

This setup is for local development. Before exposing the project:

- The JWT signing secret is hardcoded, in the `jwt.sign` call in `APP/api/routes/users.js` and in `jwt.verify` in `APP/api/middlewares/authentication.js`. Move it to an environment variable and change the value.
- The MQTT superuser password is also hardcoded, in the `check_mqtt_superuser` function in `APP/api/routes/emqxapi.js`. If you change it there, update `EMQX_NODE_SUPERUSER_PASSWORD` in `APP/.env` to match.
- MQTT passwords are stored in Mongo in plain text (`EMQX_AUTH__MONGO__AUTH_QUERY__PASSWORD_HASH: plain`).
- The firmware has the WiFi credentials and the device password hardcoded in `FIRMWARE/src/main.cpp`, which is tracked in git. Consider moving them to an ignored file or to `build_flags` in `platformio.ini`.
- Never commit the `.env` files to the repository; they're already covered by `.gitignore`.
