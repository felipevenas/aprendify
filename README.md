# 📚 Aprendify | Plataforma de Gerenciamento de Estudos

> Aplicação web moderna, minimalista e altamente responsiva para organizar cronogramas de estudo, tarefas e matérias, integrada com Supabase. Disponível em [aprendify.cloud](https://www.aprendify.cloud).

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind--CSS-3.4-38B2AC?logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-1.1-3ECF8E?logo=supabase&logoColor=white)
![Workflow](https://img.shields.io/badge/Workflow-Trunk--Based-2ea44f)
![License](https://img.shields.io/badge/license-Propriet%C3%A1ria-red)

---

## 📖 Propósito

Facilitar a organização acadêmica de estudantes através de uma interface limpa, intuitiva e rápida. O Aprendify consolida o gerenciamento de cronogramas semanais, controle de tarefas com prazos e prioridades, e classificação de disciplinas com cores personalizadas, sincronizando tudo em tempo real através do Supabase com segurança avançada (RLS).

## 🌟 Funcionalidades

- **Autenticação e Autorização**: Sistema de cadastro e login integrado ao Supabase Auth com criptografia automática, papéis de usuário (Administrador e Usuário Padrão) e proteção de rotas privadas.
- **Cronograma Semanal Dinâmico**: Grade semanal interativa (segunda a sexta) para gerenciar horários de aula e estudo vinculados a disciplinas e organizados por código de cores.
- **Gestão de Tarefas Eficiente**: Lista de afazeres com checkbox de conclusão, prazos de entrega, nível de prioridade (Alta/Média/Baixa) e filtros por status de conclusão.
- **Organização de Disciplinas (Matérias)**: Cadastro de disciplinas com descrição e paleta de cores predefinidas para identificação imediata nas tarefas e cronograma.
- **Visualização Integrada**: Calendário intuitivo que consolida cronogramas e tarefas pendentes em um layout fluido.
- **Políticas de Segurança Rígidas**: Integração de Row Level Security (RLS) no PostgreSQL, garantindo que cada estudante acesse e modifique apenas seus próprios dados.

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
