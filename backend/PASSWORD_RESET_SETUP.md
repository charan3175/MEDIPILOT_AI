# Password reset email setup

Password reset uses a random, single-use token that expires after 30 minutes. Only a SHA-256 hash of the token is stored with the user account. Existing accounts and health records are not removed or changed when requesting a reset.

Add the following settings to `backend/.env` to enable reset emails:

```dotenv
FRONTEND_URL=http://localhost:5173
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-account
SMTP_PASS=your-smtp-password
MAIL_FROM=MEDIPILOT AI <your-smtp-account@example.com>
```

Use the SMTP host, port, account, and password supplied by your email provider. For Gmail, use `smtp.gmail.com`, port `465`, `SMTP_SECURE=true`, and a Google app password rather than your regular account password. Do not commit `.env` or share SMTP credentials. In production, set `FRONTEND_URL` to the public HTTPS address of the frontend.

Restart the backend after changing `.env`. The reset request endpoint responds with the same message whether or not the email belongs to an account. Requests for a given account are limited to one per minute.
