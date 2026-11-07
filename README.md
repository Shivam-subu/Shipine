# PINSHI store (frontend + backend in one Next.js project)
Local: cp .env.example .env (add DATABASE_URL) → npm install → npx prisma db push → npm run db:seed → npm run dev
Live: push to GitHub, import in Vercel, add DATABASE_URL, set build command `prisma db push && npm run build`, then run `npm run db:seed` once locally against the live DB.
