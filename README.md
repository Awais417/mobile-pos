# 🚀 CashFlow POS & ERP

Enterprise-grade Multi-Tenant SaaS POS & ERP System for Cash & Carry Businesses.

> Built with modern technologies following clean architecture, scalable design, and industry best practices.

---

# 📌 Project Overview

CashFlow POS & ERP is a production-ready SaaS platform designed for wholesalers, cash & carry stores, supermarkets, and retail businesses.

The system supports:

- Multi-Tenant Architecture
- Multiple Branches / Outlets
- POS Billing
- Inventory Management
- Purchase Management
- Customer Management
- Supplier Management
- Financial Reports
- Dashboard & Analytics
- Role-Based Access Control
- Secure Authentication

---

# 🏗️ Repository Structure

```text
pos-erp/
│
├── apps/
│   ├── api/          # NestJS Backend
│   └── web/          # Next.js Frontend
│
├── packages/         # Shared packages (future)
│
├── .gitignore
├── README.md
└── package.json
```

---

# ⚙️ Tech Stack

## Backend

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT Authentication
- Zod
- Swagger
- Helmet
- Rate Limiting

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- ShadCN UI

---

# ✨ Features

## Authentication

- Login
- Logout
- Refresh Token Rotation
- JWT Authentication
- Role-Based Access Control

## Inventory

- Categories
- Products
- Stock Management
- Barcode Support
- Low Stock Alerts

## Sales

- POS Billing
- Invoice Generation
- Returns
- Discounts

## Purchase

- Purchase Orders
- Suppliers
- Goods Receiving

## Reports

- Sales Reports
- Inventory Reports
- Profit & Loss
- Dashboard Analytics

---

# 🛡️ Security

- Helmet
- Rate Limiting
- Global Exception Filter
- Environment Validation (Zod)
- Refresh Token Rotation
- Password Hashing
- Secure HTTP Headers

---

# 🚧 Current Progress

## ✅ Backend

- Environment Validation
- Swagger
- Prisma
- PostgreSQL
- Helmet
- Rate Limiting
- Global Exception Filter
- Refresh Token Rotation
- Logout
- Authentication Foundation

## 🚧 Frontend

- Initial Setup
- Dashboard Layout (In Progress)

---

# 🚀 Getting Started

## Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/cashflow.git
```

## Install Dependencies

Backend

```bash
cd apps/api
npm install
```

Frontend

```bash
cd apps/web
npm install
```

---

# Backend

```bash
npm run start:dev
```

Swagger

```text
http://localhost:3000/api
```

---

# Frontend

```bash
npm run dev
```

---

# Future Roadmap

- Multi-Tenant SaaS
- Warehouse Module
- Accounting
- CRM
- HRM
- AI Reports
- AI Inventory Forecasting
- Mobile Application
- Docker
- CI/CD
- Kubernetes

---

# Engineering Principles

- SOLID Principles
- Clean Architecture
- Modular Design
- DRY
- KISS
- Dependency Injection
- Enterprise Standards

---

# License

Private Repository

© 2026 CashFlow POS & ERP. All Rights Reserved.
