# Indica Aí

Aplicação privada para grupos de amigos indicarem, votarem, avaliarem e conversarem sobre filmes, séries e documentários.

## Tecnologias

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
TMDB_API_KEY=...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=acesso@mail.gbdev.pro
```

`NEXT_PUBLIC_*` é incorporada ao bundle do navegador e deve conter somente valores públicos. A publishable key do Supabase foi feita para esse uso e a autorização real é aplicada por RLS. `TMDB_API_KEY` e `RESEND_API_KEY` são segredos de servidor e nunca podem receber o prefixo `NEXT_PUBLIC_`.

O app não usa `SUPABASE_SERVICE_ROLE_KEY`: nenhuma operação normal precisa ignorar RLS. Se ela for necessária em uma futura rotina administrativa, mantenha-a exclusivamente no servidor e em um módulo separado.

As variáveis são validadas com Zod quando cada integração é inicializada. Uma configuração ausente falha de forma explícita no servidor, sem expor o valor ao usuário.

## Desenvolvimento local

### Pré-requisitos

- Node.js 22 ou superior
- npm
- Docker Desktop em execução

A Supabase CLI é uma dependência de desenvolvimento do projeto e será instalada pelo npm. Não é necessário instalá-la globalmente.

No Windows, se o PowerShell bloquear os arquivos `npm.ps1` ou `npx.ps1`, use `npm.cmd` e `npx.cmd`, conforme os exemplos abaixo. Em Linux ou macOS, use os mesmos comandos sem o sufixo `.cmd`.

### 1. Instale as dependências

```powershell
npm.cmd install
```

Em Linux ou macOS:

```bash
npm install
```

### 2. Inicie o Supabase local

Confirme primeiro que o Docker Desktop está aberto:

```powershell
docker info
npx.cmd supabase start
```

Ao final, o comando mostrará as URLs e chaves locais. Para consultá-las novamente:

```powershell
npx.cmd supabase status
```

### 3. Configure as variáveis locais

Crie `.env.development.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=COLE_A_PUBLISHABLE_KEY_EXIBIDA_PELO_SUPABASE
NEXT_PUBLIC_APP_URL=http://localhost:3000
TMDB_API_KEY=COLE_SUA_CHAVE_V3_DO_TMDB
```

Use o valor `PUBLISHABLE_KEY` mostrado por `supabase start` ou `supabase status`. O arquivo `.env.development.local` é ignorado pelo Git e sobrescreve as variáveis públicas de `.env.local` somente durante `next dev`, preservando uma eventual configuração remota.

`TMDB_API_KEY` é necessária para pesquisar e cadastrar conteúdos pelo TMDB. `RESEND_API_KEY` e `RESEND_FROM_EMAIL` não são necessários para login local; eles são exigidos apenas para testar o envio real de convites de grupo pela API do Resend.

### 4. Aplique migrations e seed

```powershell
npx.cmd supabase db reset
```

O reset recria o banco, aplica todas as migrations e executa `supabase/seed.sql`. Ele também invalida sessões locais anteriores.

O seed inclui o usuário fictício `dev@example.test`, grupos, membros, conteúdos, votos, avaliações, mensagens, atividades e métricas. O seed contém somente dados de desenvolvimento, nunca é executado por `supabase db push` e não deve ser rodado manualmente no projeto remoto.

### 5. Inicie o Next.js

```powershell
npm.cmd run dev
```

Acesse:

- Aplicação: http://localhost:3000
- Supabase Studio: http://127.0.0.1:54323
- Mailpit: http://127.0.0.1:54324
- API Supabase: http://127.0.0.1:54321

### 6. Entre com o usuário seedado

1. Abra http://localhost:3000.
2. Informe `dev@example.test`.
3. Abra o Mailpit em http://127.0.0.1:54324.
4. Copie o código numérico de seis dígitos.
5. Volte à aplicação e confirme o código.

O e-mail local usa `supabase/templates/magic_link.html`, mas contém apenas `{{ .Token }}`. Nenhum magic link é enviado.

### Stack opcional mais enxuta

O projeto não usa Analytics, Vector, Realtime ou Edge Functions atualmente. O Storage deve permanecer ativo para upload e entrega dos avatares; o Imgproxy é opcional porque a imagem já é recortada e convertida para WebP no navegador. Para iniciar uma stack mais enxuta:

```powershell
npx.cmd supabase stop
npx.cmd supabase start -x analytics,vector,realtime,edge-runtime,functions,studio,meta,imgproxy
```

Nesse modo, Supabase Studio não estará disponível, mas banco, Auth, API REST e Mailpit continuarão funcionando.

### Encerrar o ambiente

Encerre o Next.js com `Ctrl+C` no terminal em que ele está rodando e pare o Supabase:

```powershell
npx.cmd supabase stop
```

### Supabase hospedado

Para trabalhar com o Supabase hospedado em vez da stack local:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Não execute `supabase/seed.sql` no ambiente hospedado.

## Autenticação por código

O login usa apenas um código numérico enviado por e-mail; Google OAuth e magic link não estão habilitados.

No Supabase:

1. Acesse **Authentication → URL Configuration**.
2. Configure **Site URL** como `https://indicai.gbdev.pro`.
3. Em **Authentication → Sign In / Providers → Email**, mantenha o provedor de e-mail ativo.
4. Configure a expiração do OTP em `300` segundos.
5. Em **Authentication → Emails → Templates → Magic link or OTP**, use `{{ .Token }}` em vez de `{{ .ConfirmationURL }}`.

Exemplo de template:

```html
<h2>Seu código de acesso</h2>
<p>Use o código abaixo para entrar no Indica Aí:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>O código expira em 5 minutos. Se você não solicitou este acesso, ignore o e-mail.</p>
```

O Supabase deve usar um SMTP de produção. O SMTP configurado no painel do Supabase envia os códigos de login; a API do Resend configurada no app envia os convites de grupo. São fluxos separados.

As respostas do formulário de solicitação são genéricas para não confirmar se um e-mail já possui conta. Solicitar o código cria somente um registro pendente no Supabase Auth; o perfil da aplicação é criado pelo trigger apenas depois que o código é validado e o primeiro login gera uma sessão. A sessão SSR fica somente em cookies `HttpOnly`, `SameSite=Lax` e `Secure` em produção; tokens de autenticação não são gravados em `localStorage` ou `sessionStorage`.

## Avatar

O usuário seleciona uma imagem JPG, PNG ou WebP de até 8 MB, reposiciona o enquadramento em um recorte circular com zoom e confirma a prévia antes de salvar. O navegador gera um WebP de 256 × 256 pixels com no máximo 1 MB.

Como a sessão fica em cookie `HttpOnly`, o arquivo otimizado é enviado a uma Server Action. O servidor valida novamente o arquivo, identifica o usuário pela sessão e grava o objeto no diretório exclusivo dele no Supabase Storage. A chave ou o token da sessão não são expostos ao JavaScript do navegador.

## TMDB e cadastro de conteúdos

O TMDB não oferece GraphQL oficial. A integração usa a API REST v3 exclusivamente no servidor, com a chave armazenada em `TMDB_API_KEY`. A chave nunca é enviada ao navegador.

No cadastro, o membro pesquisa filmes e séries em português. Resultados classificados pelo TMDB com o gênero `Documentary` são apresentados como documentários, inclusive séries documentais. Ao selecionar um resultado, o app consulta os detalhes e preenche título, descrição, capa, tipo e trailer automaticamente. O servidor repete essa consulta antes de gravar, evitando confiar em campos manipuláveis pelo cliente.

Os campos manuais aparecem somente quando a busca não encontra o conteúdo, o membro informa que nenhum resultado corresponde ao desejado ou a API está indisponível. Conteúdos manuais continuam aceitos.

Conteúdos vindos do TMDB armazenam `tmdb_id` e `tmdb_media_type`. A combinação é única dentro de cada grupo, impede indicações duplicadas e permite localizar ou remover futuramente uma indicação externa sem afetar outros grupos.

## Resend e domínio

No Resend:

1. Adicione e verifique o domínio remetente, por exemplo `mail.gbdev.pro`.
2. Cadastre no DNS todos os registros SPF e DKIM mostrados pelo Resend.
3. Aguarde o status **Verified**.
4. Use um remetente pertencente ao domínio verificado, como `acesso@mail.gbdev.pro`.

Convites expiram em cinco minutos, são vinculados ao e-mail destinatário e só podem ser aceitos uma vez. Apenas o SHA-256 do token fica no banco. Reenviar um convite cancela o token anterior.

O e-mail de convite é definido em `src/emails/group-invitation.tsx`, com versão HTML responsiva e alternativa em texto puro. Para visualizar o template localmente:

```bash
npm run email:dev
```

O envio usa uma chave de idempotência baseada no ID do convite e tags para facilitar a busca no painel do Resend. O banco registra `pending`, `sent` ou `failed`, além do ID retornado pelo provedor. Neste fluxo, `sent` significa que a API do Resend aceitou o envio; não confirma entrega na caixa postal. O projeto não recebe webhooks do Resend e continua sem `SUPABASE_SERVICE_ROLE_KEY`.

## Banco, RLS e migrations

As migrations ficam em `supabase/migrations`. Todas as tabelas públicas têm RLS habilitada. Funções `security definer` usam `search_path = ''`, validam `auth.uid()` e possuem `EXECUTE` concedido somente a `authenticated` quando fazem parte da API do app. Funções internas de trigger não são RPCs públicas.

Comandos úteis:

```bash
npx supabase migration list
npx supabase db lint --linked --level warning
npx supabase db push
```

Revise a migration pendente antes de executar `db push`. Migrations já aplicadas não devem ser editadas; correções devem entrar em uma nova migration.

## Testes e qualidade

```bash
npm run test:unit
npm run test:coverage
npm run test:db
npm run test:all
npm run lint
npm run typecheck
npm run build
```

`test:coverage` mede os módulos de risco de autenticação, redirects, validação de formulários, conteúdo, upload de avatar e conteúdo textual dos convites, falhando se linhas, funções ou branches ficarem abaixo de 70%. `test:all` combina essa verificação com os testes de banco. O `test:db` exige a stack local do Supabase e o Docker Desktop ativo. As suítes pgTAP cobrem RLS, Storage de avatares, grupos, convites de uso único, rastreamento do envio de convites, autoria, conteúdo opcional e inválido, votação/maioria, conclusão, avaliações, mensagens e atividades. As constraints únicas e os bloqueios `FOR UPDATE` protegem os fluxos de convite e votação quando requisições concorrentes chegam ao banco.

## CI no GitHub e deploy pelo Supabase

O workflow `.github/workflows/ci.yml` é executado em pull requests para `main`, em pushes na `main` e manualmente. Dois gates independentes precisam passar:

- **Application checks:** instalação reproduzível com `npm ci`, lint, TypeScript, testes com cobertura mínima de 70% e build de produção.
- **Database migrations, RLS and pgTAP:** inicia uma stack Supabase descartável, reaplica migrations e seed do zero, executa testes pgTAP e falha em warnings do linter do banco.

Em pull requests, o workflow também rejeita alteração ou remoção de migrations existentes. Toda correção de schema deve ser uma nova migration. O PR nunca recebe credenciais nem altera o Supabase de produção.

Depois do merge, a integração oficial **Supabase → GitHub**, com **Deploy to production** apontando para a branch `main`, aplica as migrations pendentes no projeto hospedado. O seed não é enviado para produção. O GitHub Actions não executa `db push` e não precisa de `SUPABASE_ACCESS_TOKEN` nem `SUPABASE_DB_PASSWORD`, evitando dois processos concorrentes de publicação.

Como o Supabase Branching não está habilitado, o PR não cria um banco remoto de preview. A validação usa a stack Supabase descartável do runner, incluindo migrations, seed, RLS, pgTAP e database lint.

Proteja a branch `main` com um Ruleset ativo e sem bypass:

- Exija pull request antes do merge, com `0` aprovações enquanto houver apenas um mantenedor.
- Exija resolução de todas as conversas.
- Exija os checks **Application checks** e **Database migrations, RLS and pgTAP**.
- Exija que a branch do PR esteja atualizada com a `main`.
- Bloqueie force push e exclusão da `main`.
- Use somente **Squash** como método de merge.

A Vercel pode continuar fazendo o deploy da aplicação a partir da `main`; o GitHub Actions valida o código e o Supabase Integration publica as migrations.

## Publicação na Vercel

1. Conecte o repositório à Vercel.
2. Cadastre todas as variáveis de `.env.example` no ambiente **Production**.
3. Vincule `indicai.gbdev.pro` em **Settings → Domains** e aplique no DNS o CNAME indicado pela Vercel.
4. Confirme que `NEXT_PUBLIC_APP_URL` usa exatamente `https://indicai.gbdev.pro`, sem `/` final.
5. Confirme que **Deploy to production** está ativo na integração GitHub do Supabase e aponta para a branch `main`.
6. Faça o deploy e teste login, avatar, criação de grupo, convite, voto, conclusão, avaliação e mensagem com pelo menos dois usuários reais.

Cabeçalhos de proteção contra framing, MIME sniffing e permissões desnecessárias são enviados por todas as rotas. HSTS é habilitado somente no build de produção.

## Checklist antes de liberar usuários

- Domínio e HTTPS ativos na Vercel
- Site URL e OTP de 300 segundos corretos no Supabase
- SMTP do Supabase entregando códigos de login
- Domínio do Resend verificado e convites entregando
- Variáveis de produção, incluindo `TMDB_API_KEY`, cadastradas sem `service_role`
- `supabase db lint`, testes, lint, typecheck e build concluídos
- RLS validada com usuário membro e não membro
- Logs da Vercel, Supabase Auth e Resend sem falhas recorrentes

Em caso de incidente, revogue a chave afetada no provedor, atualize-a na Vercel e gere um novo deploy. Não registre tokens, códigos OTP, chaves, cookies, e-mails completos ou stack traces nos logs da aplicação.
