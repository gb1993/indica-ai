# Indica Aí

Aplicação privada para grupos de amigos indicarem, votarem e conversarem sobre filmes, séries, animes, documentários e livros.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local` e preencha as credenciais do projeto Supabase.
2. Aplique as migrations de `supabase/migrations` no Supabase.
3. No painel do Supabase, habilite Google e e-mail (Magic Link) e adicione `http://localhost:3000/auth/callback` às URLs de redirecionamento.
4. Instale e execute:

```bash
npm install
npm run dev
```

O app usa Supabase SSR; a sessão é mantida apenas em cookies protegidos, nunca em Web Storage.
