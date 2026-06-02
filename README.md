# BestFlight

BestFlight is a smart flight search tool that hunts for the best plane tickets for you. Instead of checking one site, it searches several flight sources at once, then sorts the results by what matters to you: cheapest, fastest, or kindest to the planet. It can also predict whether a fare is likely to go up or down, so it tells you whether to buy now or wait, and it can watch a route and alert you when the price drops. It's for travelers who want a better deal without doing all the comparison-shopping themselves.

## What it does
- Searches multiple flight providers at the same time and combines the results
- Ranks flights by cheapest, fastest, or lowest carbon footprint
- Finds clever connection options that can save money (with clear warnings about the risks)
- Predicts whether prices will rise or fall and advises "buy" or "wait"
- Lets you watch a route and get notified when the price drops
- Includes an AI chat assistant to help with flight questions

## Status
Work in progress (a website). It needs accounts and keys for the flight and AI services set up before it can run, and it is designed to be deployed online.

---
### For developers
Frontend: TypeScript + Vite + vanilla DOM. Backend: Vercel Serverless Functions (`api/`). Firebase for database (Firestore), auth, and push (FCM). AI via Google Gemini. Hourly price-watch polling via Vercel Cron. Setup: `npm install`, copy `.env.example` to `.env.local` and fill provider keys (Duffel, Amadeus, Travelpayouts, Climatiq, Gemini, Firebase), set up a Firebase project, then `npx vercel dev` (runs at `http://localhost:3000`); deploy with `npx vercel --prod`. The original README documents all API routes, Firestore collections, and the multi-leg / self-transfer / hidden-city connection modes.
