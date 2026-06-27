# Performance Expert Memory - Aprendify

Este arquivo registra a auditoria e as decisões tomadas em relação ao cache e carregamento da plataforma Aprendify.

## Métricas e Descobertas Iniciais
- **Code Splitting**: Rotas principais e de administração já utilizam `React.lazy` (importação dinâmica), o que garante FCP reduzido na Landing/Auth.
- **Redundância de Rede (IndexedDB Preloader)**:
  - O hook `useBackgroundPreloader` realiza dezenas de requisições GET para a API de `api.enem.dev` 5 segundos após a carga do painel de controle do usuário, preenchendo o cache IndexedDB.
  - No entanto, a aplicação migrou para uso exclusivo do Supabase (`enem_questions`) em todas as rotas (incluindo `Questions.tsx`). O cache do IndexedDB está totalmente órfão e sem uso.
  - A desativação do preloader economizará banda de rede do cliente móvel e processamento de CPU em segundo plano.
- **React Query staleTime**:
  - O `QueryClient` não possui opções de `staleTime` configuradas (padrão é `0`).
  - Isto faz com que qualquer navegação ou foco de aba realize refetch imediato do Supabase, sobrecarregando o banco e causando renderizações adicionais no cliente.

## Estratégia de Cache e Otimização
1. **Desativação de Preloader de Rede**: Tornar `useBackgroundPreloader()` um hook vazio ("no-op") para evitar conexões obsoletas ao `api.enem.dev`.
2. **React Query Global Cache**: Configurar `staleTime` para 5 minutos e desativar `refetchOnWindowFocus` para poupar requisições ao Supabase.
