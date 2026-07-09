# POS + ERP System

A production-grade, multi-tenant SaaS Point of Sale (POS) and ERP system built for cash & carry retail businesses.

## Features

- **Multi-tenant** — each business has isolated data
- **Authentication** — JWT with access + refresh tokens, auto-refresh, role-based access (Admin / Manager / Cashier)
- **Products & Inventory** — full CRUD, stock tracking, low-stock alerts, categories
- **POS Billing** — cart-based checkout with real-time stock updates (atomic transactions)
- **Receipts** — printable receipt after each sale
- **Reports** — revenue, profit, today's sales, monthly sales
- **Staff Management** — admins can add managers and cashiers
- **Sales History** — full record of all transactions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT, Argon2 |
| Infrastructure | Docker (PostgreSQL) |

## Architecture

- **Monorepo** — `apps/api` (backend) and `apps/web` (frontend)
- **Security** — rate limiting, Helmet, refresh token rotation with theft detection, tenant isolation
- **Money handling** — Decimal precision (no floating-point errors)
- **Transactions** — sales and stock updates are atomic

## Getting Started

### Prerequisites

- Node.js (v18+)
- Docker Desktop

### 1. Start the database

From the project root:

\`\`\`bash
docker compose up -d
\`\`\`

### 2. Backend setup

\`\`\`bash
cd apps/api
npm install
npx prisma migrate dev
npm run dev
\`\`\`

Backend runs at `http://localhost:4000/api`
API docs (Swagger) at `http://localhost:4000/api/docs`

### 3. Frontend setup

\`\`\`bash
cd apps/web
npm install
npm run dev
\`\`\`

Frontend runs at `http://localhost:3000`

## Usage

1. Open `http://localhost:3000`
2. Register a new business (becomes Admin)
3. Add products, categories, and staff
4. Cashiers log in and use the POS Terminal to make sales
5. View reports and sales history on the dashboard

## User Roles

| Role | Access |
|------|--------|
| **Admin** | Full access — products, staff, reports, billing |
| **Manager** | Products, billing, reports |
| **Cashier** | POS Terminal (billing) only |

## Project Structure

\`\`\`
pos-erp/
├── docker-compose.yml
├── apps/
│   ├── api/          # NestJS backend
│   │   ├── prisma/   # database schema & migrations
│   │   └── src/      # modules: auth, products, sales, staff, etc.
│   └── web/          # Next.js frontend
│       └── src/
│           ├── app/  # pages (login, dashboard, terminal, etc.)
│           └── lib/  # API clients & helpers
\`\`\`

## License

Private project.