# Street Lamp Predictive Maintenance

![Project Status](https://img.shields.io/badge/status-in%20development-yellow) [![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

IoT-based monitoring and predictive maintenance system for smart solar street lamps (PJU). Lamps send telemetry over MQTT, the FastAPI backend stores it in TimescaleDB, raises alerts, and uses machine learning to flag lamps that are likely to fail. The Next.js web dashboard is where operators monitor, control, and maintain lamps. This project was built for a **KKN** (community service) program.

## **Architecture**

```
ESP32 / Street Lamp ──MQTT──▶ EMQX Broker ──▶ FastAPI Backend ──▶ PostgreSQL + TimescaleDB
                    ◀─command──            │         │
                                           │         └──▶ Celery + Redis (ML, alerts, reports, backup)
                                           └──REST / WebSocket──▶ Next.js Dashboard
```

The backend subscribes to telemetry, heartbeat, and device log topics, and publishes brightness, schedule, and OTA commands back to the devices.

## **Technologies Used**
- **Next.js** (TypeScript, App Router), **Tailwind CSS**, **Recharts**, **Leaflet**, **next-intl**
- **FastAPI** with **SQLAlchemy 2.0 (async)** and **Pydantic v2**
- **PostgreSQL + TimescaleDB**
- **Redis + Celery**
- **EMQX** (MQTT broker)
- **scikit-learn / XGBoost**
- **Docker / Podman Compose**

## **Features**
- **Real-time Monitoring**: Ingests telemetry (voltage, current, power, battery, temperature, lux) over MQTT and streams it to the dashboard over WebSocket.
- **Interactive Map**: Shows lamp locations and status on OpenStreetMap / satellite tiles.
- **Lamp & Place Management**: Manages lamps by location, with per-lamp detail pages and lighting schedules.
- **Remote Control**: Sends brightness, schedule, and OTA firmware commands to devices.
- **Alerts & Notifications**: Raises threshold-based alerts and detects offline devices.
- **Predictive Maintenance**: Scores anomalies and predicts lamp failures with ML models trained in the background.
- **Energy Analytics**: Tracks energy flow and consumption.
- **Repair Tickets**: Covers the maintenance workflow from alert to repair.
- **Reports & Backup**: Exports reports (PDF / Excel) and runs scheduled database backups.
- **Authentication & Roles**: JWT with refresh cookie, email verification, admin approval for new users, Admin/Operator roles, and an audit log.
- **Multi-language & Dark Mode**: Dashboard UI available in multiple languages, with dark mode.

## **Project Structure**
```
.
├── backend/        # FastAPI app, Alembic migrations, Celery tasks, tests
├── frontend/       # Next.js dashboard
├── compose.yaml    # Full stack (DB, Redis, MQTT, backend, worker, frontend)
└── srs_v4.md       # Software Requirements Specification
```

## **Setup**

### Option A: Docker / Podman Compose (full stack)
1. **Clone the Repository**:
   ```sh
   git clone https://github.com/diazadr/street-lamp-predictive-maintenance-kkn.git
   cd street-lamp-predictive-maintenance-kkn
   ```
2. **Configure Environment**:
   ```sh
   cp backend/.env.example backend/.env
   ```
3. **Run the Stack**:
   ```sh
   docker compose up -d --build   # or: podman compose up -d --build
   ```
   On startup the backend runs migrations and seeds the default admin user automatically.

### Option B: Run Locally
1. **Backend** (Python 3.11 / 3.12, requires PostgreSQL; Redis and MQTT are optional):
   ```sh
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env          # point DATABASE_URL, REDIS_URL, MQTT_HOST to localhost
   alembic upgrade head
   python -m app.scripts.seed
   uvicorn app.main:app --reload
   ```
2. **Frontend**:
   ```sh
   cd frontend
   cp .env.example .env.local    # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
   npm install
   npm run dev
   ```

### Access
| Service | URL |
|---|---|
| Web Dashboard | http://localhost:3000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| EMQX Dashboard | http://localhost:18083 |

The default admin account is set by `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` in `backend/.env`.

## **Usage**
1. Log in as admin and approve newly registered operators.
2. Add places and lamps, and assign each lamp its device ID.
3. Connect the ESP32 devices to the MQTT broker and publish telemetry to the `pju/...` topics.
4. Monitor lamp status on the dashboard and map, and respond to alerts and repair tickets.
5. Control brightness and schedules from the lamp detail page.

## **Project Status**
This project is **in development**.

## **Contributions**
Contributions are welcome! Feel free to open issues or submit pull requests.

## **License**
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
