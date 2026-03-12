# CTF

CTF platform

## Run CTFd without manual /setup

This repository now includes a Docker Compose setup that automatically runs the first-time CTFd setup.

1. Create your env file:

```bash
cp docker/ctfd/.env.ctfd.example docker/ctfd/.env.ctfd
```

2. Update `docker/ctfd/.env.ctfd` with your admin email/password.

3. Start CTFd and the one-time bootstrap service:

```bash
docker compose up -d
```

4. Watch bootstrap logs (optional):

```bash
docker compose logs -f ctfd-init
```

Backend: `http://localhost:8000`
Login with the credentials in `docker/ctfd/.env.ctfd`.
