# Authentication flow

PackMetrix uses the existing FastAPI bearer-token flow and React route guards. This implementation was reviewed but not replaced.

## Login request

`src/lib/api.js` sends `POST /api/v1/auth/login` with the email and password as JSON. `backend/app/api.py` normalizes the email, loads the user from SQLAlchemy, verifies the submitted password, and returns a signed access token plus the public user payload.

## Password handling

Passwords are never stored directly. `backend/app/core/security.py` derives a hash with PBKDF2-HMAC-SHA256, a per-password random 16-byte salt, and 310,000 iterations. Login uses a constant-time comparison. Passwords are sent only in the login/signup request body; production deployment must use HTTPS.

## Token and session mechanism

The backend issues an HMAC-SHA256 signed token containing the user ID (`sub`), expiry (`exp`), and a random nonce. The default lifetime is configured by `PACKMETRIX_ACCESS_TOKEN_MINUTES` and is currently 480 minutes. Protected API requests send `Authorization: Bearer <token>`. The backend verifies the signature, expiry, active user, and endpoint role requirement on every request.

`src/context/AuthContext.jsx` stores `{ token, user }` under `packmetrix_session` in browser `localStorage`. On application startup it calls `GET /api/v1/auth/me`; an invalid or expired token clears the session automatically.

## Protected routes and roles

`src/App.jsx` wraps dashboard, reports, report detail, and the product register in `ProtectedRoute`. The new-inspection route is additionally wrapped in `InspectorRoute`, which permits only `inspector` and `admin` roles. Backend role dependencies remain authoritative even if a client-side route is bypassed.

## Logout and expiry

The sidebar Sign out action calls `logout()`, removes `packmetrix_session`, and navigates to `/login`. Expired tokens return HTTP 401; the startup/session verification flow clears the browser session and protected routes redirect to login.

## Deployment note

The local `.env` secret is a development placeholder. Set `PACKMETRIX_AUTH_SECRET` to a long random value and serve the frontend/API over HTTPS before production use.
