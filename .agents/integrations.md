# Integrações externas

## TMDB e cadastro de conteúdos

O TMDB não oferece GraphQL oficial. A integração usa a API REST v3 exclusivamente no servidor, com a chave armazenada em `TMDB_API_KEY`. A chave nunca é enviada ao navegador.

No cadastro, o membro pesquisa filmes e séries em português. Resultados classificados pelo TMDB com o gênero `Documentary` são apresentados como documentários, inclusive séries documentais.

Ao selecionar um resultado, o app consulta os detalhes e preenche título, descrição, capa, tipo e trailer automaticamente. O servidor repete essa consulta antes de gravar, evitando confiar em campos manipuláveis pelo cliente.

Os campos manuais aparecem somente quando a busca não encontra o conteúdo, o membro informa que nenhum resultado corresponde ao desejado ou a API está indisponível. Conteúdos manuais continuam aceitos.

Conteúdos vindos do TMDB armazenam `tmdb_id` e `tmdb_media_type`. A combinação é única dentro de cada grupo, impede indicações duplicadas e permite localizar ou remover futuramente uma indicação externa sem afetar outros grupos.

## Resend e domínio

Configuração no Resend:

1. Adicione e verifique o domínio remetente, por exemplo `mail.gbdev.pro`.
2. Cadastre no DNS todos os registros SPF e DKIM mostrados pelo Resend.
3. Aguarde o status **Verified**.
4. Use um remetente pertencente ao domínio verificado, como `acesso@mail.gbdev.pro`.

Convites expiram em cinco minutos, são vinculados ao e-mail destinatário e só podem ser aceitos uma vez. Apenas o SHA-256 do token fica no banco. Reenviar um convite cancela o token anterior.

O e-mail de convite é definido em `src/emails/group-invitation.tsx`, com versão HTML responsiva e alternativa em texto puro.

O envio usa uma chave de idempotência baseada no ID do convite e tags para facilitar a busca no painel do Resend. O banco registra `pending`, `sent` ou `failed`, além do ID retornado pelo provedor.

Nesse fluxo, `sent` significa que a API do Resend aceitou o envio; não confirma a entrega na caixa postal. O projeto não recebe webhooks do Resend e continua sem `SUPABASE_SERVICE_ROLE_KEY`.
