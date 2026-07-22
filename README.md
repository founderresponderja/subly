# subly
Gestor de Subscrições e Despesas Recorrentes

## Desenvolvimento

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
export VITE_GOOGLE_CLIENT_ID="o-mesmo-client-id-do-google"
npm run dev
```

## Base de dados

- PostgreSQL local via Docker Compose em `localhost:5432`
- Configuração em `.env` com `DATABASE_URL`
- Migrações SQL em `server/migrations`
- Comando de migração: `npm run db:migrate`

## Autenticação

- Email/password com hash `bcrypt`
- Sessão em cookie `httpOnly` com JWT
- Login Google via Google Identity Services + validação de ID token no backend
- Variáveis necessárias em `.env`: `JWT_SECRET`, `SESSION_COOKIE_NAME`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Stack

- Frontend React + TypeScript com Vite
- Backend Node.js + Express + TypeScript
- Persistência real com PostgreSQL + Drizzle ORM
- Detecção de subscrições recorrentes a partir de CSV
- Landing page dark-tech com animações em anime.js

## Estrutura

- `src/` - app React + TypeScript
- `server/` - API Node.js + Express + TypeScript
- `public/` - manifesto PWA e assets públicos
- `server/migrations/` - migrações SQL da base de dados

## RGPD

O MVP processa apenas metadados de transação (data, comerciante, valor, categoria) e não persiste dados bancários brutos.
