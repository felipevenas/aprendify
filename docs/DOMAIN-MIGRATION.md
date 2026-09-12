# Migração Aprendify: Vercel + Hostinger

Destino: landing `https://aprendify.cloud` (projeto `C:\Codes\landing-aprendify`) e aplicação `https://app.aprendify.cloud` (este projeto).

## Estado verificado em 12/09/2026 UTC

- DNS autoritativo: `ns1.dns-parking.com` e `ns2.dns-parking.com` (Hostinger).
- O domínio raiz responde na Vercel e redireciona 308 para `www.aprendify.cloud`.
- Não foi encontrado CNAME para `app.aprendify.cloud`.
- Os painéis Vercel e Hostinger exigem login na sessão disponível. Nenhuma alteração de DNS ou publicação foi realizada nesta etapa.

## Ordem de publicação

1. Publicar e validar as correções da aplicação na Vercel, no projeto existente. Não remover o domínio antigo ainda.
2. Em Settings > Domains do projeto da aplicação, adicionar `app.aprendify.cloud`. Copiar o destino DNS **exato** apresentado pela Vercel (pode ser específico do projeto).
3. No editor DNS da Hostinger, criar CNAME com nome `app`, destino retornado pela Vercel. Verificar se já há A/AAAA/CNAME conflitante para esse mesmo nome. Não mudar nameservers, MX, TXT de e-mail ou outros serviços.
4. Aguardar validação DNS e emissão TLS na Vercel. Testar acesso direto a `/auth`, `/dashboard` e recarga de rotas no subdomínio.
5. Supabase Auth: configurar Site URL para `https://app.aprendify.cloud`; incluir os retornos exatos usados pelo cliente (`/dashboard`, `/auth?reset=true` e `/`) em Redirect URLs. Conferir templates de e-mail e preservação de token/código. Manter URLs antigas apenas durante a transição necessária para links já enviados.
6. Conferir no console Google OAuth o fluxo utilizado. No fluxo Supabase, o callback OAuth continua sendo o endpoint `/auth/v1/callback` do Supabase, não deve ser substituído pelo endereço da landing. Atualizar origens autorizadas se usadas. Adicionar o novo hostname nas configurações do reCAPTCHA se esse recurso estiver ativo.
7. Publicar as Edge Functions alteradas e aplicar a migração SQL após validação em ambiente de teste; verificar permissões, limites e pagamento. Checkout e portal passam a retornar para o subdomínio do aplicativo.
8. Criar/publicar projeto Vercel separado para a landing; validar seu preview e build. Associar `aprendify.cloud` e `www.aprendify.cloud` a esse projeto. Remover a regra antiga raiz → www e configurar www → raiz. Aplicar o A/CNAME indicado pelo painel somente se necessário.
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
