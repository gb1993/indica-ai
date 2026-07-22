# Indica Aí

Aplicação privada para grupos de amigos indicarem, votarem e conversarem sobre filmes, séries, animes, documentários e livros.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local` e preencha as credenciais do projeto Supabase.
2. Aplique as migrations de `supabase/migrations` no Supabase.
3. No painel do Supabase, habilite a autenticação por e-mail e configure a Site URL da aplicação.
   Configure a validade do OTP como `300` segundos (5 minutos).
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

## Convites por e-mail

Os convites de grupo são enviados diretamente pela API do Resend. Verifique o domínio remetente no Resend e configure:

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=acesso@mail.gbdev.pro
```

O link de convite usa `NEXT_PUBLIC_APP_URL`, expira em cinco minutos e somente o hash do token é armazenado no banco.

O app usa Supabase SSR; a sessão é mantida apenas em cookies protegidos, nunca em Web Storage.
