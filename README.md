# Subly

Gestor de Subscrições e Despesas Recorrentes.

## Estrutura

- `/landing` — landing page separada (HTML/CSS/JS) com animações em anime.js
- `/frontend` — app React + TypeScript (PWA) para importação CSV, dashboard e alertas
- `/backend` — API Node.js + Express + TypeScript para importação, deteção automática e métricas
- `/backend/db/schema.sql` — modelo inicial PostgreSQL (`users`, `bank_connections`, `transactions`, `detected_subscriptions`, `categories`, `alerts`, `household_members`)

## Como correr localmente

### Backend

```bash
cd /home/runner/work/subly/subly/backend
npm install
npm run dev
```

API disponível em `http://localhost:4000`.

### Frontend

```bash
cd /home/runner/work/subly/subly/frontend
npm install
npm run dev
```

App disponível em `http://localhost:5173` (proxy `/api` para backend).

### Landing page

Abre `/home/runner/work/subly/subly/landing/index.html` no browser.

## RGPD

O MVP processa apenas metadados de transação (data, comerciante, valor, categoria) e não persiste dados bancários brutos.
