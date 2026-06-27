# 📚 Aprendify | Preparação de Alta Performance para o ENEM

> Ecossistema web completo, moderno e altamente otimizado para a preparação de estudantes rumo ao **ENEM (Exame Nacional do Ensino Médio)**. Desenvolvido para organizar o cronograma de estudos, praticar com questões reais, simular exames oficiais e obter correções de redação automatizadas com inteligência artificial. Disponível em [aprendify.cloud](https://www.aprendify.cloud).

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind--CSS-3.4-38B2AC?logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-1.1-3ECF8E?logo=supabase&logoColor=white)
![Workflow](https://img.shields.io/badge/Workflow-Trunk--Based-2ea44f)
![License](https://img.shields.io/badge/license-Propriet%C3%A1ria-red)

---

## 📖 Propósito

O **Aprendify** foi inteiramente moldado e otimizado para atender à rotina intensa e às necessidades de preparação de quem vai prestar o **ENEM**. Mais do que um organizador acadêmico genérico, a plataforma une planejamento semanal inteligente, inteligência artificial calibrada sob a rubrica oficial de avaliação do exame, simulados dinâmicos com análise diagnóstica, cronômetros de foco (Pomodoro) e contagem regressiva integrada para dar aos estudantes as ferramentas necessárias para conquistarem a nota ideal de forma estruturada.

## 🌟 Funcionalidades Focadas no ENEM

- **Banco de Questões Reais**: Prática e resolução de milhares de questões de edições anteriores do ENEM (2009-2024+), com filtros avançados por ano, disciplina/área do conhecimento, idioma, dificuldade e tópico extraído por IA.
- **Corretor de Redação com IA**: Envio de redações corrigidas instantaneamente por inteligência artificial baseada exatamente nos critérios oficiais e nas **5 competências de avaliação do ENEM**, oferecendo notas detalhadas de 0 a 1000, pontos fortes, pontos fracos e dicas de evolução.
- **Simulados e Estatísticas**: Geração de simulados customizados com relatórios diagnósticos de desempenho, mapeando forças, fraquezas e tópicos que exigem revisão.
- **Timer Pomodoro & Foco**: Widget integrado de cronômetro Pomodoro (Foco, Pausa Curta e Pausa Longa) para organizar sessões concentradas de estudos.
- **Contagem Regressiva Viva**: Contador dinâmico com o progresso do ano e dias restantes até a prova do ENEM.
- **Cronograma e Matérias**: Grade horária de estudos personalizável organizada por código de cores de acordo com as disciplinas do ENEM.
- **Gamificação e Desafios Semanais**: Competição saudável baseada em ranking de pontos (Leaderboard) e progresso diário de acertos de questões (streaks) para incentivar a constância.
- **Segurança e Privacidade**: Controle de acesso a nível de linha (RLS) no Supabase, garantindo isolamento total dos dados de cada estudante.

---

## 📁 Estrutura do Projeto

```
aprendify/
├── public/                       # Assets públicos estáticos
├── src/
│   ├── components/               # Componentes reutilizáveis
│   │   ├── ui/                   # Componentes base shadcn/ui
│   │   ├── schedule/             # Módulo do Cronograma (ScheduleGrid, AddScheduleDialog)
│   │   ├── tasks/                # Módulo de Tarefas (TaskList, AddTaskDialog)
│   │   └── subjects/             # Módulo de Matérias (SubjectsList, AddSubjectDialog)
│   ├── pages/                    # Páginas principais da aplicação
│   │   ├── Auth.tsx              # Página de Login e Cadastro
│   │   ├── Dashboard.tsx         # Dashboard central consolidado
│   │   ├── Schedule.tsx          # Tela de visualização de cronogramas
│   │   ├── Tasks.tsx             # Gerenciamento de tarefas acadêmicas
│   │   ├── Subjects.tsx          # Organização de matérias
│   │   └── NotFound.tsx          # Página 404 customizada
│   ├── integrations/
│   │   └── supabase/             # Cliente do Supabase e tipagens auto-geradas
│   ├── App.tsx                   # Roteador e setup base da aplicação
│   └── index.css                 # Design System, variáveis CSS e resets
├── supabase/                     # Configurações do Supabase (migrações, schemas)
├── package.json                  # Dependências e scripts do Node.js
├── tsconfig.json                 # Configuração do TypeScript
├── vite.config.ts                # Configurações do Vite
└── README.md                     # Esta documentação oficial
```

---

## 🏷️ Stack Tecnológica

### Core & Framework
| Tecnologia | Versão | Propósito |
|---|---|---|
| React | 18.x | Biblioteca principal de interfaces reativas |
| TypeScript | 5.x | Tipagem estática e segurança em tempo de desenvolvimento |
| Vite | 5.x | Tooling rápido de build e desenvolvimento local |
| Tailwind CSS | 3.x | Framework utilitário de estilização responsiva |
| `@supabase/supabase-js` | latest | Comunicação client-side com o banco de dados e Auth |
| `framer-motion` | latest | Animações e transições fluidas de elementos |
| `lucide-react` | latest | Conjunto de ícones vetoriais modernos |

### Banco de Dados & Infraestrutura
| Componente | Descrição |
|---|---|
| PostgreSQL | Banco de dados relacional fornecido pelo Supabase |
| Supabase Auth | Gerenciamento de sessões JWT e autenticação de usuários |
| RLS (Row Level Security) | Regras de acesso a nível de registro nas tabelas do banco de dados |
| Database Triggers | Automação de criação de perfis de usuário e timestamps `updated_at` |

---

## 🚀 Instalação e Execução

### Pré-requisitos
- Node.js **18.x** ou superior
- Gerenciador de pacotes `npm` ou `bun`
- Supabase CLI (opcional, para desenvolvimento local do banco)

### Setup Local

```bash
# 1. Clonar o repositório
git clone https://github.com/felipevenas/aprendify.git
cd aprendify

# 2. Instalar as dependências do projeto
npm install

# 3. Configurar variáveis de ambiente
# Copie o arquivo .env de exemplo se disponível e preencha as credenciais do Supabase:
# VITE_SUPABASE_URL=sua_url_aqui
# VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_aqui

# 4. Rodar o servidor de desenvolvimento local
npm run dev
```
O servidor será aberto em `http://localhost:8080` (ou porta configurada pelo Vite).

---

## 🤝 Contribuição — fluxo Trunk-Based

Este projeto adota o modelo de **Trunk-Based Development**. Feature branches devem ser curtas e mescladas na branch `main` após aprovação em Pull Request.

### Convenções de Commit
| Prefixo | Uso | SemVer |
|---|---|---|
| `feat:` | Nova funcionalidade | MINOR |
| `fix:` | Correção de bug | PATCH |
| `chore:` | Ajuste de build, dependências ou configurações | - |
| `docs:` | Atualizações na documentação | - |
| `style:` | Ajustes visuais de CSS, layout ou formatação | - |
| `refactor:` | Refatoração interna de código | - |

---

## 📄 Licença

Software proprietário — todos os direitos reservados.
**&copy; 2026 Aprendify**
