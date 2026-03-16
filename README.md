# Creek Lend - Backend API

## Project Overview

Creek Lend is an online lending platform that allows users to apply for personal loans, submit bank verification details, and track their application status. The backend provides RESTful APIs for loan management, admin dashboard, and third-party integrations.

---

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| **Runtime**    | Node.js                             |
| **Language**   | TypeScript 5.9                      |
| **Framework**  | Express.js 5.1                      |
| **Database**   | PostgreSQL (via `pg` library)        |
| **Auth**       | JWT (jsonwebtoken) + bcryptjs        |
| **Validation** | Zod 4.3                             |
| **Email**      | Mailgun API                          |
| **Hosting**    | Vercel (Serverless)                  |

---

## Frontend Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| **Framework**  | Next.js 16.1                        |
| **Language**   | TypeScript 5.9                      |
| **UI Library** | React 19.2                          |
| **Styling**    | Tailwind CSS 4.2                    |
| **Maps**       | Google Maps JS API                  |
| **Toasts**     | react-hot-toast                     |
| **Validation** | Zod 4.3                             |
| **Hosting**    | Vercel                              |

---

## Database

- **Engine:** PostgreSQL
- **Connection Pool:** Max 20 connections, 30s idle timeout, 5s connection timeout
- **SSL:** Enabled in production
- **Production DB:** Neon PostgreSQL (serverless)

### Tables

| Table                | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `loan_applications`  | Stores loan application data (encrypted SSN, DL, account numbers) |
| `bank_verification`  | Encrypted banking credentials vault         |
| `admin_users`        | Admin authentication & role management      |
| `audit_log`          | Tracks all status changes                   |
| `contact_messages`   | Contact form submissions                    |

---

## API Endpoints

### Public Routes

| Method | Endpoint                  | Description                        |
| ------ | ------------------------- | ---------------------------------- |
| GET    | `/api/health`             | Health check with timestamp        |
| POST   | `/api/apply`              | Submit a loan application          |
| POST   | `/api/bank-verification`  | Submit bank verification details   |
| GET    | `/api/application-status` | Check application status by ID & email |
| POST   | `/api/contact`            | Submit contact form (rate limited) |
| GET    | `/api/geo-check`          | Check user eligibility by country  |
| GET    | `/api/routing-lookup`     | US routing number / IFSC lookup    |

### Admin Routes (JWT Protected)

| Method | Endpoint                       | Description                          |
| ------ | ------------------------------ | ------------------------------------ |
| POST   | `/api/admin/auth`              | Admin login / bootstrap setup        |
| GET    | `/api/admin/auth`              | Verify token / get current user      |
| GET    | `/api/admin/applications`      | List applications (paginated, filterable) |
| GET    | `/api/admin/applications/:id`  | View single application (with optional decryption) |
| PATCH  | `/api/admin/applications/:id`  | Update application status            |
| DELETE | `/api/admin/applications/:id`  | Delete application (admin only)      |
| GET    | `/api/admin/stats`             | Dashboard statistics                 |

---

## Authentication & Security

- **JWT Tokens** with 8-hour expiration
- **Role-Based Access Control:** admin, reviewer, viewer
- **Encryption:** AES-256-GCM for sensitive fields (SSN, DL, account numbers)
- **Hashing:** SHA-256 for SSN duplicate detection, bcrypt (12 rounds) for passwords
- **Input Sanitization:** XSS prevention (script tags, event handlers removed)
- **Rate Limiting:** Per-IP in-memory limiter on contact forms and login
- **CORS:** Frontend URL whitelisting
- **Audit Logging:** All status changes tracked with timestamp and performer

---

## Third-Party Integrations

| Service               | Purpose                                      |
| --------------------- | -------------------------------------------- |
| **Mailgun**           | Transactional emails (confirmation, status updates) |
| **Discord Webhooks**  | Real-time notifications for new applications & verifications |
| **Meta Conversion API** | Lead event tracking (Facebook Pixel)        |
| **ipapi.co**          | IP-based geolocation for eligibility check   |
| **Razorpay IFSC API** | Indian bank IFSC code validation             |

---

## Project Structure

```
backend/
├── src/
│   ├── server.ts              # Express app setup & route registration
│   ├── db.ts                  # PostgreSQL connection pool
│   ├── auth.ts                # JWT middleware & rate limiting
│   ├── encryption.ts          # AES-256-GCM encryption/decryption
│   ├── validation.ts          # Zod schemas for all inputs
│   ├── utils.ts               # Utility functions (5-digit ID generation)
│   ├── schema.sql             # Database schema
│   ├── routingDb.ts           # Local US bank routing number database
│   ├── routes/
│   │   ├── apply.ts           # Loan application submission
│   │   ├── applicationStatus.ts
│   │   ├── bankVerification.ts
│   │   ├── contact.ts
│   │   ├── geoCheck.ts
│   │   ├── routingLookup.ts
│   │   └── admin.ts           # Admin dashboard routes
│   └── services/
│       ├── applicationService.ts
│       ├── bankVerificationService.ts
│       ├── adminService.ts
│       ├── emailService.ts    # Mailgun integration
│       ├── metaCapi.ts        # Meta Conversion API
│       └── discordService.ts  # Discord webhook notifications
├── package.json
├── tsconfig.json
├── vercel.json
└── .env
```

---

## Dependencies

### Production

| Package        | Version | Purpose                  |
| -------------- | ------- | ------------------------ |
| express        | 5.1.0   | Web framework            |
| pg             | 8.20.0  | PostgreSQL client        |
| bcryptjs       | 3.0.3   | Password hashing         |
| jsonwebtoken   | 9.0.3   | JWT authentication       |
| zod            | 4.3.6   | Schema validation        |
| cors           | 2.8.5   | CORS middleware          |
| dotenv         | 16.5.0  | Environment variables    |
| axios          | 1.13.6  | HTTP client (webhooks)   |

### Development

| Package    | Version | Purpose                  |
| ---------- | ------- | ------------------------ |
| typescript | 5.9.3   | TypeScript compiler      |
| tsx        | 4.20.0  | TypeScript executor      |

---

## Application Flow

1. **Loan Application:** User submits form → Validation → Duplicate SSN check → Save to DB → Confirmation email → Discord notification → Meta lead tracking
2. **Bank Verification:** User submits banking details → Validate application status → Encrypt & save credentials → Discord notification
3. **Status Update (Admin):** Admin updates status → Audit log entry → Status email sent to applicant
4. **Status Lookup (Public):** User queries by application ID + email → Returns status (no sensitive data)

---

## Deployment

- **Platform:** Vercel (Serverless Functions)
- **Entry Point:** `src/server.ts`
- **Build:** `tsc` (TypeScript compilation)
- **Environment Detection:** Uses `process.env.VERCEL` to switch between local server and serverless mode

---

## Allowed Countries

US, CA, IN (validated via IP geolocation)
