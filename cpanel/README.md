# cPanel Deployment Bundle

This folder contains a PHP port of the Node backend so the app can run on a standard Apache + PHP cPanel host without requiring Node.js on the server.

## What is included

- `public_html/api/index.php` – PHP API entrypoint mirroring the current `/api/*` contract
- `public_html/api/lib/backend.php` – backend logic, JSON persistence, auth, scoreboard, admin tools
- `public_html/api/data/db.json` – copied game data
- `public_html/.htaccess` – React SPA fallback
- `public_html/api/.htaccess` – API rewrite rules
- `public_html/api/data/.htaccess` – blocks direct access to the JSON database

## Frontend build

The React frontend still needs to be compiled into static files before upload.

Build and assemble locally:

```bash
npm --prefix ctfd-react-frontend install
npm --prefix ctfd-react-frontend run build
./scripts/assemble-cpanel.sh
```

After that, upload the contents of `cpanel/public_html/` into your cPanel `public_html/` directory.

## Notes

- The PHP backend keeps the same API paths the frontend already uses, so no frontend code changes are required for same-origin hosting.
- Existing Node `scrypt` password hashes are supported in pure PHP. On the first successful login, legacy hashes are upgraded to a PHP-native PBKDF2 format so future logins stay compatible without extra extensions.
- `public_html/api/data/db.json` must remain writable by PHP if you want registrations, admin edits, solves, hints, and sessions to persist.
- If you want the JSON database outside the web root, move it and update `CTF_DB_PATH` in `public_html/api/lib/backend.php`.
