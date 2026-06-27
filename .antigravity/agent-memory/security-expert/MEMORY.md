# Security Expert Memory - Aprendify

Este arquivo registra a auditoria de segurança de aplicação, controle de acesso e pacotes na plataforma Aprendify.

## Auditoria de Dependências (AppSec)
- **Vulnerabilidades Identificadas**: `npm audit` reportou originalmente 19 vulnerabilidades (incluindo PDF Injection crítico em `jspdf`, XSS em `dompurify` e vulnerabilidades altas em `glob`, `rollup`, `ws` e `lodash`).
- **Mitigação Realizada**: Executado `npm audit fix`, reduzindo para apenas 1 vulnerabilidade moderada pendente (relacionada ao Vite local, que não impacta a segurança do bundle estático servido em produção).

## Auditoria de Gateways e Faturamento
- **Stripe Webhook (`stripe-webhook`)**: Seguro. Exige assinatura `stripe-signature` e validação do segredo `STRIPE_WEBHOOK_SECRET` em ambiente produtivo.
- **Criação de Cupons (`create-creator-coupon`)**: Seguro. Valida a autenticação do token JWT, confere permissão de administrador (`admin`) do chamador e implementa rate limits de 20 chamadas/hora.
- **Sessão de Checkout (`create-checkout`)**: Seguro. Valida a sessão do usuário chamador, verifica se o cupom de criador está ativo (`is_active = true`) e implementa rate limits (5 chamadas/hora) contra abuso.

## Vulnerabilidades de RLS Encontradas
1. **`leaderboard_stats` (Risco: Médio/Alto - Exploit de Gamificação)**:
   - *Descrição*: Possui política `Users can manage their own stats` com permissão `FOR ALL`. Permite que qualquer usuário logado manipule seus pontos de ranking diretamente pelo console do navegador.
   - *Correção*: Como a tabela é atualizada automaticamente por trigger no banco, a permissão de escrita deve ser removida, mantendo apenas `SELECT` para usuários autenticados.
2. **`user_challenge_progress` (Risco: Médio/Alto - Exploit de Gamificação)**:
   - *Descrição*: Possui política `Users can manage their own challenge progress` com permissão `FOR ALL`. Permite que usuários alterem o progresso e marquem desafios como concluídos, burlando o sistema.
   - *Correção*: Substituir a política por apenas `SELECT` (leitura), já que o progresso é incrementado automaticamente por trigger após tentativas de questões.
