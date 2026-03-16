# Bulk User Management System

A RESTful API for managing users in bulk — upload via CSV/JSON, list with filters, bulk update, bulk delete, and export.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** MongoDB + Mongoose 9
- **File Upload:** Multer 2
- **CSV Parsing:** csv-parser
- **CSV Export:** json2csv
- **Module System:** ES Modules

## Project Structure

```
├── server.js                    # Entry point
├── package.json
├── .env                         # Environment variables
├── .gitignore
├── uploads/                     # Temp storage for uploaded files
├── mock-data/
│   ├── users.csv                # 10 sample users (CSV)
│   └── users.json               # 5 sample users (JSON)
└── src/
    ├── config/
    │   └── db.js                # MongoDB connection
    ├── controllers/
    │   └── user.controller.js   # Route handlers
    ├── middleware/
    │   ├── errorHandler.js      # Global error handler
    │   └── upload.js            # Multer config
    ├── models/
    │   └── user.model.js        # User schema + indexes
    ├── routes/
    │   └── user.routes.js       # Route definitions
    └── utils/
        └── jobStore.js          # In-memory job tracker
```

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/Samrat880/Bulk-User-Management-System.git
   cd Bulk-User-Management-System
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file**
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/bulk_user_management
   ```

4. **Start the server**
   ```bash
   npm run dev       # development (auto-reload)
   npm start         # production
   ```

## API Endpoints

Base URL: `http://localhost:5000`

### 1. Health Check

```
GET /
```

**Response:**
```json
{ "message": "Bulk User Management API is running" }
```

---

### 2. Bulk Upload Users

```
POST /api/users/upload
Content-Type: multipart/form-data
```

| Field  | Type | Description                    |
|--------|------|--------------------------------|
| `file` | File | `.csv` or `.json` file         |

**Response (202):**
```json
{
  "message": "File received. Processing in background.",
  "jobId": "a1b2c3d4-..."
}
```

---

### 3. Check Upload Job Status

```
GET /api/users/job/:jobId
```

**Response:**
```json
{
  "jobId": "a1b2c3d4-...",
  "status": "completed",
  "total": 10,
  "processed": 10,
  "failed": 0,
  "errors": [],
  "createdAt": "2026-03-16T..."
}
```

---

### 4. List Users (with search, filter, sort, pagination)

```
GET /api/users?search=rahul&kycStatus=Approved&isBlocked=false&sortBy=createdAt&order=desc&page=1&limit=10
```

| Param       | Type   | Default     | Description                          |
|-------------|--------|-------------|--------------------------------------|
| `search`    | string | —           | Search fullName, email, phone        |
| `kycStatus` | string | —           | `Pending`, `Approved`, `Rejected`    |
| `isBlocked` | string | —           | `true` or `false`                    |
| `sortBy`    | string | `createdAt` | Field to sort by                     |
| `order`     | string | `desc`      | `asc` or `desc`                      |
| `page`      | number | `1`         | Page number                          |
| `limit`     | number | `10`        | Results per page                     |

**Response:**
```json
{
  "users": [ ... ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 10,
    "totalPages": 2
  }
}
```

---

### 5. Bulk Update Users

```
PUT /api/users/bulk-update
Content-Type: application/json
```

**By IDs:**
```json
{
  "userIds": ["id1", "id2"],
  "update": { "kycStatus": "Approved" }
}
```

**By Filter:**
```json
{
  "filter": { "kycStatus": "Pending" },
  "update": { "kycStatus": "Approved" }
}
```

Allowed update fields: `fullName`, `phone`, `walletBalance`, `isBlocked`, `kycStatus`

**Response:**
```json
{
  "message": "Users updated successfully",
  "matchedCount": 5,
  "modifiedCount": 5
}
```

---

### 6. Bulk Delete Users

```
DELETE /api/users/bulk-delete
Content-Type: application/json
```

**By IDs:**
```json
{
  "userIds": ["id1", "id2"]
}
```

**By Filter:**
```json
{
  "filter": { "isBlocked": true }
}
```

**Response:**
```json
{
  "message": "Users deleted successfully",
  "deletedCount": 2
}
```

---

### 7. Export Users

```
GET /api/users/export?format=csv&kycStatus=Approved&isBlocked=false
```

| Param       | Type   | Default | Description           |
|-------------|--------|---------|-----------------------|
| `format`    | string | `json`  | `csv` or `json`       |
| `kycStatus` | string | —       | Filter by KYC status  |
| `isBlocked` | string | —       | Filter by blocked     |

Returns a downloadable file.

---

## User Schema

| Field                   | Type    | Required | Unique | Default   | Validation                              |
|-------------------------|---------|----------|--------|-----------|-----------------------------------------|
| `fullName`              | String  | Yes      | No     | —         | min 3 chars, trimmed                    |
| `email`                 | String  | Yes      | Yes    | —         | valid email regex, lowercase, trimmed   |
| `phone`                 | String  | Yes      | Yes    | —         | digits only                             |
| `walletBalance`         | Number  | No       | No     | `0`       | min 0                                   |
| `isBlocked`             | Boolean | No       | No     | `false`   | —                                       |
| `kycStatus`             | String  | No       | No     | `Pending` | enum: Pending, Approved, Rejected       |
| `deviceInfo.ipAddress`  | String  | No       | No     | —         | —                                       |
| `deviceInfo.deviceType` | String  | No       | No     | —         | enum: Mobile, Desktop                   |
| `deviceInfo.os`         | String  | No       | No     | —         | enum: Android, iOS, Windows, macOS      |
| `createdAt`             | Date    | Auto     | No     | auto      | Mongoose timestamps                     |
| `updatedAt`             | Date    | Auto     | auto   | auto      | Mongoose timestamps                     |

## Database Indexes

| Index Name | Fields | Type | Purpose |
|---|---|---|---|
| `email_1` | `email` | Unique | Prevents duplicate emails, fast email lookups |
| `phone_1` | `phone` | Unique | Prevents duplicate phones, fast phone lookups |
| `fullName_text_email_text` | `fullName`, `email` | Text | Supports text search on name/email |
| `isBlocked_1_kycStatus_1_createdAt_-1` | `isBlocked`, `kycStatus`, `createdAt` | Compound | Optimizes the most common query: filter by blocked status + KYC status, sorted by creation date. Avoids full collection scans on list/export endpoints. |

### `db.users.getIndexes()` Output

```json
[
  { "v": 2, "key": { "_id": 1 }, "name": "_id_" },
  { "v": 2, "key": { "email": 1 }, "name": "email_1", "unique": true },
  { "v": 2, "key": { "phone": 1 }, "name": "phone_1", "unique": true },
  { "v": 2, "key": { "_fts": "text", "_ftsx": 1 }, "name": "fullName_text_email_text", "weights": { "email": 1, "fullName": 1 } },
  { "v": 2, "key": { "isBlocked": 1, "kycStatus": 1, "createdAt": -1 }, "name": "isBlocked_1_kycStatus_1_createdAt_-1" }
]
```

## Mock Data

Sample files are provided in `mock-data/` for testing with Postman:

- **`users.csv`** — 10 users in CSV format
- **`users.json`** — 5 users in JSON format with nested `deviceInfo`

## Testing with Postman

1. Start the server: `npm run dev`
2. `POST /api/users/upload` — upload `mock-data/users.csv` (form-data, key: `file`, type: File)
3. `GET /api/users/job/:jobId` — check upload status
4. `GET /api/users` — list uploaded users
5. `PUT /api/users/bulk-update` — update users by IDs or filter
6. `GET /api/users/export?format=csv` — export as CSV
7. `DELETE /api/users/bulk-delete` — delete users by IDs or filter
