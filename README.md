# MiniDrive Backend API

Multi-tenant cloud storage SaaS with privacy-first design, WebAuthn authentication, and MinIO object storage with SSE-C encryption.

## 🚀 Features

- **WebAuthn/Passkeys Authentication**: Passwordless login using biometric authentication (Fingerprint/FaceID)
- **Zero-Knowledge Encryption**: Server-Side Encryption with Customer-Provided Keys (SSE-C)
- **Multi-Tenancy**: Complete data isolation between users
- **Three-Tier Quota System**: FREE (50MB), PRO (500MB), PREMIUM (1GB)
- **Virtual Folders**: Organize files with nested folder structure
- **Secure File Sharing**: Time-bound presigned URLs with download limits
- **Privacy First**: Even administrators cannot access user files without encryption keys

## 📋 Prerequisites

- [Bun](https://bun.sh/) (Latest version)
- Docker & Docker Compose (for local development)
- PostgreSQL (or use Docker Compose)
- MinIO (or use Docker Compose)

## 🛠️ Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd drive-be
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and configure your settings
   ```

4. Set up the database:
   ```bash
   bunx prisma generate
   bunx prisma migrate dev --name init
   ```

5. Start services with Docker Compose:
   ```bash
   docker compose up -d
   ```

## 🔐 Environment Variables

See `.env.example` for all required environment variables. Key variables include:

- `DATABASE_URL`: PostgreSQL connection URL
- `MINIO_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`: MinIO configuration
- `MASTER_ENCRYPTION_KEY`: Master key for deriving file encryption keys (⚠️ change in production!)
- `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`: WebAuthn/Passkeys configuration
- `SESSION_SECRET`: Secret for session management

## 🚀 Development

Start the development server:
```bash
bun run dev
```

The API will be available at `http://localhost:3001`

## 🐳 Docker Services

The `docker-compose.yml` includes:
- **PostgreSQL**: Database for user and file metadata
- **MinIO**: Object storage for encrypted files
- **MinIO Console**: Web UI at `http://localhost:9001`

## ☸️ Kubernetes Deployment

For production deployment to Kubernetes, see the [k8s](./k8s/) folder:

- **[Quick Start Guide](./k8s/QUICKSTART.md)** - Get started in 5 steps
- **[Full Documentation](./k8s/README.md)** - Comprehensive deployment guide
- **Helper Scripts**:
  - `deploy.sh` - Automated initial deployment
  - `rollout.sh` - Manage updates and rollbacks
  - `setup-secrets.sh` - Generate and apply secure secrets

Quick deployment:
```bash
cd k8s
./setup-secrets.sh  # Generate secure secrets
./deploy.sh         # Deploy to Kubernetes
```

The Kubernetes setup includes:
- PostgreSQL with persistent storage (10Gi)
- MinIO with persistent storage (20Gi)
- Application with horizontal scaling (2+ replicas)
- Ingress with TLS/HTTPS support
- Health checks and rolling updates
- Secure secret management

## 🏗️ Project Structure

```
drive-be/
├── src/
│   ├── modules/
│   │   ├── auth/          # WebAuthn authentication
│   │   ├── files/         # File management with encryption
│   │   ├── folders/       # Virtual folder system
│   │   ├── shares/        # File sharing with presigned URLs
│   │   └── subscriptions/ # Tier management and quotas
│   ├── lib/
│   │   ├── minio.ts       # MinIO client with SSE-C
│   │   ├── encryption.ts  # HKDF key derivation
│   │   └── env.ts         # Environment configuration
│   ├── middlewares/
│   │   ├── auth.middleware.ts  # Session validation
│   │   └── quota.middleware.ts # Storage quota enforcement
│   ├── app.ts             # Route registration
│   └── index.ts           # Server entry point
├── prisma/
│   └── schema.prisma      # Database schema
└── docker-compose.yml     # Local development stack
```

## 📚 API Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed endpoint documentation.

## 🔒 Security Architecture

### SSE-C Encryption Flow

1. **Upload**: Backend derives a unique encryption key per file using HKDF-SHA256(masterKey, salt, fileId)
2. **Storage**: MinIO encrypts the file with the provided key and immediately discards it
3. **Download**: Backend re-derives the same key and sends it to MinIO for decryption
4. **Result**: Files are encrypted at rest, and only the backend can decrypt them

### Multi-Tenancy Isolation

- Files are scoped by user ID in MinIO (object key: `{userId}/{fileId}`)
- All database queries filter by `ownerId` to prevent cross-tenant access
- Quota enforcement per user tier

## 🧪 Testing

Create test file and run:
```bash
bun test
```


## 🤝 Contributing

Contributions are welcome! Please open an issue or PR.
