# Vercel deployment

This deployment is a shared hackathon demo using fictional meeting data. It has no user authentication; the interface labels reports as a personal view, not protected private storage. Do not upload real meeting data.

Vercel uses the `canopy_app_state` PostgreSQL table for application state. Each deployment's `CANOPY_STORE_KEY` selects its row. Database row locks serialize changes across function instances. Local development still uses `.data/store.json` unless `CANOPY_STORE=postgres` is set. Existing JSON data is not automatically migrated.

Set these variables in the Vercel project's **Production** environment:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your Tiger Data/PostgreSQL connection string, including the provider's SSL settings |
| `CANOPY_STORE` | `postgres` |
| `CANOPY_STORE_KEY` | `canopy-girlhacks` |
| `CANOPY_DEMO_MODE` | `true` |
| `CANOPY_ALLOW_RESET` | `false` |
| `CANOPY_DELETE_USERNAME` | Server-only administrator username for project deletion |
| `CANOPY_DELETE_PASSWORD` | Sensitive server-only password for project deletion |
| `CANOPY_TZ` | `America/New_York` |
| `GEMINI_API_KEY` | Secret; optional for rules fallback |
| `GEMINI_MODEL` | A model verified with your key |
| `ELEVENLABS_API_KEY` | Secret; optional for browser speech fallback |

The application creates its state table if necessary and seeds fictional projects only if that store key does not exist. It does not overwrite an existing store. The database user needs table-creation and read/write permissions. Tiger Data event mirroring uses the existing `commitment_events` hypertable; a regular PostgreSQL server can keep canonical history in the JSONB state even if the optional hypertable integration is unavailable.

The reset endpoint is disabled to avoid clearing the existing commitment history. Seed scripts designed for local JSON storage should not be used to initialize this deployment.

Project deletion prompts for administrator credentials on every attempt and verifies them in the API before accessing storage. Missing server credentials disable deletion. This protects project deletion only; it does not introduce user accounts or authentication for other editing actions.

Morning briefing audio is returned directly with its response on Vercel, so it does not depend on an instance-local cache. This means fresh briefing requests can incur another ElevenLabs generation.

Without a hosted `MOOD_MIRROR_URL`, Mood Mirror demo reports and JSON transcript analysis run inside Next.js. Recording uploads, face processing, and Mood Mirror spoken recaps require the separate Python service and are unavailable. Do not set `MOOD_MIRROR_URL` to localhost on Vercel. Azure OpenAI tone analysis can be enabled separately with the documented `AZURE_OPENAI_*` variables.

Deploy from this directory using `vercel --prod --scope abhi-1a06`. Secrets, `.data`, and the optional Python service are excluded from the Vercel upload. Preview deployments need their own environment variables and should use a different `CANOPY_STORE_KEY` to isolate test data.
