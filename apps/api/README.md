# CashFlow POS + ERP API

> Enterprise-grade Multi-Tenant SaaS POS & ERP Backend for Cash & Carry Retail Businesses.

---

## 📌 Overview

CashFlow POS + ERP is a scalable, secure, and production-ready backend built using NestJS and PostgreSQL. The system is designed for cash & carry retail businesses with multi-tenant architecture, role-based access control, inventory management, sales processing, reporting, and ERP capabilities.

This repository currently contains the backend API foundation.

---

# Tech Stack

| Layer | Technology |
|--------|------------|
| Framework | NestJS |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | JWT + Refresh Tokens |
| Password Hashing | Argon2 |
| Validation | Zod + class-validator |
| API Documentation | Swagger |
| Queue | BullMQ *(Planned)* |
| Cache | Redis *(Planned)* |
| Deployment | Docker *(Planned)* |

---

# Current Progress

## ✅ Completed

- Environment Validation (Zod)
- Global Exception Filter
- ESLint + Prettier
- Rate Limiting
- Helmet Security Headers

## 🚧 In Progress

- Logout
- Refresh Token Rotation
- Health Check
- Tenant Isolation

## 📅 Upcoming

- Authentication Module
- RBAC
- Product Module
- Inventory Module
- Purchase Module
- Sales Module
- Reports Module
- Notifications
- Audit Logs

---

# Project Structure

```text
src/
│
├── auth/
├── common/
├── config/
├── prisma/
├── tenant/
├── users/
│
├── app.module.ts
└── main.ts

prisma/
│
└── schema.prisma
```

---

# Installation

Clone repository

```bash
git clone https://github.com/YOUR_USERNAME/cashflow-pos-api.git
```

Move into project

```bash
cd cashflow-pos-api
```

Install packages

```bash
npm install
```

---

# Environment Variables

Create a `.env` file.

Example:

```env
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
PORT=3001
NODE_ENV=development
```

---

# Run Project

Development

```bash
npm run start:dev
```

Build

```bash
npm run build
```

Production

```bash
npm run start:prod
```

---

# Prisma

Generate Client

```bash
npx prisma generate
```

Create Migration

```bash
npx prisma migrate dev --name init
```

Open Prisma Studio

```bash
npx prisma studio
```

---

# Code Quality

Run ESLint

```bash
npm run lint
```

Format Code

```bash
npm run format
```

---

# Security Features

- JWT Authentication
- Refresh Tokens
- Argon2 Password Hashing
- Helmet Security Headers
- Global Exception Handling
- Environment Validation
- Rate Limiting

---

# Engineering Principles

This project follows:

- SOLID Principles
- Clean Architecture
- Dependency Injection
- Modular Design
- DRY
- KISS
- Strict TypeScript
- Production-first Development

---

# Development Workflow

Every feature follows this process:

```
DTO
↓

Validation

↓

Controller

↓

Service

↓

Prisma

↓

Swagger Testing

↓

Git Commit
```

---

# Git Branch Strategy

```
main

develop

feature/auth

feature/inventory

feature/sales

feature/reports
```

---

# Commit Convention

```
feat:

fix:

refactor:

docs:

test:

chore:
```

Examples

```bash
git commit -m "feat: implement JWT authentication"

git commit -m "fix: resolve refresh token validation"

git commit -m "refactor: improve auth service"
```

---

# Future Modules

- Multi Tenant SaaS
- Branch Management
- Warehouse
- Inventory
- Purchase Orders
- Goods Receiving
- POS Billing
- Returns
- Customer Management
- Supplier Management
- Financial Reports
- Notifications
- Audit Logs
- Dashboard
- Redis
- BullMQ
- Docker
- CI/CD

---

# License

Private Project

Confidential

© 2026 CashFlow POS + ERP

All Rights Reserved.