# Mobile POS & ERP API

Backend service for the Mobile POS & ERP System.

Built with **NestJS**, **Prisma ORM**, and **PostgreSQL**, the API provides secure, scalable and modular endpoints for managing the complete business workflow of a mobile phone retail store.

## Features

- Authentication & Authorization (JWT)
- Role-Based Access Control (RBAC)
- Multi-Branch Management
- Product & Category Management
- IMEI / Serialized Inventory
- Stock Management
- POS & Sales
- Customer Management
- Supplier Management
- Purchase Management
- Sales Returns
- Receivables & Payments
- Dashboard Analytics
- Audit Logs
- Reports
- File Upload Support
- RESTful APIs
- Swagger API Documentation

## Tech Stack

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Swagger
- Zod Validation

## Project Structure

```text
src/
├── auth/
├── users/
├── roles/
├── branches/
├── categories/
├── models/
├── products/
├── inventory/
├── sales/
├── purchases/
├── customers/
├── suppliers/
├── dashboard/
├── reports/
├── finance/
├── prisma/
└── common/
```

## Installation

Install dependencies:

```bash
pnpm install
```

## Environment Variables

Create a `.env` file.

```env
DATABASE_URL=
JWT_SECRET=
PORT=4000
```

## Database

Generate Prisma Client:

```bash
pnpm prisma generate
```

Run Migrations:

```bash
pnpm prisma migrate dev
```

Seed Database (if available):

```bash
pnpm prisma db seed
```

## Run Development Server

```bash
pnpm run start:dev
```

## Build

```bash
pnpm run build
```

## API Documentation

Swagger is available at:

```text
http://localhost:4000/api
```

## License

Private Repository © Shanayn Labs