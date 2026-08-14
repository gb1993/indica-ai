# CI, publicação e operação

## CI no GitHub e deploy pelo Supabase

O workflow `.github/workflows/ci.yml` é executado em pull requests para `main`, em pushes na `main` e manualmente. Dois gates independentes precisam passar:

- **Application checks:** instalação reproduzível com `npm ci`, lint, TypeScript, testes com cobertura mínima de 70% e build de produção.
- **Database migrations, RLS and pgTAP:** inicia uma stack Supabase descartável, reaplica migrations e seed do zero, executa testes pgTAP e falha em warnings do linter do banco.

Em pull requests, o workflow rejeita alteração ou remoção de migrations existentes. Toda correção de schema deve ser uma nova migration. O PR nunca recebe credenciais nem altera o Supabase de produção.

Depois do merge, a integração oficial **Supabase → GitHub**, com **Deploy to production** apontando para a branch `main`, aplica as migrations pendentes no projeto hospedado. O seed não é enviado para produção.

O GitHub Actions não executa `db push` e não precisa de `SUPABASE_ACCESS_TOKEN` nem `SUPABASE_DB_PASSWORD`, evitando dois processos concorrentes de publicação.

Como o Supabase Branching não está habilitado, o PR não cria banco remoto de preview. A validação usa a stack Supabase descartável do runner, incluindo migrations, seed, RLS, pgTAP e database lint.

## Proteção da branch principal

Configure um Ruleset ativo e sem bypass para a `main`:

- Exija pull request antes do merge, com `0` aprovações enquanto houver apenas um mantenedor.
- Exija resolução de todas as conversas.
- Exija os checks **Application checks** e **Database migrations, RLS and pgTAP**.
- Exija que a branch do PR esteja atualizada com a `main`.
- Bloqueie force push e exclusão da `main`.
- Use somente **Squash** como método de merge.

A Vercel pode continuar fazendo o deploy da aplicação a partir da `main`; o GitHub Actions valida o código e a integração do Supabase publica as migrations.

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

## Incidentes

Em caso de incidente, revogue a chave afetada no provedor, atualize-a na Vercel e gere um novo deploy.

Não registre tokens, códigos OTP, chaves, cookies, e-mails completos ou stack traces nos logs da aplicação.
