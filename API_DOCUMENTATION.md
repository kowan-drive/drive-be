# MiniDrive Backend - API Endpoints

## 🔐 Authentication Endpoints

### Register (Generate Options)
```http
POST /api/v1/auth/register/options
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe"
}
```

### Register (Verify)
```http
POST /api/v1/auth/register/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "credential": { /* WebAuthn credential response */ },
  "deviceName": "MacBook Pro"
}
```

### Login (Generate Options)
```http
POST /api/v1/auth/login/options
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Login (Verify)
```http
POST /api/v1/auth/login/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "credential": { /* WebAuthn credential response */ }
}
```

### Get Current User
```http
GET /api/v1/auth/me
Authorization: Bearer {session_token}
```

### Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer {session_token}
```

## 📁 File Management Endpoints

### Upload File
```http
POST /api/v1/files/upload
Authorization: Bearer {session_token}
Content-Type: multipart/form-data

file: <file>
folderId: <optional_folder_id>
```

### List Files
```http
GET /api/v1/files?folderId={folder_id}&page=1&limit=20
Authorization: Bearer {session_token}
```

### Download File
```http
GET /api/v1/files/{file_id}/download
Authorization: Bearer {session_token}
```

### Get File Metadata
```http
GET /api/v1/files/{file_id}/metadata
Authorization: Bearer {session_token}
```

### Delete File
```http
DELETE /api/v1/files/{file_id}
Authorization: Bearer {session_token}
```

### Move File
```http
PUT /api/v1/files/{file_id}/move
Authorization: Bearer {session_token}
Content-Type: application/json

{
  "id": "file_id",
  "folderId": "target_folder_id_or_null"
}
```

## 📂 Folder Management Endpoints

### Create Folder
```http
POST /api/v1/folders
Authorization: Bearer {session_token}
Content-Type: application/json

{
  "name": "My Folder",
  "parentId": "optional_parent_folder_id"
}
```

### List Folders
```http
GET /api/v1/folders?parentId={parent_id}
Authorization: Bearer {session_token}
```

### Update Folder
```http
PUT /api/v1/folders/{folder_id}
Authorization: Bearer {session_token}
Content-Type: application/json

{
  "id": "folder_id",
  "name": "New Folder Name"
}
```

### Delete Folder
```http
DELETE /api/v1/folders/{folder_id}
Authorization: Bearer {session_token}
```

## 🔗 File Sharing Endpoints

### Create Share Link
```http
POST /api/v1/shares
Authorization: Bearer {session_token}
Content-Type: application/json

{
  "fileId": "file_id",
  "expiresInHours": 24,
  "maxDownloads": 10
}
```

### List My Shares
```http
GET /api/v1/shares
Authorization: Bearer {session_token}
```

### Access Shared File (Public)
```http
GET /api/v1/shares/{share_token}
```

### Delete Share Link
```http
DELETE /api/v1/shares/{share_id}
Authorization: Bearer {session_token}
```

## 💎 Subscription Management Endpoints

### Get Available Tiers
```http
GET /api/v1/subscriptions/tiers
Authorization: Bearer {session_token}
```

### Upgrade Tier
```http
POST /api/v1/subscriptions/upgrade
Authorization: Bearer {session_token}
Content-Type: application/json

{
  "tier": "PRO" // or "FREE", "PREMIUM"
}
```

### Get Storage Usage
```http
GET /api/v1/subscriptions/usage
Authorization: Bearer {session_token}
```

### Get Subscription History
```http
GET /api/v1/subscriptions/history
Authorization: Bearer {session_token}
```

## 📊 Response Format

All endpoints return JSON in this format:

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

## 🔑 Authentication

All protected endpoints require a session token in the Authorization header:
```
Authorization: Bearer {session_token}
```

The session token is returned from the login/verify endpoint after successful WebAuthn authentication.
