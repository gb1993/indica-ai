# Indica Aí

Aplicação privada para grupos de amigos indicarem, votarem e conversarem sobre filmes, séries, animes, documentários e livros.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local` e preencha as credenciais do projeto Supabase.
2. Aplique as migrations de `supabase/migrations` no Supabase.
3. No painel do Supabase, habilite a autenticação por e-mail e configure a Site URL da aplicação.
4. No template **Magic link or OTP**, envie somente o código de acesso:

```html
<h2>Seu código de acesso</h2>
<p>Use o código abaixo para entrar no Indica Aí:</p>
<p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">
  {{ .Token }}
</p>
<p>Se você não solicitou este acesso, ignore este e-mail.</p>
```

5. Instale e execute:

```bash
npm install
npm run dev
```

O app usa Supabase SSR; a sessão é mantida apenas em cookies protegidos, nunca em Web Storage.
