# subly
Gestor de Subscrições e Despesas Recorrentes

## Desenvolvimento

```bash
npm install
npm run dev
```

## Stack

- React + TypeScript com Vite
- Detecção de subscrições recorrentes a partir de CSV
- Landing page dark-tech com animações em anime.js

## Estrutura

- `src/` - app React + TypeScript
- `public/` - manifesto PWA e assets públicos

## RGPD

O MVP processa apenas metadados de transação (data, comerciante, valor, categoria) e não persiste dados bancários brutos.
