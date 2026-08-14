# Estratégia de testes

## Aplicação

`test:coverage` mede os módulos de risco de autenticação, redirects, validação de formulários, conteúdo, upload de avatar e conteúdo textual dos convites. O comando falha se linhas, funções ou branches ficarem abaixo de 70%.

`test:all` combina a verificação de cobertura com os testes de banco. `test:db` exige a stack local do Supabase e o Docker Desktop ativo.

## Banco e segurança

As suítes pgTAP cobrem:

- RLS e acesso de membros e não membros
- Storage de avatares
- Grupos e exclusão em cascata
- Convites de uso único e rastreamento de envio
- Criação e atualização de perfis
- Autoria e validação de conteúdo
- Conteúdo opcional e inválido
- Conclusão automática na primeira avaliação
- Avaliações, mensagens, atividades e métricas
- Conteúdos importados do TMDB

Constraints únicas e bloqueios `FOR UPDATE` protegem os fluxos de convite e avaliação quando requisições concorrentes chegam ao banco.

## CI

O workflow de CI executa os checks da aplicação e do banco em gates independentes. Também recria a stack Supabase do zero para validar migrations, seed, RLS, pgTAP e o linter do banco.

Em pull requests, migrations existentes não podem ser alteradas nem removidas. Correções de schema devem ser adicionadas em novas migrations.
