# AgroSense — Smart Irrigation Management System

AgroSense is a full-stack smart agriculture and irrigation platform that combines live field-sensor data, weather forecasts, crop-stage information, irrigation controls, and soil/crop analytics. It provides farmers with a web dashboard to monitor farms and devices, manage crop schedules, inspect weather conditions, review irrigation activity, and run soil digital-twin simulations.

The repository contains a React/Vite frontend and a Node.js/Express backend. MongoDB stores application and operational records, Firebase provides authentication and real-time hardware communication, and InfluxDB is used for time-series sensor analytics.

> **Deployment note:** This README documents the implementation present in this repository. Hardware communication currently contains single-farm Firebase path assumptions (notably `smartirrigation/FARMID1`) in parts of the backend. Review the integration notes before deploying for multiple independent farms.

---

## Contents

- [Features](#features)
- [System architecture](#system-architecture)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Run locally](#run-locally)
- [Docker: InfluxDB](#docker-influxdb)
- [Application modules](#application-modules)
- [Background jobs](#background-jobs)
- [API reference](#api-reference)
- [Firebase data integration](#firebase-data-integration)
- [AI and decision-engine details](#ai-and-decision-engine-details)
- [Data storage](#data-storage)
- [Security considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [Current implementation notes](#current-implementation-notes)

---

## Features

### Farmer workspace

- Email/password and Google authentication through Firebase Authentication.
- Farmer profile and notification-preference management.
- Multiple farm records, farm selection, area and soil information.
- Device verification, activation, and farm linking.
- Farm dashboard with sensor status, motor status, weather summary, crop information, and recent activity.
- Live Firebase Realtime Database updates in the frontend where subscribed by the page.
- Sensor history and irrigation-event history.

### Irrigation management

- Manual pump/motor control through the backend and Firebase Realtime Database.
- Automatic irrigation evaluation using soil moisture, crop-stage moisture thresholds, and forecast precipitation probability.
- Pre-irrigation warning before a scheduled automatic start.
- Irrigation event records with duration and estimated water usage.
- Hourly failsafe job to close stale irrigation events.

### Weather and crop management

- Current weather and forecast retrieval from OpenWeather.
- Weather caching and persistence in MongoDB.
- Crop schedules with sowing date, crop type, soil type, and stage-specific moisture thresholds.
- Default crop-stage schedules and custom stage support.
- Weather-aware irrigation recommendations.

### AI-assisted insights

- Soil digital-twin simulation over a 72-hour horizon, with six-hour simulation steps.
- Soil water-balance estimation using rainfall, evapotranspiration, and drainage.
- Crop coefficient (`Kc`) and soil-property profiles for supported crop/soil categories.
- Plant-stress pattern analysis, including heat, drought, waterlogging, nutrient-uptake, and root-zone stress signatures.
- What-if simulation endpoint for testing moisture, weather, crop, soil, and irrigation inputs.

The current AI engine is implemented as deterministic JavaScript calculations and pattern analysis; it does not require a separately trained machine-learning model.

### Notifications and administration

- In-app notifications.
- Optional Firebase push notification and Twilio SMS integrations, subject to configuration.
- Admin dashboard, farmer listing/search, system statistics, and account activation controls.
- Device inventory and device deactivation operations for administrators.

---

## System architecture

```text
┌────────────────────────────────────────────────────────────┐
│                     React + Vite frontend                   │
│  Dashboard | Farms | Weather | AI | Notifications | Admin   │
└──────────────────────────────┬─────────────────────────────┘
                               │ HTTP /api + Firebase Auth token
                               ▼
┌────────────────────────────────────────────────────────────┐
│                  Node.js + Express backend                 │
│                                                            │
│  Auth middleware | REST routes | Controllers | Services    │
│  Irrigation engine | Weather service | AI engine | Cron     │
└───────────────┬───────────────────┬────────────────────────┘
                │                   │
       ┌────────▼────────┐  ┌───────▼────────────────┐
       │    MongoDB      │  │ Firebase               │
       │ Users, farms,   │  │ Authentication         │
       │ crops, events,  │  │ Realtime Database      │
       │ weather, alerts │  │ Sensor/pump state      │
       └─────────────────┘  └────────┬───────────────┘
                                     │ RTDB listener
                                     ▼
                           ┌──────────────────────┐
                           │      InfluxDB        │
                           │ Time-series sensor   │
                           │ and event telemetry  │
                           └──────────────────────┘

External service: OpenWeather API
Optional services: Firebase Cloud Messaging, Twilio SMS
```

### Main data flow

1. A farmer signs in using Firebase Authentication.
2. The frontend obtains a Firebase ID token and sends it as a Bearer token to protected backend endpoints.
3. The backend verifies the token and resolves the application user from MongoDB using the Firebase UID.
4. Hardware publishes sensor and pump information to Firebase Realtime Database.
5. Backend listeners and scheduled jobs read the configured RTDB paths and persist data for operational history and analytics.
6. Weather data is fetched for the selected farm's coordinates and stored in MongoDB.
7. The irrigation service evaluates moisture, crop-stage thresholds, and forecast rain before deciding whether to schedule irrigation.
8. The AI service combines stored sensor history, weather, crop, and farm context to build a digital-twin simulation and stress report.

---

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite 5, JavaScript |
| Routing and state | React Router, React Query, Zustand |
| UI and styling | Tailwind CSS, Lucide React, custom components |
| Charts and maps | Recharts, Leaflet, React Leaflet |
| HTTP client | Axios |
| Backend | Node.js 20+, Express 4 |
| Authentication | Firebase Authentication, Firebase Admin SDK |
| Application database | MongoDB, Mongoose |
| Realtime/hardware data | Firebase Realtime Database |
| Time-series database | InfluxDB 2.x |
| Weather | OpenWeather API |
| Scheduling | node-cron |
| Logging and middleware | Winston, Morgan, Helmet, CORS, compression, express-rate-limit |
| Optional messaging | Firebase Cloud Messaging, Twilio |
| Container support | Docker, Docker Compose |

---

## Repository structure

```text
smart_irrigation/
├── backend/
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   ├── firebase.js          # Firebase Admin initialization
│   │   └── influxdb.js          # InfluxDB client and write/query APIs
│   ├── controllers/             # Request handlers
│   ├── jobs/
│   │   └── cronJobs.js          # Scheduled weather, sensor and irrigation jobs
│   ├── middleware/
│   │   └── Auth.js              # Firebase token and role authorization
│   ├── models/                  # Mongoose schemas
│   ├── routes/                  # Express API route definitions
│   ├── scripts/                 # Seed and simulator utilities
│   ├── services/
│   │   ├── aiEngineService.js   # Soil digital twin and stress analysis
│   │   ├── aiService.js         # AI-related service helpers
│   │   ├── irrigationService.js # Irrigation decisions and pump control
│   │   ├── notificationService.js
│   │   ├── rtdbPipeline.js      # Firebase RTDB → InfluxDB pipeline
│   │   └── weatherService.js
│   ├── utils/
│   ├── Dockerfile
│   ├── docker-compose.yml       # InfluxDB service
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/          # Admin, analytics, crop, dashboard,
    │   │                        # irrigation, map, notification, UI and weather
    │   ├── config/
    │   │   └── firebase.js
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── hooks/
    │   ├── pages/
    │   ├── services/
    │   │   └── api.js
    │   ├── App.jsx
    │   └── main.jsx
    ├── package.json
    └── vite.config.js
```

---

## Prerequisites

Install or provision:

- Node.js 20 or later and npm.
- MongoDB (local instance or MongoDB Atlas).
- A Firebase project with **Authentication** and **Realtime Database** enabled.
- An InfluxDB 2.x instance.
- An OpenWeather API key.
- Optional: Firebase Cloud Messaging credentials and Twilio credentials for push/SMS notifications.
- Optional: Docker Desktop or Docker Engine to run InfluxDB using the supplied Compose file.

You will need access to the Firebase project configuration and service-account credentials. Do not commit credentials to source control.

---

## Configuration

Create separate environment files for the backend and frontend. The archive contains local `.env` files; do not copy their secret values into documentation or commit them. Use the variable names below and provide your own credentials.

### 1. Backend environment

Create `backend/.env`:

```dotenv
# Application
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000

# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/agrosense

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/

# OpenWeather
OPENWEATHER_API_KEY=your-openweather-api-key
OPENWEATHER_BASE_URL=https://api.openweathermap.org/data/2.5

# InfluxDB 2.x
INFLUX_URL=http://localhost:8086
INFLUX_TOKEN=your-influxdb-token
INFLUX_ORG=agrosense
INFLUX_BUCKET=sensor_data

# Optional integrations
OPENCAGE_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

`FIREBASE_PRIVATE_KEY` must contain the service-account private key. The backend configuration converts escaped `\n` sequences into newline characters.

The AI engine currently uses local JavaScript calculations. An OpenAI key is not required by the digital-twin implementation described above.

The following cache settings are also read by backend code and can be configured if needed:

```dotenv
TWIN_CACHE_TTL=
STRESS_CACHE_TTL=
IRRIG_DECISION_CACHE_TTL=
```

Leave these unset unless the corresponding cache behavior has been reviewed in the service implementation.

### 2. Frontend environment

Create `frontend/.env`:

```dotenv
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-firebase-web-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

These `VITE_` variables are bundled into the browser application. They must not contain private keys, service-account credentials, database passwords, or other server-side secrets. Configure Firebase Authentication's authorized domains and the required sign-in providers in the Firebase console.

---

## Run locally

Run the backend and frontend in separate terminals.

### 1. Start MongoDB

Start your local MongoDB service or configure `MONGO_URI` to point to your MongoDB deployment.

### 2. Start InfluxDB

From the backend directory:

```bash
cd backend
docker compose up -d influxdb
```

The InfluxDB UI/API is available at:

```text
http://localhost:8086
```

The Compose file initializes the organization, bucket, username, password, and admin token from environment variables, with development defaults in the Compose configuration. Set secure values before using it outside local development.

If you use an existing InfluxDB instance instead, create the organization and bucket and set `INFLUX_URL`, `INFLUX_ORG`, `INFLUX_BUCKET`, and `INFLUX_TOKEN` accordingly.

### 3. Install and run the backend

```bash
cd backend
npm install
npm run dev
```

The API listens on:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/health
```

For production:

```bash
npm start
```

### 4. Install and run the frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Vite proxies requests beginning with `/api` to `http://localhost:5000`, so the frontend uses relative API URLs.

### 5. Build the frontend

```bash
cd frontend
npm run build
npm run preview
```

The production build is generated in `frontend/dist`.

---

## Docker: InfluxDB

The supplied `backend/docker-compose.yml` defines an InfluxDB 2.7 service with persistent Docker volumes.

```bash
cd backend
docker compose up -d
docker compose ps
docker compose logs -f influxdb
docker compose down
```

To stop the container without deleting stored data, use `docker compose down`. To delete the persisted InfluxDB data as well, remove the named volumes explicitly; this is destructive.

The backend itself can also be built using the supplied Dockerfile:

```bash
cd backend
docker build -t agrosense-backend .
docker run --env-file .env -p 5000:5000 agrosense-backend
```

The backend container must be able to reach MongoDB, Firebase, and InfluxDB. When running in Docker, `localhost` inside the backend container refers to that container, not the host machine. Configure service hostnames or host-gateway networking as appropriate.

---

## Application modules

| Module | Purpose |
|---|---|
| Authentication | Registration, login, Firebase token verification, profile updates, account deletion |
| Dashboard | Farm overview, sensor indicators, motor status, crop and weather summaries, recent activity |
| Farms | Farm records, active farm selection, crop and sensor views, irrigation controls and history |
| Weather | Current conditions, forecast, weather impact and irrigation recommendations |
| AI | Digital-twin output, crop stress report, simulation and what-if scenarios |
| Notifications | In-app notification list and read/unread management |
| Settings | Profile, notification preferences, farm and hardware-device management |
| Admin | Farmer overview, system metrics, user activation/deactivation and device administration |

The analytics page and several other screens/components exist in the source tree, but route availability should be checked in `frontend/src/App.jsx` before assuming a page is reachable. In the current App configuration, the standalone `/analytics` route is commented out.

---

## Background jobs

The backend starts scheduled jobs when the Express server starts.

| Job | Schedule | Current behavior |
|---|---|---|
| Weather fetch | 06:00 and 18:00 daily | Fetches and stores weather for farms belonging to active farmers |
| Sensor sync | Every 5 minutes | Reads configured Firebase sensor nodes and writes sensor readings to MongoDB |
| Irrigation decision | Every 15 minutes | Evaluates irrigation need and schedules automatic irrigation when conditions qualify |
| Irrigation failsafe | Every hour | Closes irrigation events that have remained running for more than two hours |

All schedules use the server's local timezone unless explicitly configured otherwise. Set the host/container timezone deliberately if job execution must follow a particular regional timezone.

The irrigation service includes a pre-irrigation warning flow. The notification service can create an in-app notification and attempt push/SMS delivery depending on the user's settings and configured credentials.

---

## API reference

All API routes are prefixed with `/api`. Except for the explicitly public routes, endpoints require:

```http
Authorization: Bearer <Firebase_ID_Token>
```

The backend verifies the Firebase ID token using Firebase Admin and maps the Firebase UID to a MongoDB user.

### Health

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | API and MongoDB connection status |

### Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register application user |
| POST | `/api/auth/login` | Public | Login endpoint |
| GET | `/api/auth/me` | Authenticated | Get current user |
| PUT | `/api/auth/profile` | Authenticated | Update profile/preferences |
| DELETE | `/api/auth/account` | Authenticated | Delete account |

Firebase Authentication is the identity provider used by the frontend and protected backend middleware. Follow the request-body validation and response shape in the corresponding controller when integrating another client.

### Farms and devices

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/farms` | Authenticated | List farms and active farm index |
| POST | `/api/farms` | Authenticated | Add a farm |
| PUT | `/api/farms/:farmIndex` | Authenticated | Update a farm |
| PATCH | `/api/farms/active/:farmIndex` | Authenticated | Set active farm |
| PUT | `/api/farms/:farmIndex/boundary` | Authenticated | Save farm boundary |
| POST | `/api/devices/verify` | Public | Verify device ID and activation code |
| POST | `/api/devices/activate` | Authenticated | Link a verified device to a farm |
| GET | `/api/devices/my` | Authenticated | List current user's devices |
| GET | `/api/devices` | Admin | List devices |
| POST | `/api/devices/seed` | Admin | Seed device inventory |
| PATCH | `/api/devices/:deviceId/deactivate` | Admin | Deactivate a device |

### Sensors and irrigation

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/sensors/latest` | Authenticated | Latest sensor data |
| GET | `/api/sensors/history` | Authenticated | Sensor history |
| GET | `/api/sensors/stats` | Authenticated | Sensor statistics |
| GET | `/api/irrigation/status` | Authenticated | Current pump/irrigation status and decision context |
| POST | `/api/irrigation/control` | Authenticated | Manual pump control |
| GET | `/api/irrigation/history` | Authenticated | Irrigation event history |
| GET | `/api/irrigation/stats` | Authenticated | Irrigation statistics |

The control endpoint accepts an action and a confirmation flag; inspect `backend/controllers/irrigationController.js` for the accepted action values and confirmation behavior.

### Crops and weather

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/crops/schedules` | Authenticated | List crop schedules |
| GET | `/api/crops/active` | Authenticated | Get active crop schedule and stage |
| POST | `/api/crops/schedules` | Authenticated | Create crop schedule |
| PUT | `/api/crops/schedules/:id` | Authenticated | Update crop schedule |
| DELETE | `/api/crops/schedules/:id` | Authenticated | Delete crop schedule |
| GET | `/api/crops/defaults/:cropType` | Authenticated | Get default crop stages |
| GET | `/api/weather/current` | Authenticated | Current weather for active farm |
| GET | `/api/weather/forecast` | Authenticated | Daily and hourly forecast |
| POST | `/api/weather/refresh` | Authenticated | Force weather refresh |
| GET | `/api/weather/history` | Authenticated | Stored weather history |

### AI, analytics, notifications and administration

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/ai/digital-twin` | Authenticated | Build soil digital twin and stress analysis |
| GET | `/api/ai/stress` | Authenticated | Generate plant-stress report |
| POST | `/api/ai/simulate` | Authenticated | Run a what-if soil simulation |
| GET | `/api/analytics/overview` | Authenticated | Aggregated sensor and irrigation overview |
| GET | `/api/analytics/moisture-trend` | Authenticated | Daily soil-moisture trend |
| GET | `/api/analytics/irrigation-activity` | Authenticated | Irrigation activity |
| GET | `/api/analytics/water-usage` | Authenticated | Water-usage aggregation |
| GET | `/api/analytics/heatmap` | Authenticated | Calendar-style activity data |
| GET | `/api/notifications` | Authenticated | List notifications |
| PATCH | `/api/notifications/read` | Authenticated | Mark notifications as read |
| GET | `/api/admin/dashboard` | Admin | Admin dashboard metrics |
| GET | `/api/admin/farmers` | Admin | Search/list farmers |
| GET | `/api/admin/system-stats` | Admin | System statistics |
| PATCH | `/api/admin/users/:id/toggle` | Admin | Toggle user active state |

For exact query parameters, request payloads, validation rules, and response examples, refer to the relevant route and controller files. The API list above reflects the routes mounted in `backend/server.js`.

---

## Firebase data integration

Firebase has two distinct roles:

1. **Firebase Authentication:** signs users in and issues ID tokens.
2. **Firebase Realtime Database:** transports sensor readings and pump-control state between hardware and the backend/frontend.

### Frontend authentication

The frontend Axios client obtains the current Firebase user's ID token and attaches it to API requests:

```http
Authorization: Bearer <Firebase_ID_Token>
```

### Realtime Database paths

The device activation controller initializes per-farm paths in this structure:

```text
farm_meta/{farmId}/
  ownerId
  name
  linkedAt

irrigation_control/{farmId}/
  SensorReading
  switch
  precipitation
  lastUpdated
  triggeredBy
  eventId

sensor_history/{farmId}/latest/
  moisture
  temperature
  humidity
  pH
  nitrogen
  phosphorus
  potassium
  timestamp
  _placeholder

device_presence/{deviceId}/
  farmId
  online
  lastSeen
```

The device firmware should publish values using the same field names and expected types. For example, `switch` is expected to be `"ON"` or `"OFF"` in the per-farm initialization structure.

**Important:** Some current backend services still read/write `smartirrigation/FARMID1` and use node-level fields such as `node1.sensor_moisture`. This is a separate hard-coded integration path from the per-farm `irrigation_control/{farmId}` structure shown above. Align the firmware and backend paths before expecting every multi-farm feature to work end-to-end.

---

## AI and decision-engine details

### Irrigation decision logic

The irrigation service evaluates:

- Average soil moisture from configured sensor nodes.
- The active crop schedule's current growth stage and its moisture threshold.
- Maximum precipitation probability in the near-term hourly forecast.

The current decision condition is:

```text
soil moisture < crop-stage threshold
AND
forecast rain probability < 70%
```

When irrigation is required, the service can issue a pre-irrigation alert and schedule a delayed re-check before starting the pump. The condition is evaluated again before automatic start so that changed weather or moisture conditions can prevent unnecessary irrigation.

### Soil digital twin

The digital-twin service uses a simplified soil-water balance:

```text
Change in soil moisture
    = effective rainfall
    - crop evapotranspiration
    - soil drainage
    + recent irrigation contribution
```

The simulation projects up to 72 hours in six-hour steps. Soil properties affect field capacity, wilting point, drainage rate, and moisture response. Crop coefficients vary by crop and growth stage.

### Plant stress detection

The stress engine analyzes recent sensor windows for patterns associated with:

- Heat stress
- Drought stress
- Waterlogging
- Nutrient-uptake stress
- Root-zone stress

The output includes stress labels, signal evidence, confidence/risk information, and recommendations as implemented by the service. These are decision-support estimates, not a substitute for agronomic assessment or calibrated field measurements.

---

## Data storage

The backend uses MongoDB models for application and operational records, including:

- `User`
- `HardwareDevice`
- `SensorReading`
- `IrrigationEvent`
- `CropSchedule`
- `WeatherData`
- `Notification`

InfluxDB is configured for time-series writes and Flux queries. The RTDB pipeline writes sensor and pump-event measurements, while analytics endpoints query InfluxDB and combine those results with irrigation records from MongoDB.

---

## Security considerations

Before deploying:

- Never commit `.env` files, Firebase service-account keys, API tokens, or Twilio credentials.
- Rotate any credential that has been exposed in a repository, archive, log, screenshot, or shared environment.
- Use a dedicated least-privilege InfluxDB token; do not use an administrator token for routine application writes/queries.
- Set strong MongoDB credentials and restrict database network access.
- Configure Firebase Realtime Database security rules so only authorized clients/devices can access the required paths.
- Keep Firebase Admin credentials exclusively on the backend.
- Configure CORS to allow only the actual frontend origin.
- Use HTTPS in production.
- Validate and authorize all device-control requests; physical pump operation can cause crop, equipment, or water damage.
- Review rate limits, account activation, device activation attempt limits, and admin access before public deployment.
- Do not expose internal error stacks or sensitive logs in production.

---

## Troubleshooting

### Backend exits during startup

Check that `backend/.env` exists and that MongoDB, Firebase Admin, OpenWeather, and InfluxDB configuration values are valid. The weather service requires `OPENWEATHER_API_KEY`; Firebase Admin initialization requires valid service-account fields.

### MongoDB connection failure

- Confirm MongoDB is running and reachable.
- Verify `MONGO_URI`.
- Check Atlas IP access rules and database-user permissions if using MongoDB Atlas.

### Firebase authentication returns 401

- Confirm the frontend and backend use the same Firebase project.
- Verify the browser user is signed in and that the request includes a current Firebase ID token.
- Verify `FIREBASE_PROJECT_ID`, service-account email/private key, and Firebase Admin configuration.
- Check token expiry and Firebase Authentication configuration.

### InfluxDB connection or query errors

- Confirm the InfluxDB service is running at `INFLUX_URL`.
- Verify the organization, bucket, and token.
- Ensure the token has permission to write to and query the configured bucket.
- Confirm the backend container can reach InfluxDB; do not use `localhost` for a separate container.

### Weather is unavailable

- Verify `OPENWEATHER_API_KEY`.
- Confirm the active farm has valid GeoJSON coordinates in `[longitude, latitude]` order.
- Check outbound network access and OpenWeather API quota.

### Sensor data is missing

- Confirm the hardware is publishing to the RTDB path and field names expected by the backend.
- Check whether the active code path expects `smartirrigation/FARMID1` or `irrigation_control/{farmId}`.
- Inspect backend logs for RTDB listener and sensor-sync errors.
- Confirm that placeholder records are not being treated as live sensor readings.

### Frontend API requests fail

- Start the backend on port `5000`.
- Start Vite on port `3000`.
- Confirm the Vite `/api` proxy target in `frontend/vite.config.js`.
- Check browser developer tools for CORS, network, and Firebase token errors.

---

## Current implementation notes

The following points are important when extending or deploying the code:

1. **Single-farm assumptions:** `rtdbPipeline.js` and parts of the irrigation/sensor services use `smartirrigation/FARMID1`. The device activation flow separately initializes per-farm `irrigation_control/{farmId}` paths. These paths should be consolidated around a consistent farm-aware contract.
2. **Analytics tagging:** the RTDB-to-InfluxDB writer currently emits a `source` tag and does not visibly attach the `farm_id` tag used by analytics Flux queries. Verify and align the measurement schema/tags before relying on farm-filtered analytics.
3. **Route availability:** the frontend contains analytics-related components and a page, but the `/analytics` route is commented out in `frontend/src/App.jsx`.
4. **Secondary AI routes:** `backend/routes/aiRoutes2.js` is present but is not mounted by `backend/server.js`; the active AI API is `backend/routes/ai.js`.
5. **Scheduled-job consistency:** the scheduled irrigation job and irrigation service contain differing parameter/path assumptions in the current source. Validate the complete automatic-irrigation flow against the deployed firmware and database schema before enabling unattended pump operation.
6. **Sensor data quality:** the digital twin and stress analysis depend on the quality, timestamps, units, and continuity of sensor readings. Calibrate sensors and validate missing/outlier handling before using the estimates for operational decisions.

---

## License

No license file was identified in the repository. Add a `LICENSE` file and update this section before distributing the project.

## Maintainers

Add the project maintainer/team name and contact information here.
