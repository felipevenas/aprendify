# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [Não lançado] - 27-06-2026

### Alterações

#### 🚀 Adicionado
- **Agentes de IA**: Criados arquivos de configuração de agentes na pasta `.agents/` para UI/UX, Supabase, React, QA, Git, Performance e Segurança adaptados ao Antigravity.
- **Padrão de Pull Request**: Criado o template de Pull Request em `.github/pull_request_template.md`.
- **Governança do Repositório**: Adicionados arquivos de governança para o repositório, incluindo `LICENSE` (licença proprietária), `CONTRIBUTING.md` (diretrizes para Trunk-Based Development) e `SECURITY.md` (política de reporte de vulnerabilidades).
- **Configuração de Formatação**: Criado o arquivo `.editorconfig` na raiz do projeto.
- **Templates de Issues**: Criados templates para relatos de bugs (`bug_report.md`) e sugestões de melhorias (`feature_request.md`) sob a pasta `.github/issue_template/`.

#### 🔧 Modificado
- **README do Projeto**: README reestruturado para seguir o padrão premium consolidado, renomeando o projeto para **Aprendify**, inserindo o link de produção oficial [aprendify.cloud](https://www.aprendify.cloud) e adicionando tabelas de stack tecnológica e convenções de commits.

## [0.1.0] - 26-06-2026

### Alterações

#### 🚀 Adicionado
- Estrutura inicial do projeto React com Vite, TypeScript, Tailwind CSS e shadcn/ui.
- Integração básica de tabelas no Supabase (`profiles`, `subjects`, `schedule_items`, `tasks`) com políticas de Row Level Security (RLS) habilitadas.
- Roteamento inicial e telas de Auth (Login/Cadastro), Dashboard, Cronograma, Tarefas e Matérias.
- Criado o arquivo `CHANGELOG.md` para rastreamento de alterações.
