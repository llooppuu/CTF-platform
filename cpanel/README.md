# cPanel Deployment Bundle

This folder contains a PHP port of the Node backend so the app can run on a standard Apache + PHP cPanel host without requiring Node.js on the server.

The deploy target is a self-contained subdirectory app:

- `/public_html/CTF/`

Nothing outside that `CTF` folder is required for the app to run.

## What is included

- `public_html/CTF/api/index.php` – PHP API entrypoint mirroring the current `/api/*` contract
- `public_html/CTF/api/lib/backend.php` – backend logic, JSON persistence, auth, scoreboard, admin tools
- `public_html/CTF/api/data/db.json` – copied game data
- `public_html/CTF/.htaccess` – React SPA fallback for subdirectory hosting
- `public_html/CTF/api/.htaccess` – API rewrite rules
- `public_html/CTF/api/data/.htaccess` – blocks direct access to the JSON database

## Frontend build

The React frontend still needs to be compiled into static files before upload.

Build and assemble locally:

```bash
npm --prefix ctfd-react-frontend install
VITE_PUBLIC_BASE=/CTF/ npm --prefix ctfd-react-frontend run build
./scripts/assemble-cpanel.sh
```

After that, upload the contents of `cpanel/public_html/CTF/` into your cPanel `/public_html/CTF/` directory.

Your cPanel root can stay minimal:

```text
public_html/
  CTF/
    ...
```

## Notes

- The frontend build is configured for subdirectory hosting, so assets, router URLs, cookies, and API requests resolve under `/CTF`.
- Existing Node `scrypt` password hashes are supported in pure PHP. On the first successful login, legacy hashes are upgraded to a PHP-native PBKDF2 format so future logins stay compatible without extra extensions.
- `public_html/CTF/api/data/db.json` must remain writable by PHP if you want registrations, admin edits, solves, hints, and sessions to persist.
- If you want the JSON database outside the web root, move it and update `CTF_DB_PATH` in `public_html/CTF/api/lib/backend.php`.
