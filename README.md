# Indica Aí — ambiente local de testes

Este roteiro prepara a aplicação, o banco Supabase e os dados de teste na máquina local.

## Pré-requisitos

- Node.js 22 ou superior
- npm
- Docker Desktop em execução

A Supabase CLI é uma dependência de desenvolvimento do projeto e será instalada pelo npm. Não é necessário instalá-la globalmente.

No Windows, se o PowerShell bloquear `npm.ps1` ou `npx.ps1`, use `npm.cmd` e `npx.cmd`, como nos exemplos abaixo. Em Linux ou macOS, use os mesmos comandos sem o sufixo `.cmd`.

## 1. Instale as dependências

No Windows:

```powershell
npm.cmd install
```

Em Linux ou macOS:

```bash
npm install
```

## 2. Inicie o Supabase local

Confirme que o Docker Desktop está aberto:

```powershell
docker info
npx.cmd supabase start
```

Em Linux ou macOS:

```bash
docker info
npx supabase start
```

Para consultar novamente as URLs e chaves locais:

```powershell
npx.cmd supabase status
```

Se a CLI informar que o Supabase já está iniciado, mas algum contêiner estiver encerrado, recrie a stack preservando o volume local:

```powershell
npx.cmd supabase stop
npx.cmd supabase start
```

## 3. Configure as variáveis locais

Crie `.env.development.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=COLE_A_PUBLISHABLE_KEY_EXIBIDA_PELO_SUPABASE
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WEBRTC_STUN_URL=stun:stun.cloudflare.com:3478
CLOUDFLARE_REALTIME_APP_ID=COLE_O_APP_ID_DO_REALTIME
CLOUDFLARE_REALTIME_APP_SECRET=COLE_O_APP_SECRET_DO_REALTIME
CLOUDFLARE_ACCOUNT_ID=COLE_O_ACCOUNT_ID
CLOUDFLARE_BILLING_API_TOKEN=COLE_UM_TOKEN_COM_BILLING_READ
TMDB_API_KEY=COLE_SUA_CHAVE_V3_DO_TMDB
```

Use o valor `PUBLISHABLE_KEY` mostrado por `supabase start` ou `supabase status`.

O arquivo `.env.development.local` é ignorado pelo Git e sobrescreve variáveis públicas de `.env.local` somente durante `next dev`.

As credenciais `CLOUDFLARE_REALTIME_*` são necessárias para testar transmissões reais. `CLOUDFLARE_BILLING_API_TOKEN` deve ter somente `Account > Billing > Read`; junto do Account ID, ele protege automaticamente a franquia mensal. Todas permanecem somente no servidor. `TMDB_API_KEY` é necessária para pesquisar e cadastrar conteúdos pelo TMDB. `RESEND_API_KEY` e `RESEND_FROM_EMAIL` são opcionais no ambiente local e só são necessários para testar o envio real de convites pela API do Resend.

## 4. Aplique migrations e seed

```powershell
npx.cmd supabase db reset
```

O reset recria o banco, aplica todas as migrations e executa `supabase/seed.sql`. Ele também invalida sessões locais anteriores.

O seed contém somente dados de desenvolvimento e inclui o usuário fictício `dev@example.test`, grupos, membros, conteúdos, votos, avaliações, mensagens, atividades e métricas.

## 5. Inicie a aplicação

```powershell
npm.cmd run dev
```

Acesse:

- Aplicação: http://localhost:3000
- Supabase Studio: http://127.0.0.1:54323
- Mailpit: http://127.0.0.1:54324
- API Supabase: http://127.0.0.1:54321

## 6. Entre com o usuário de teste

1. Abra http://localhost:3000.
2. Informe `dev@example.test`.
3. Abra o Mailpit em http://127.0.0.1:54324.
4. Copie o código numérico recebido.
5. Volte à aplicação e confirme o código.

O e-mail local usa `supabase/templates/magic_link.html` e contém somente `{{ .Token }}`. Nenhum magic link é enviado.

## 7. Execute os testes

Com a stack local do Supabase ativa:

```powershell
npm.cmd run test:all
```

Comandos individuais:

```powershell
npm.cmd run test:unit
npm.cmd run test:coverage
npm.cmd run test:db
npm.cmd run test:realtime
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

`test:db` e `test:realtime` exigem Docker Desktop e a stack local do Supabase com Realtime ativo. `test:coverage` exige no mínimo 70% de cobertura de linhas, funções e branches nos módulos configurados.

## Transmissão de tela

Qualquer membro ativo pode iniciar uma transmissão na página do grupo. O host compartilha tela e, quando disponível no Chrome/Edge, o áudio da tela. Somente o próprio host pode encerrar a sessão.

A mídia usa WebRTC por meio do Cloudflare Realtime SFU. O host publica uma vez no servidor de mídia e cada espectador recebe uma cópia do SFU, evitando a dependência de uma conexão direta entre os navegadores. O Supabase mantém autenticação, estado da sessão e Presence; ele não transporta vídeo ou áudio.

O áudio depende do navegador, do sistema operacional e da origem selecionada. No Chrome/Edge, prefira compartilhar uma guia e marque **Compartilhar áudio**; ao compartilhar a tela inteira, habilite **Compartilhar áudio do sistema** quando a opção estiver disponível. Cada transmissão aceita um host e até nove espectadores. Para ativar o recurso, crie um Realtime App na Cloudflare e configure `CLOUDFLARE_REALTIME_APP_ID` e `CLOUDFLARE_REALTIME_APP_SECRET` no ambiente do servidor. O secret nunca deve usar o prefixo `NEXT_PUBLIC_`.

O controle de consumo concilia diariamente a API oficial de billing com os bytes WebRTC recebidos e reportados pelos espectadores a cada 20 segundos. Uma margem de 25% cobre overhead e atrasos: aos 850 GB novas transmissões e espectadores são bloqueados; aos 900 GB transmissões ativas são encerradas pelo heartbeat. Se a consulta de billing falhar, novas conexões permanecem bloqueadas preventivamente.

O cliente tenta primeiro o endpoint FOCUS v2 de billing e usa automaticamente o endpoint v1 em contas nas quais o v2 Alpha/Restricted retorna `403` ou `404`.

## Stack opcional mais enxuta

O projeto depende de Realtime para transmissão de tela. O Storage deve permanecer ativo para os avatares. Analytics, Vector, Edge Functions e Imgproxy podem ser desativados em uma stack mais enxuta:

```powershell
npx.cmd supabase stop
npx.cmd supabase start -x analytics,vector,edge-runtime,functions,studio,meta,imgproxy
```

Nesse modo, o Supabase Studio não fica disponível, mas banco, Auth, API REST e Mailpit continuam funcionando.

## Visualizar o e-mail de convite

```powershell
npm.cmd run email:dev
```

## Encerrar o ambiente

Encerre o Next.js com `Ctrl+C` no terminal em que ele está rodando e pare o Supabase:

```powershell
npx.cmd supabase stop
```
