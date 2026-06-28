# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [0.3.0] - 28-06-2026

### Alterações

#### 🚀 Adicionado
- **Tour de Tooltips Dinâmico por Tela**: Criado um sistema de ajuda contextualizado que se adapta à página ativa do usuário. Os tooltips são carregados sob demanda com base na rota ativa utilizando o hook `useLocation` em `HelpTooltipsContext.tsx`.
- **Identificação de Elementos de Destaque**: Adicionados atributos de tour (`data-tour`) cirurgicamente nas páginas `Schedule.tsx`, `Questions.tsx`, `Tasks.tsx`, `Notes.tsx`, `Statistics.tsx`, `Simulados.tsx`, `Flashcards.tsx` e `Essays.tsx` para guiar os balões interativos.

#### 🔧 Modificado
- **Responsividade em Desktops e Monitores Grandes (27")**: Ajustado o posicionamento do contêiner de estudos principal (`main`) no `index.css` para centralizar-se na área útil restante da tela ao lado da sidebar fixa, e alinhada a topbar em `Navbar.tsx` para uma apresentação premium.
- **Ocultação Inteligente do Botão de Ajuda**: Atualizado o componente `HelpButton.tsx` para se ocultar automaticamente em páginas que não possuem tours cadastrados (ex: Configurações, Assinaturas), evitando interações vazias do usuário.
- **Remoção de Simulados da Sidebar**: Ocultado temporariamente o link da seção "Simulados" do menu de navegação lateral fixa e mobile em `Navbar.tsx` para ajustes posteriores.
- **Responsividade e Layout do Painel do Criador**: Adicionada a classe `.app-layout-container` no contêiner raiz de `CreatorDashboard.tsx` para corrigir a quebra de layout sob a sidebar fixa no desktop.
- **Melhorias de Margens e Layout**: Ajustado o padding do `main` em `CreatorDashboard.tsx` para `py-6 lg:py-10` e adicionado distanciamento (`mb-6`) entre os cards de gráficos e tabelas para um visual mais limpo e equilibrado.
- **Carregamento Padrão no Painel do Criador**: Integrado o componente unificado `<PageLoader>` no lugar da tela de carregamento ad-hoc anterior em `CreatorDashboard.tsx`.
- **Remoção de Notificação Toast no Banco de Questões**: Retirada a notificação toast repetitiva de "Resposta registrada!" ao enviar alternativas resolvidas em `Questions.tsx`.
- **Preços dos Planos de Assinatura e Price IDs**: Atualizados os valores dos planos de assinatura em `PremiumModal.tsx` e `Landing.tsx` para refletir o plano Mensal por **R$ 9,90/mês** e o plano Anual por **R$ 95,04/ano** (equivalente a R$ 7,92/mês com 20% de desconto). Novos IDs de preços gerados via Stripe API (`price_1TnQt8BbpjcYJ0FGlA6eJbV6` e `price_1TnQtEBbpjcYJ0FGZ2GQbLKC`) integrados ao checkout.

#### 🐛 Corrigido
- **Bypass do Limite de 10 Questões Diárias**: Corrigida a falha em `Questions.tsx` que burlava a barreira gratuita permitindo que usuários sem assinatura premium recarregassem ou alternassem a página para obter novas questões. O `useEffect` de montagem agora bloqueia as requisições se o limite do usuário gratuito for ultrapassado.
- **Redirecionamento Incorreto de Ver Planos**: Consertado o botão "Ver planos disponíveis" em `Subscription.tsx` que redirecionava o usuário erroneamente de volta ao Dashboard. Agora ele exibe instantaneamente o `PremiumModal` com as opções do Stripe sobre a própria tela de assinaturas.

## [0.2.0] - 27-06-2026

### Alterações

#### 🚀 Adicionado
- **Gamificação e Desafios Semanais**: Adicionadas tabelas e sistema de conquistas, leaderboard e progressos de desafios semanais no Supabase.
- **Painel Geral Focado no ENEM**: Criado o novo dashboard central (`Dashboard.tsx`) com widgets utilitários para o ENEM (Pomodoro integrado com Web Audio, Contagem Regressiva viva e painéis analíticos/motivacionais de desempenho por áreas do conhecimento).
- **Layout de Sidebar Clássica**: Adicionado componente de Sidebar fixa no desktop na lateral esquerda contendo links organizados por categorias e rodapé com perfil do usuário.
- **Preservação de Layout Anterior**: Cópia do dashboard antigo em `DashboardOld.tsx` para backup histórico (dead code).
- **Agentes de IA**: Criados arquivos de configuração de agentes na pasta `.agents/` para UI/UX, Supabase, React, QA, Git, Performance e Segurança adaptados ao Antigravity.
- **Padrão de Pull Request**: Criado o template de Pull Request em `.github/pull_request_template.md`.
- **Governança do Repositório**: Adicionados arquivos de governança para o repositório, incluindo `LICENSE` (licença proprietária), `CONTRIBUTING.md` (diretrizes para Trunk-Based Development) e `SECURITY.md` (política de reporte de vulnerabilidades).
- **Configuração de Formatação**: Criado o arquivo `.editorconfig` na raiz do projeto.
- **Templates de Issues**: Criados templates para relatos de bugs (`bug_report.md`) e sugestões de melhorias (`feature_request.md`) sob a pasta `.github/issue_template/`.

#### 🔧 Modificado
- **Otimização de Performance e Cache**: Configurado `QueryClient` global no `App.tsx` com `staleTime` de 5 minutos, poupando consultas ao Supabase na alternância de abas. Desativado preloader obsoleto de IndexedDB e fila de requisições de rede HTTP ao `api.enem.dev` no `useBackgroundPreloader.ts`.
- **Mitigação de Vulnerabilidades RLS no Supabase**: Criada migração SQL `20260627212400_restrict_gamification_rls.sql` para remover permissões de escrita direta (`FOR ALL`) nas tabelas `leaderboard_stats` e `user_challenge_progress`, protegendo o ranking contra fraudes.
- **Auditoria de Dependências (AppSec)**: Atualizadas 18 dependências com vulnerabilidades críticas/altas via `npm audit fix` (incluindo falhas críticas de injeção em PDFs no `jspdf` e bypass de XSS no `dompurify`).
- **Foco de Posicionamento no ENEM**: Atualizado o `README.md` destacando a plataforma como ecossistema de estudos moldado especificamente para o ENEM, detalhando seus recursos.
- **Responsividade Mobile-First**: Corrigido o esmagamento das colunas da grade semanal no mobile em `WeeklyAgendaView.tsx` através da adição de scroll horizontal sincronizado com largura mínima responsiva de `750px`.
- **Navegação Adaptativa**: Componente `Navbar.tsx` modificado para atuar como Topbar minimalista no desktop (ao lado da Sidebar) e manter o menu hambúrguer compacto no mobile, renderizando os mesmos links.
- **CSS Estrutural**: Ajustadas as margens e paddings no `index.css` usando seletores inteligentes `:has` para adequar de forma responsiva todas as telas autenticadas ao novo design com a Sidebar no desktop.
- **Cabeçalhos e Botões**: Padronizados cabeçalhos com o padrão de Badge de recurso + Ícone, removendo botões de voltar redundantes de todas as páginas principais e administrativas.

## [0.1.0] - 26-06-2026

### Alterações

#### 🚀 Adicionado
- Estrutura inicial do projeto React com Vite, TypeScript, Tailwind CSS e shadcn/ui.
- Integração básica de tabelas no Supabase (`profiles`, `subjects`, `schedule_items`, `tasks`) com políticas de Row Level Security (RLS) habilitadas.
- Roteamento inicial e telas de Auth (Login/Cadastro), Dashboard, Cronograma, Tarefas e Matérias.
- Criado o arquivo `CHANGELOG.md` para rastreamento de alterações.
