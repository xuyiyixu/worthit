# WorthIt

A responsive web MVP that helps someone decide whether an event is worth attending—and when the balance between real-world cost and potential upside is best.

## Run locally

```bash
conda env create -f environment.yml
conda activate worthit
npm ci
npm run dev
```

The Node.js runtime is supplied by the isolated `worthit` Conda environment. Do not run the project from `base` or a global Node.js installation.

Open [http://localhost:3000](http://localhost:3000). Use **See a 30-second demo** for the seeded CMU Startup Mixer flow.

## Configure persistence and AI

PostgreSQL is installed inside the same Conda environment as Node.js. Update the environment once after pulling these dependencies:

```bash
conda env update -f environment.yml --prune
conda activate worthit
which node
which postgres
```

Both paths should start with the active Conda environment path (for example, `.../envs/worthit/bin/`). The project refuses to run when `node` resolves to a global installation.

Initialize a development-only database inside the project. Choose a password when `initdb` prompts, then use the same password in `DATABASE_URL` below:

```bash
"$CONDA_PREFIX/bin/initdb" -D .postgres-data -U postgres --auth=scram-sha-256 --pwprompt
"$CONDA_PREFIX/bin/pg_ctl" -D .postgres-data -l .postgres-data/server.log -o "-p 5433" start
"$CONDA_PREFIX/bin/createdb" -h 127.0.0.1 -p 5433 -U postgres worthit
```

Copy `.env.example` to `.env.local` and replace the password and NVIDIA API key. If the database password contains URL-special characters, percent-encode them in the connection URL.

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5433/worthit
NVIDIA_API_KEY=nvapi-your-key-here
NVIDIA_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
```

Create the application tables and start the site:

```bash
npm run migrate
npm run dev
```

To stop the local database later, run `"$CONDA_PREFIX/bin/pg_ctl" -D .postgres-data stop` from the activated `worthit` environment.

Accounts use an HTTP-only session cookie. Users, sessions, decision threads, messages, verdicts, and attachment metadata/content are stored in PostgreSQL. The configured Nemotron 3 Nano Omni 30B A3B model handles both text and image evidence; PDF, DOCX, and TXT content is extracted server-side before it is sent to NVIDIA. The text-only `nvidia/nemotron-3-nano-30b-a3b` hosted endpoint is not currently listed for this NVIDIA account, so the available multimodal variant is used.

## What is implemented

- Eight-question behavioral onboarding with an internal social-pattern profile
- Text, image, PDF, DOCX, and TXT input in the AI conversation
- Email/password accounts with PostgreSQL-backed sessions and decision history
- New-account onboarding stored as a reusable decision baseline
- Returning-user history with prior prompts, verdicts, and reasons
- Deterministic event trait inference with explicit provenance
- User-provided travel time and familiar-people context
- Explainable, deterministic cost and takeaway scoring
- Time-based Worth curve and best attendance window
- Responsive analysis and lightweight post-event feedback flow
- Local draft persistence so the demo survives optional-service failures

## Current MVP boundary

The deterministic demo flow remains available from the landing page. The `/decide` experience requires PostgreSQL and a NVIDIA API key so it never presents a local heuristic as an AI verdict.

## Verification

```bash
npm run typecheck
npm run build
```
