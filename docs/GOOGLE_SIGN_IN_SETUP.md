# Google sign-in setup

Google sign-in uses Google Identity Services in the frontend and verifies its ID
token in the backend. Use the same Google OAuth **Web application client ID** in
both environment files; the client ID is public and is not a client secret.

1. Create a Web application OAuth client in the Google Cloud Console and add
   each frontend origin (for local development, `http://localhost:5173`) to its
   authorized JavaScript origins.
2. Set `VITE_GOOGLE_CLIENT_ID` in `frontend/.env` and `GOOGLE_CLIENT_ID` in
   `backend/.env` to that client ID. Example variable names are in
   `frontend/.env.example` and `backend/.env.example`.
3. Restart the frontend and backend after changing their environment files.
4. Open **Sign in** and choose **Continue with Google**. Google accounts with a
   verified email are linked to an existing account with that email or create a
   new patient account. The backend verifies the ID token's signature,
   expiration, issuer, and audience before issuing a MediPilot session token.

Do not put a client secret in the frontend. For deployment, add the production
frontend origin to the OAuth client's authorized JavaScript origins and set both
environment variables in the corresponding deployment environments.
