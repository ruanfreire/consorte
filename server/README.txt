API de mensagens (MongoDB Atlas) — não exponha MONGODB_URI no front.

1) Atlas: Network Access → adicione 0.0.0.0/0 (ou IP do host da API em produção).
2) Copie server/.env.example para server/.env e preencha MONGODB_URI (Database → Connect).
3) Na pasta server:
   npm install
   npm run init-db
   npm start
4) Hospede a API (Render, Railway, Fly.io): comando "npm start", variável MONGODB_URI, PORT.
5) No front (.env.local ou GitHub Secrets no build):
   VITE_MESSAGES_API_URL=https://sua-api.onrender.com

Ordem no app: VITE_MESSAGES_API_URL (Mongo API) > Supabase > localStorage.
