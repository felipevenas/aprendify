# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

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
