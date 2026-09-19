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

Copy `.env.example` to `.env.local`, set `DATABASE_URL` and `NVIDIA_API_KEY`, then create the PostgreSQL tables:

```bash
conda activate worthit
npm run migrate
npm run dev
```

Accounts use an HTTP-only session cookie. Users, sessions, decision threads, messages, verdicts, and attachment metadata/content are stored in PostgreSQL. PDF and DOCX text is extracted server-side; supported images are sent to the configured vision-capable NVIDIA model.

## What is implemented

- Eight-question behavioral onboarding with an internal social-pattern profile
- Text, image, PDF, DOCX, and TXT input in the AI conversation
- Email/password accounts with PostgreSQL-backed sessions and decision history
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
