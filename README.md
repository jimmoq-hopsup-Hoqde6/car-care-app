# Car Care 🚗

A full-stack **vehicle maintenance tracker**. Add your vehicles, log service
records (oil changes, tire rotations, brake pads, and more), and get automatic
reminders for upcoming maintenance based on mileage and time intervals.

## Tech stack

| Layer    | Technology                                              |
| -------- | ------------------------------------------------------- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v4             |
| Backend  | Node.js, Express, TypeScript, better-sqlite3 (SQLite)   |
| Tooling  | npm workspaces, ESLint, `tsx`, `concurrently`           |

The project is an npm-workspaces monorepo:

```
.
├── client/   # React + Vite single-page app
├── server/   # Express REST API + SQLite persistence
└── package.json  # workspace root with dev/build scripts
```

## Getting started

Requires Node.js 20+.

```bash
npm install      # installs all workspaces
npm run dev      # runs the API (:3001) and the web app (:5173) together
```

Then open http://localhost:5173. The Vite dev server proxies `/api` requests to
the Express backend on port 3001. On first run the database is seeded with a
couple of sample vehicles so the dashboard isn't empty.

## Available scripts (run from the repo root)

| Command             | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Start API + web app together (hot reload)                |
| `npm run dev:server`| Start only the Express API on port 3001                  |
| `npm run dev:client`| Start only the Vite web app on port 5173                 |
| `npm run build`     | Type-check and build both the server and client          |
| `npm start`         | Run the built server (also serves the built client)      |
| `npm run typecheck` | Type-check both workspaces                               |
| `npm run lint`      | Lint the client workspace                                |

## API overview

The Express API is mounted under `/api`:

| Method   | Path                          | Description                        |
| -------- | ----------------------------- | ---------------------------------- |
| `GET`    | `/api/health`                 | Health check                       |
| `GET`    | `/api/vehicles`               | List vehicles                      |
| `POST`   | `/api/vehicles`               | Create a vehicle                   |
| `GET`    | `/api/vehicles/:id`           | Get one vehicle                    |
| `PUT`    | `/api/vehicles/:id`           | Update a vehicle                   |
| `DELETE` | `/api/vehicles/:id`           | Delete a vehicle                   |
| `GET`    | `/api/vehicles/:id/services`  | List a vehicle's service records   |
| `POST`   | `/api/vehicles/:id/services`  | Add a service record               |
| `DELETE` | `/api/services/:id`           | Delete a service record            |
| `GET`    | `/api/vehicles/:id/reminders` | Computed maintenance reminders     |

## Data

SQLite data is stored under `server/data/` (git-ignored) and created
automatically on first run. Override the location with the `DB_PATH` or
`DATA_DIR` environment variables.
