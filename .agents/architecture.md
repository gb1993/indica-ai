# Arquitetura e segurança

## Visão geral

O Indica Aí é uma aplicação privada para grupos de amigos indicarem, avaliarem e conversarem sobre filmes, séries e documentários.

Tecnologias principais:

- Next.js 16 com App Router, React 19 e TypeScript estrito
- Supabase Auth, PostgreSQL com Row Level Security e Storage para avatares
- TMDB para busca e preenchimento automático dos conteúdos audiovisuais
- Resend para convites de grupo
- Tailwind CSS
- Vercel para produção

## Variáveis de ambiente

Para usar o Supabase hospedado ou configurar produção, copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_APP_URL=https://indicai.gbdev.pro
NEXT_PUBLIC_WEBRTC_STUN_URL=stun:stun.cloudflare.com:3478
CLOUDFLARE_REALTIME_APP_ID=...
CLOUDFLARE_REALTIME_APP_SECRET=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_BILLING_API_TOKEN=...
TMDB_API_KEY=...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=acesso@mail.gbdev.pro
```

Variáveis `NEXT_PUBLIC_*` são incorporadas ao bundle do navegador e devem conter somente valores públicos. A publishable key do Supabase foi feita para esse uso; a autorização real é aplicada por RLS.

`CLOUDFLARE_REALTIME_APP_SECRET`, `CLOUDFLARE_BILLING_API_TOKEN`, `TMDB_API_KEY` e `RESEND_API_KEY` são segredos de servidor e nunca devem receber o prefixo `NEXT_PUBLIC_`. O token de billing recebe somente a permissão `Account > Billing > Read`.

O app não usa `SUPABASE_SERVICE_ROLE_KEY`: nenhuma operação normal precisa ignorar RLS. Se ela for necessária em uma rotina administrativa futura, deve permanecer exclusivamente no servidor e em um módulo separado.

## Transmissão de tela

A transmissão usa WebRTC com o Cloudflare Realtime SFU. O host publica uma vez no SFU e os espectadores assinam as tracks remotas. O Supabase transporta somente Presence e persiste o estado da sessão; vídeo e áudio passam pelo servidor de mídia. Qualquer membro ativo pode iniciar, somente o host pode encerrar e a sala comporta até nove espectadores.

O refresh token permanece em cookie `HttpOnly`. Um Route Handler de mesma origem entrega ao cliente somente o access token corrente, mantido em memória e usado para autorizar o WebSocket. Outro Route Handler valida a sessão Supabase e executa as operações de publicação e assinatura no SFU; o App Secret da Cloudflare nunca é enviado ao navegador. A resposta de renegociação é vinculada ao usuário e à sessão por um token HMAC curto.

O controle de custo combina o billing oficial da Cloudflare com deltas idempotentes de `bytesReceived` reportados pelos viewers. O servidor aplica 25% de margem, bloqueia novas conexões em 850 GB e encerra sessões ativas em 900 GB. Falhas na consulta oficial bloqueiam novas conexões, mas não derrubam uma sessão existente por uma indisponibilidade transitória.

A consulta usa o endpoint FOCUS v2 quando disponível e recua para o billing v1 quando a Cloudflare responde `403` ou `404` ao endpoint ainda restrito.

As variáveis são validadas com Zod quando cada integração é inicializada. Uma configuração ausente falha explicitamente no servidor sem expor o valor ao usuário.

## Autenticação por código

O login usa apenas um código numérico enviado por e-mail; Google OAuth e magic link não estão habilitados.

Configuração no Supabase:

1. Em **Authentication → URL Configuration**, configure **Site URL** como `https://indicai.gbdev.pro`.
2. Em **Authentication → Sign In / Providers → Email**, mantenha o provedor de e-mail ativo.
3. Configure a expiração do OTP em `300` segundos.
4. Em **Authentication → Emails → Templates → Magic link or OTP**, use `{{ .Token }}` em vez de `{{ .ConfirmationURL }}`.

Exemplo de template:

```html
<h2>Seu código de acesso</h2>
<p>Use o código abaixo para entrar no Indica Aí:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>O código expira em 5 minutos. Se você não solicitou este acesso, ignore o e-mail.</p>
```

O SMTP configurado no painel do Supabase envia códigos de login. A API do Resend configurada no app envia convites de grupo; são fluxos separados.

As respostas do formulário são genéricas para não confirmar se um e-mail já possui conta. Solicitar o código cria apenas um registro pendente no Supabase Auth. O perfil da aplicação é criado pelo trigger depois que o código é validado e o primeiro login gera uma sessão.

A sessão SSR fica somente em cookies `HttpOnly`, `SameSite=Lax` e `Secure` em produção. Tokens de autenticação não são gravados em `localStorage` ou `sessionStorage`.

## Avatar

O usuário seleciona uma imagem JPG, PNG ou WebP de até 8 MB, reposiciona o enquadramento em um recorte circular com zoom e confirma a prévia antes de salvar. O navegador gera um WebP de 256 × 256 pixels com no máximo 1 MB.

Como a sessão fica em cookie `HttpOnly`, o arquivo otimizado é enviado a uma Server Action. O servidor valida novamente o arquivo, identifica o usuário pela sessão e grava o objeto no diretório exclusivo dele no Supabase Storage. A chave ou o token da sessão não são expostos ao JavaScript do navegador.

## Banco, RLS e migrations

As migrations ficam em `supabase/migrations`. Todas as tabelas públicas têm RLS habilitada. Funções `security definer` usam `search_path = ''`, validam `auth.uid()` e possuem `EXECUTE` concedido somente a `authenticated` quando fazem parte da API do app. Funções internas de trigger não são RPCs públicas.

Comandos para trabalhar com um projeto hospedado:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase migration list
npx supabase db lint --linked --level warning
npx supabase db push
```

Revise toda migration pendente antes de executar `db push`. Migrations já aplicadas não devem ser editadas; correções devem entrar em uma nova migration.

O arquivo `supabase/seed.sql` contém apenas dados locais de desenvolvimento, não é executado por `supabase db push` e nunca deve ser aplicado manualmente no projeto remoto.
