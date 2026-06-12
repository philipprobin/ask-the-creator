# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Fill in:
   - **Name**: `ask-the-creator` (or any name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free (500MB storage, enough for thousands of videos)
4. Click **Create new project** → wait ~2 minutes for provisioning

## 2. Enable pgvector Extension

1. In your project dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Paste this SQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

4. Click **Run** (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned"

## 3. Create Embeddings Table

1. Still in **SQL Editor**, create a new query
2. Copy the entire content from `sql/init.sql` in this repo
3. Click **Run**
4. Verify the table was created:
   - Go to **Table Editor** (left sidebar)
   - You should see `embeddings` table with columns: id, channel_id, video_id, video_title, chunk_text, chunk_start, embedding, created_at

## 4. Get Connection String

1. Go to **Project Settings** (gear icon in sidebar)
2. Click **Database** tab
3. Scroll to **Connection string**
4. Select **URI** tab
5. Copy the connection string (looks like):
   ```
   postgresql://postgres.xxxxx:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
6. **Important**: Replace `[YOUR-PASSWORD]` with the database password from step 1

## 5. Add to Vercel

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your `ask-the-creator` project
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste your Supabase connection string (with password filled in)
   - **Environments**: Select all (Production, Preview, Development)
5. Click **Save**

## 6. Redeploy

1. Go to **Deployments** tab in Vercel
2. Click the 3-dot menu on the latest deployment
3. Click **Redeploy**
4. Wait for deployment to finish (~1-2 minutes)

## 7. Test

1. Open your app (e.g., https://ask-the-creator.vercel.app)
2. Search for a channel (e.g., "Alex Hormozi")
3. Click **Embetten** → wait for embeddings to complete
4. Go to chat → ask a question
5. This time it should work across all serverless instances!

## Verify Database

To check if embeddings are being stored:

1. In Supabase → **Table Editor** → `embeddings`
2. You should see rows with channel_id, video_id, chunk_text, etc.
3. The `embedding` column shows as `[vector]` (1536 dimensions)

## Troubleshooting

### Error: "relation 'embeddings' does not exist"
→ Re-run the SQL from `sql/init.sql`

### Error: "extension 'vector' does not exist"
→ Enable pgvector: `CREATE EXTENSION vector;`

### Connection timeout
→ Check if DATABASE_URL includes `:6543` port (pooler) not `:5432`
→ Supabase uses connection pooler for serverless

### SSL error
→ The code already includes `ssl: { rejectUnauthorized: false }`
→ If issues persist, try adding `?sslmode=require` to connection string

## Cost Estimate

**Free tier** (sufficient for testing + moderate usage):
- 500 MB database storage
- ~50,000 embeddings (assuming ~10KB per row)
- 2 GB data transfer/month

**Paid tier** ($25/mo):
- 8 GB storage
- ~800,000 embeddings
- 50 GB transfer

For your use case (personal + demos), free tier is plenty.
