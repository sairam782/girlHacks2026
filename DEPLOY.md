# Deploying Canopy to Azure App Service

Canopy keeps its data and cached briefing audio on disk, so it needs a host with a persistent disk. Azure App Service (Linux) keeps everything under `/home`, which survives restarts. Hosts that wipe the disk on every request (Vercel, Netlify) will lose data.

Budget about 20 minutes. Azure for Students gives free credit if you don't have a subscription.

## 1. Create the web app

1. Go to https://portal.azure.com and sign in.
2. Search for **App Services** in the top bar, open it, then click **+ Create** → **Web App**.
3. **Basics** tab:
   - **Subscription**: yours (e.g. Azure for Students).
   - **Resource group**: **Create new** → `canopy`.
   - **Name**: e.g. `canopy-girlhacks`. This becomes `https://canopy-girlhacks.azurewebsites.net`.
   - **Publish**: **Code**.
   - **Runtime stack**: **Node 22 LTS**.
   - **Operating System**: **Linux**.
   - **Region**: **East US**.
   - **Pricing plan**: **Basic B1**. The free F1 tier is too small to build Next.js.
4. Click **Review + create**, then **Create**. Wait for "Your deployment is complete", then **Go to resource**.

## 2. Add the settings (environment variables)

1. In the web app, open **Settings → Environment variables**.
2. Under **App settings**, click **+ Add** for each row, then **Apply** at the bottom and **Confirm**:

| Name | Value |
| --- | --- |
| `GEMINI_API_KEY` | your Gemini key |
| `GEMINI_MODEL` | `gemini-3.5-flash` |
| `ELEVENLABS_API_KEY` | your ElevenLabs key |
| `DATABASE_URL` | your Tiger Data connection string |
| `CANOPY_DATA_DIR` | `/home/data` |
| `CANOPY_TZ` | `America/New_York` |
| `TZ` | `America/New_York` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |

`TZ` and `CANOPY_TZ` stop the app from treating 8 pm Eastern as "tomorrow", because Azure's clock runs on UTC.

## 3. Set the start command

1. Open **Settings → Configuration** → **General settings** tab.
2. **Startup Command**: `npm run start`
3. Click **Save**, then **Continue**.

## 4. Connect GitHub

1. Open **Deployment → Deployment Center**.
2. **Source**: **GitHub**. Click **Authorize** and sign in if asked.
3. **Organization**: `sairam782`. **Repository**: `girlHacks2026`. **Branch**: `main`.
4. Click **Save**.

Azure adds a GitHub Actions workflow file to the repo and starts the first deploy. Every push to `main` redeploys from then on. Watch progress in the **Logs** tab of Deployment Center, or the **Actions** tab on GitHub. The first build takes 5 to 10 minutes.

Azure also stores a deploy secret in the repo, which needs admin access to `sairam782/girlHacks2026`. If you get a permissions error, have the repo owner do step 4.

## 5. Load the demo and check it

1. Open `https://<your-app-name>.azurewebsites.net`.
2. In the left sidebar, under **Time travel**, click **Reset demo data** and confirm. You now have the three-project demo grove.
3. Check the engine dots at the bottom of the sidebar: Gemini, ElevenLabs and Tiger Data should all be green.
4. Click the green orb and allow the microphone. Use Chrome or Edge; voice input does not work in Firefox, but typing does.
5. Put the URL in the pitch deck and the README in place of `[CANOPY-URL]`.

Once real people use the app, set `CANOPY_ALLOW_RESET` to `false` so the reset button cannot wipe their data.

## Mood Mirror's Python service (optional)

The Mood Mirror screen, its two demo meetings, and transcript uploads all work without it. Only audio recordings, the opt-in face layer and the spoken recap need the Python service in `mood-mirror/`. To host it, create a second web app with **Runtime stack: Python 3.12**, deploy the `mood-mirror` folder, use the startup command `uvicorn app:app --host 0.0.0.0 --port 8000`, and set `MOOD_MIRROR_URL` on the Canopy app to that app's URL. If there is no time, leave recordings and the face layer out of the live demo.

## If something goes wrong

- **Site shows "Application Error"**: open **Monitoring → Log stream** in the web app and read the last lines.
- **Build fails**: confirm `SCM_DO_BUILD_DURING_DEPLOYMENT` is `true` and the plan is B1 or larger.
- **Engines show "fallback"**: an app setting is missing or misspelled; fix it in step 2. The app restarts on **Apply**.
- **Data disappeared after a restart**: `CANOPY_DATA_DIR` is not set to a folder under `/home`.
