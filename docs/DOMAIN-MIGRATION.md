# Migração Aprendify: Vercel + Hostinger

Destino: landing `https://aprendify.cloud` (projeto `C:\Codes\landing-aprendify`) e aplicação `https://app.aprendify.cloud` (este projeto).

## Estado verificado em 12/09/2026 UTC

- DNS autoritativo: `ns1.dns-parking.com` e `ns2.dns-parking.com` (Hostinger).
- O domínio raiz responde na Vercel e redireciona 308 para `www.aprendify.cloud`.
- `app.aprendify.cloud` está associado ao projeto Vercel do aplicativo.
- `aprendify.cloud` e `www.aprendify.cloud` estão associados ao projeto Vercel `landing-aprendify`; o apex é o canônico e `www` redireciona com 308.
- O CNAME `app → aa1315d621ff2d28.vercel-dns-017.com` foi criado na zona DNS da Hostinger.

## Ordem de publicação

1. Aplicação publicada e validada na Vercel no projeto existente.
2. `app.aprendify.cloud` adicionado ao projeto da aplicação, com TLS emitido e acesso a `/auth` validado.
3. CNAME `app` criado na Hostinger, sem alteração de nameservers, MX ou TXT existentes.
4. Landing publicada no projeto Vercel `landing-aprendify`; `aprendify.cloud` é o domínio principal e `www` redireciona para ele.
5. Supabase Auth: configurar Site URL para `https://app.aprendify.cloud`; incluir os retornos exatos usados pelo cliente (`/dashboard`, `/auth?reset=true` e `/`) em Redirect URLs. Conferir templates de e-mail e preservação de token/código. Manter URLs antigas apenas durante a transição necessária para links já enviados.
6. Conferir no console Google OAuth o fluxo utilizado. No fluxo Supabase, o callback OAuth continua sendo o endpoint `/auth/v1/callback` do Supabase, não deve ser substituído pelo endereço da landing. Atualizar origens autorizadas se usadas. Adicionar o novo hostname nas configurações do reCAPTCHA se esse recurso estiver ativo.
7. Publicar as Edge Functions alteradas e aplicar a migração SQL após validação em ambiente de teste; verificar permissões, limites e pagamento. Checkout e portal passam a retornar para o subdomínio do aplicativo.
8. Projeto Vercel separado da landing criado, publicado e associado aos dois domínios. A regra apex → www foi removida e `www → apex` configurado.
9. Manter redirecionamentos de rotas legadas do app na landing, preservando caminhos e query strings (especialmente recuperação de senha e pagamento). Sessões em localStorage não atravessam domínios: usuários precisarão entrar novamente.
10. Testar HTTPS, login Google, login/senha, recuperação, checkout/portal e links compartilhados. Não concluir a migração antes desses testes.

## SEO Google após publicação

- Verificar uma propriedade **Domínio** `aprendify.cloud` no Google Search Console usando o TXT fornecido pelo Google na Hostinger. Isso abrange também www e app. Não existe token genérico de verificação.
- Enviar `https://aprendify.cloud/sitemap.xml` e inspecionar a URL principal para solicitar indexação.
- Conferir HTML renderizado, canonical, robots e dados estruturados na Inspeção de URL e no teste de resultados avançados. O app usa `noindex, follow` no HTML e no header, mantendo crawling permitido para que o Google leia a diretiva.
- Acompanhar indexação e Core Web Vitals (LCP, INP, CLS) com dados reais após tráfego suficiente. Sitemap e metadados ajudam a descoberta; não garantem indexação ou posição.
- Não adicionar avaliações, estatísticas ou conteúdo estruturado que não correspondam a fatos verificáveis.

## Rollback

Registrar os deployments e registros DNS anteriores antes do corte. Se falhar a landing, restaurar a associação de domínio/deployment anterior na Vercel e registros específicos alterados. Se falhar autenticação, restaurar temporariamente Site URL e a allowlist antiga de redirects enquanto corrige o fluxo. Nunca desfazer indiscriminadamente a zona DNS.

## Referências

- [Hostinger: apontar subdomínio a serviço externo](https://www.hostinger.com/support/8907694-how-to-create-a-subdomain-without-a-hosting-plan-at-hostinger/)
- [Vercel: configurar domínio personalizado](https://vercel.com/docs/domains/set-up-custom-domain)
- [Google: SEO para JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google: sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
