# Linkargo Backend Setup Guide

## Step 1 — Run Database Schema in Supabase

1. Go to your Supabase project → **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `schema.sql`
4. Paste it and click **Run**
5. You should see "Success" — your tables are created!

---

## Step 2 — Deploy Backend to Railway (Free)

1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Push this backend folder to GitHub first:

```bash
cd linkargo-backend
git init
git add .
git commit -m "Linkargo backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/linkargo-backend.git
git push -u origin main
```

4. In Railway, select your `linkargo-backend` repo
5. Railway will auto-detect Node.js and deploy it

### Add Environment Variables in Railway:
Go to your Railway project → **Variables** tab → Add these:

```
SUPABASE_URL=https://dnjlxdkmirbrztewgfky.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuamx4ZGttaXJicnp0ZXdnZmt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyNjkyMiwiZXhwIjoyMDkzOTAyOTIyfQ.BddpYACFOSaHjHo5FWIvZcky2L1qrWIxYhSbF-pDjTU
JWT_SECRET=linkargo_super_secret_jwt_key_2024_pakistan_freight
PORT=3001
```

6. After deploy, Railway gives you a URL like: `https://linkargo-backend-production.up.railway.app`
7. **Copy that URL** — you need it for Step 3!

---

## Step 3 — Update Frontend API

1. Replace your `src/api/index.js` with the `frontend-api.js` file provided
2. Create a `.env` file in your React project root:

```
REACT_APP_API_URL=https://YOUR-RAILWAY-URL.up.railway.app/api
```

Replace `YOUR-RAILWAY-URL` with your actual Railway URL from Step 2.

3. Rebuild and redeploy your frontend

---

## API Endpoints Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Register new user |
| POST | /api/auth/login | No | Login |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/jobs | Yes | List all open jobs |
| GET | /api/jobs/my | Yes | Get my jobs (shipper) |
| POST | /api/jobs | Yes | Create a job |
| PATCH | /api/jobs/:id/status | Yes | Update job status |
| GET | /api/jobs/stats/shipper | Yes | Shipper stats |
| GET | /api/jobs/stats/carrier | Yes | Carrier stats |
| GET | /api/quotes/job/:jobId | Yes | Get quotes for a job |
| GET | /api/quotes/my | Yes | My quotes (carrier) |
| POST | /api/quotes/:jobId | Yes | Submit a quote |
| PATCH | /api/quotes/:id/accept | Yes | Accept a quote |
| PATCH | /api/quotes/:id/reject | Yes | Reject a quote |
| PATCH | /api/profiles/me | Yes | Update profile |

---

## Test It Locally First

```bash
npm install
node src/index.js
```

Visit `http://localhost:3001` — you should see: `{"status":"Linkargo API running ✅"}`
