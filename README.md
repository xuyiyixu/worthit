# WorthIt

WorthIt is a responsive decision companion for thinking through plans using current energy, personal preferences, calendar commitments, and past outcomes.

## Features

- Seeded Alex demo with realistic conversations, decision scorecards, outcomes, and an August–November student calendar
- AI-assisted conversations with explainable upside and cost scores
- PNG, JPG, WebP, and PDF attachments (up to 5 MB in the current UI)
- Daily energy check-ins and calendar-aware energy forecasts
- Calendar plans with time, location, duration, and personalized energy-load estimates
- Post-event reflections and pattern insights
- Eight-question preference onboarding
- Daily three-card reflection prompts
- Optional email/password accounts with PostgreSQL persistence
- Browser-local demo persistence when optional services are not configured

## Run locally

The project requires the Node.js runtime from the `worthit` Conda environment.

```bash
conda env create -f environment.yml
conda activate worthit
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The seeded demo works without a database or API key.

## Configure accounts and AI

PostgreSQL and Node.js are included in `environment.yml`. If the environment already exists, update it first:

```bash
conda env update -f environment.yml --prune
conda activate worthit
which node
which postgres
```

Both executable paths should start inside `.../envs/worthit/bin/`. Local project scripts intentionally fail when run with a global Node.js installation; Vercel builds are exempt from this local environment check.

Initialize a local PostgreSQL database:

```bash
"$CONDA_PREFIX/bin/initdb" -D .postgres-data -U postgres --auth=scram-sha-256 --pwprompt
"$CONDA_PREFIX/bin/pg_ctl" -D .postgres-data -l .postgres-data/server.log -o "-p 5433" start
"$CONDA_PREFIX/bin/createdb" -h 127.0.0.1 -p 5433 -U postgres worthit
```

Copy `.env.example` to `.env.local`, then replace the database password and NVIDIA API key. Percent-encode URL-special characters in the database password.

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5433/worthit
NVIDIA_API_KEY=nvapi-your-key-here
NVIDIA_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
```

Apply all migrations and start the app:

```bash
npm run migrate
npm run dev
```

`DATABASE_URL` enables accounts and server-side persistence. The NVIDIA variables enable AI conversations, event extraction, image understanding, and personalized calendar-energy estimates. Raw image attachments are sent to NVIDIA for the active conversation but are not stored by the app.

To stop PostgreSQL:

```bash
"$CONDA_PREFIX/bin/pg_ctl" -D .postgres-data stop
```

## Verification

```bash
npm run typecheck
npm run build
```
