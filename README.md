# Eesti Attack Map CTF

Täisstack starter, mis jätab üldise visuaali klassikalise CTFd moodi, aga challenge-vaade kasutab Eesti kaarti. Markerid pannakse lat/lng järgi kaardile; kui punkt ei jää Eesti maismaa peale, kasutatakse Tallinna fallback-punkti. Tallinna foto on taustaks challenge-kaardi ümber.

## Mis on sees

- klassikaline CTFd-stiilis navbar, home, login, register, scoreboard
- backend ilma väliste Node dependency'teta
- cookie-session login
- admin-paneel challenge'ite lisamiseks, muutmiseks ja kustutamiseks
- flag submit
- vihjete avamine punktikuluga
- punktitabel
- Eesti geojson + markerite projitseerimine
- Tallinna taustafoto

## Kaustad

- `backend/` – API ja andmete püsisalvestus (`backend/data/db.json`)
- `Test/ctfd-react-frontend/` – Vite + React frontend

## Kiire käivitus

### Variant A – eraldi dev serverid

Terminal 1:

```bash
cd backend
node server.js
```

Terminal 2:

```bash
cd Test/ctfd-react-frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

### Variant B – üks builditud server

```bash
cd Test/ctfd-react-frontend
npm install
npm run build
cd ../..
node backend/server.js
```

Seejärel ava `http://localhost:4000`

### Variant C – docker-compose

```bash
docker compose up
```

## Admin konto

- kasutaja: `admin`
- parool: `Admin123!`

## Kuidas uusi challenge'e lisada

Kõige mugavam viis on minna UI-sse `/admin` lehele.

Olulised väljad:

- `title`
- `slug`
- `category`
- `difficulty`
- `points`
- `description`
- `flag`
- `lat`, `lng`
- `files` JSON kujul
- `hints` JSON kujul

### Files JSON näide

```json
[
  { "label": "task.zip", "url": "https://example.com/task.zip" }
]
```

### Hints JSON näide

```json
[
  { "id": "hint-1", "title": "Esimene vihje", "cost": 10, "content": "<p>Kontrolli HTTP päiseid.</p>" }
]
```

## Andmete salvestus

Kõik salvestatakse faili:

- `backend/data/db.json`

See tähendab, et mängu saab kohe kasutada ja vajadusel ka käsitsi seedida.

## Tallinna taustafoto atribuutika

Kaasatud pilt: **Night skyline in Tallinn, February 2013**

- autor: **Mb-world**
- litsents: **CC BY-SA 3.0**
- allikas: Wikimedia Commons

## Eesti kaardi andmed

Kaardi outline on lisatud GeoJSON failina `Test/ctfd-react-frontend/public/estonia.geojson`.
