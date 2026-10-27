# Sistema de Vistoria de Locais de Prova — SES/TO

Aplicação web baseada no HTML fornecido, com autenticação Supabase e persistência de vistorias na tabela `public.inspections`.

## Configuração

1. Publique `index.html` em um servidor estático (não use `file://` em produção).
2. A URL do projeto Supabase e a chave publicável estão configuradas no JavaScript. Se usar outro projeto, altere `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
3. A tabela e as políticas RLS foram criadas no projeto Supabase associado. O SQL de referência está em `supabase/migrations/`.
4. No Supabase Auth, configure a confirmação de e-mail conforme a política da organização.
5. Para publicação, você pode usar Vercel ou GitHub Pages.

## Segurança

O frontend usa apenas a chave publicável. A tabela tem Row Level Security (RLS) ativado e cada conta só pode consultar, criar, alterar ou excluir registros vinculados ao seu próprio `user_id`. Nunca coloque uma chave `service_role` ou `sb_secret` no frontend.

## Dados demonstrativos

A opção de dados demonstrativos serve apenas para demonstração na sessão; ela não persiste automaticamente na nuvem. Os registros reais são carregados e salvos no Supabase depois do login.
