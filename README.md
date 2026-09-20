# WorthIt

**Know yourself. Choose better.**

WorthIt is a personalized decision companion that helps users think through everyday plans using their current energy, workload, schedule, personal preferences, and past experiences.

Instead of simply answering questions like **"Should I go?"**, WorthIt considers the user's current context and learned patterns to provide more personalized and explainable guidance.

## Why WorthIt?

Sometimes the difficult part of making a decision is not knowing what the options are — it is knowing whether something is worth it **for you, right now**.

For example, a user may want to attend a birthday party, but they have already spent the day in classes, have an assignment due tomorrow, and have had little time to recover.

WorthIt brings that personal context into the decision by considering the user's current energy, workload, schedule, preferences, and previous experiences.

## Core Features

### Adaptive Social Battery

WorthIt estimates a user's available energy and capacity for upcoming activities using factors such as:

- daily workload and activities
- calendar commitments
- social exposure
- recovery and rest
- personal preferences
- previous outcomes

Although we call it a Social Battery, the estimate is not based only on social activity. Academic workload, scheduled commitments, recovery time, and other demands can also affect how much energy a user has available.

Rather than requiring users to manually assign themselves a battery percentage, the estimate adapts as WorthIt learns more about their patterns.

### What Should I Do?

Users can talk with the AI decision companion about everyday decisions such as:

> "Should I go to this birthday party tonight?"

WorthIt combines the current situation with the user's available energy, preferences, schedule, workload, and relevant history to provide personalized guidance with explainable benefits and costs.

Users can also upload images or PDF files so WorthIt can understand event information and additional context.

### Calendar & Energy Forecasting

Users can add activities with information such as time, location, and duration.

WorthIt uses upcoming commitments and personalized activity-load estimates to forecast how the user's available energy may change throughout the day.

### Outcomes & Insights

After an activity, users can reflect on what actually happened.

These outcomes help WorthIt identify patterns in what tends to energize, drain, or work well for that user. Previous experiences can then provide better context for future decisions.

### Personalized Onboarding

An eight-question onboarding survey establishes an initial preference profile for new users before enough historical data is available.

### Daily Reflection

WorthIt also includes a daily three-card tarot-inspired experience designed for lightweight self-reflection and fun.

## How It Works

```text
Activities + Workload + Calendar + Recovery
                    |
                    v
          Adaptive Social Battery
                    |
                    v
        Preferences + Past Outcomes
                    |
                    v
           AI Decision Companion
                    |
                    v
         Personalized Guidance
                    |
                    v
            User Makes Choice
                    |
                    v
          Outcome / Reflection
                    |
                    v
          Better Future Context
```

WorthIt supports the user's decision rather than making the decision for them. As users provide more context and outcomes, the system can better understand their individual patterns.

## Tech Stack

| Technology | Purpose |
| --- | --- |
| **TypeScript** | Primary programming language |
| **React** | User interface and reusable components |
| **Next.js** | Web application framework and server-side functionality |
| **PostgreSQL** | User accounts, preferences, calendar data, conversations, decisions, and outcomes |
| **NVIDIA Nemotron 3 Nano Omni 30B A3B Reasoning** | AI reasoning and multimodal interactions |
| **NVIDIA NIM** | Model inference service |
| **NVIDIA L40S 48 GB** | GPU used for model inference |
| **NVIDIA Brev** | Cloud GPU environment |
| **Node.js / npm** | Application runtime and package management |
| **Conda** | Local development environment |

## NVIDIA AI Infrastructure

WorthIt uses **NVIDIA Nemotron 3 Nano Omni 30B A3B Reasoning** for personalized decision support and multimodal interactions.

The model is deployed using **NVIDIA NIM** on an **NVIDIA L40S GPU with 48 GB of VRAM**, provisioned through **NVIDIA Brev**.

For our SteelHacks deployment, the local WorthIt application connects to the NIM inference service running on the Brev instance through an SSH tunnel.

```text
WorthIt (Next.js / React)
          |
          | AI Request
          v
    Next.js Server
          |
          v
      SSH Tunnel
          |
          v
     NVIDIA Brev
          |
          v
      NVIDIA NIM
          |
          v
 Nemotron 3 Nano Omni
 30B A3B Reasoning
          |
          v
  NVIDIA L40S 48 GB
          |
          | AI Response
          v
       WorthIt
```

PostgreSQL operates alongside the AI system to persist user profiles, calendar information, conversations, decisions, and previous outcomes.

## Run Locally

The project requires the Node.js runtime from the `worthit` Conda environment.

```bash
conda env create -f environment.yml
conda activate worthit
npm ci
npm run dev
```

Open `http://localhost:3000`.

The seeded demo can run without the full database and AI infrastructure.

## Configure PostgreSQL

PostgreSQL and Node.js are included in `environment.yml`.

If the environment already exists, update it first:

```bash
conda env update -f environment.yml --prune
conda activate worthit
which node
which postgres
```

Both executable paths should start inside `.../envs/worthit/bin/`.

Initialize a local PostgreSQL database:

```bash
"$CONDA_PREFIX/bin/initdb" -D .postgres-data -U postgres --auth=scram-sha-256 --pwprompt
"$CONDA_PREFIX/bin/pg_ctl" -D .postgres-data -l .postgres-data/server.log -o "-p 5433" start
"$CONDA_PREFIX/bin/createdb" -h 127.0.0.1 -p 5433 -U postgres worthit
```

Copy `.env.example` to `.env.local` and configure the database connection:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5433/worthit
```

Percent-encode URL-special characters in the database password.

Apply all migrations and start the application:

```bash
npm run migrate
npm run dev
```

`DATABASE_URL` enables accounts and server-side persistence.

To stop PostgreSQL:

```bash
"$CONDA_PREFIX/bin/pg_ctl" -D .postgres-data stop
```

## AI Connection

For the SteelHacks deployment, Nemotron is served through NVIDIA NIM on the Brev GPU instance.

The local application accesses the NIM service through SSH port forwarding. The SSH tunnel must be active for live AI inference.

## Verification

```bash
npm run typecheck
npm run build
```
