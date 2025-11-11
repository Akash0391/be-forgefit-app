# ForgeFit Backend

Backend API server for ForgeFit application with Google OAuth authentication.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

3. Get Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/)

4. Run in development mode:
```bash
npm run dev
```

## Environment Variables

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend application URL
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret
- `SESSION_SECRET` - Secret for session encryption

## API Endpoints

- `GET /health` - Health check
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/logout` - Logout

