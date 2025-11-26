# StudyFlow - Plataforma de Gerenciamento de Estudos

Uma aplicação web moderna e minimalista para organizar cronogramas de estudo, tarefas e matérias, construída com React, TypeScript, Tailwind CSS e Lovable Cloud (Supabase).

## 🎯 Funcionalidades

### Autenticação e Autorização
- Sistema completo de cadastro e login
- Autenticação JWT integrada
- Papéis de usuário: **Administrador** e **Usuário Padrão**
- Senhas criptografadas automaticamente pelo Supabase Auth
- Auto-confirmação de email habilitada para desenvolvimento

### Cronograma Semanal
- Visualização de grade semanal (Segunda a Sexta)
- Adicionar, visualizar e remover horários de aula/estudo
- Vincular horários a matérias específicas
- Código de cores por matéria para fácil identificação
- Sincronização em tempo real

### Gestão de Tarefas
- Lista completa de tarefas com checkbox de conclusão
- Campos: título, descrição, data de entrega, prioridade
- Vinculação a matérias
- Filtros por status (completo/pendente)
- Indicadores visuais de prioridade (Alta/Média/Baixa)

### Gestão de Matérias
- Cadastro de disciplinas com nome, descrição e cor
- Paleta de cores predefinidas
- Exclusão de matérias
- Organização visual por cards coloridos

### Calendário
- Visualização integrada de tarefas e cronograma
- Interface limpa e responsiva

## 🎨 Design

### Paleta de Cores
- **Primária**: Azul profundo (#1E40AF / hsl(217, 91%, 35%))
- **Background**: Branco puro
- **Acentos**: Tons de azul claro e gradientes sutis

### Estilo
- Design minimalista e clean
- Tipografia: Inter (importada via Google Fonts)
- Animações suaves com Framer Motion
- Cards com sombras sutis e hover effects
- Layout totalmente responsivo (mobile, tablet, desktop)

## 🏗️ Arquitetura

### Estrutura do Projeto (DDD - Domain-Driven Design)

```
src/
├── components/
│   ├── ui/              # Componentes base do shadcn/ui
│   ├── schedule/        # Domínio: Cronograma
│   │   ├── ScheduleGrid.tsx
│   │   └── AddScheduleDialog.tsx
│   ├── tasks/           # Domínio: Tarefas
│   │   ├── TaskList.tsx
│   │   └── AddTaskDialog.tsx
│   └── subjects/        # Domínio: Matérias
│       ├── SubjectsList.tsx
│       └── AddSubjectDialog.tsx
├── pages/               # Páginas da aplicação
│   ├── Auth.tsx         # Login e Cadastro
│   ├── Dashboard.tsx    # Dashboard principal
│   ├── Schedule.tsx     # Página de cronograma
│   ├── Tasks.tsx        # Página de tarefas
│   ├── Subjects.tsx     # Página de matérias
│   └── NotFound.tsx     # Página 404
├── integrations/
│   └── supabase/        # Cliente e tipos do Supabase (auto-gerado)
├── index.css            # Design system e variáveis CSS
└── App.tsx              # Configuração de rotas
```

### Banco de Dados

#### Tabelas

**profiles**
- `id` (UUID, PK): Referência ao auth.users
- `email` (TEXT): Email do usuário
- `full_name` (TEXT): Nome completo
- `role` (user_role): Papel do usuário (admin/user)
- `created_at`, `updated_at` (TIMESTAMP)

**subjects** (Matérias)
- `id` (UUID, PK)
- `user_id` (UUID, FK → profiles.id)
- `name` (TEXT): Nome da matéria
- `color` (TEXT): Cor hexadecimal
- `description` (TEXT): Descrição opcional
- `created_at`, `updated_at` (TIMESTAMP)

**schedule_items** (Cronograma)
- `id` (UUID, PK)
- `user_id` (UUID, FK → profiles.id)
- `subject_id` (UUID, FK → subjects.id)
- `day_of_week` (INTEGER): 0-6 (Domingo a Sábado)
- `start_time` (TIME): Hora de início
- `end_time` (TIME): Hora de término
- `title` (TEXT): Título do horário
- `notes` (TEXT): Observações opcionais
- `created_at`, `updated_at` (TIMESTAMP)

**tasks** (Tarefas)
- `id` (UUID, PK)
- `user_id` (UUID, FK → profiles.id)
- `subject_id` (UUID, FK → subjects.id)
- `title` (TEXT): Título da tarefa
- `description` (TEXT): Descrição
- `due_date` (DATE): Data de entrega
- `completed` (BOOLEAN): Status de conclusão
- `priority` (TEXT): low/medium/high
- `created_at`, `updated_at` (TIMESTAMP)

#### Row Level Security (RLS)

Todas as tabelas possuem políticas RLS ativadas:

- **Profiles**: Usuários podem ver e editar apenas seu próprio perfil; Admins podem ver todos os perfis
- **Subjects, Tasks, Schedule Items**: Usuários gerenciam apenas seus próprios dados

#### Triggers

- `on_auth_user_created`: Cria perfil automaticamente ao cadastrar usuário
- `update_*_updated_at`: Atualiza timestamp de modificação automaticamente

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js 16+ e npm instalados
- Conta Lovable (para deploy e backend)

### Passo a Passo

1. **Clone o repositório**
```bash
git clone <URL_DO_REPOSITORIO>
cd studyflow
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o Lovable Cloud**

Este projeto utiliza Lovable Cloud, que já está configurado. O backend (Supabase) está provisionado e pronto para uso.

As variáveis de ambiente são gerenciadas automaticamente:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

4. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:8080`

## 🔐 Segurança

### Implementações de Segurança

1. **Criptografia de Senhas**: Gerenciada automaticamente pelo Supabase Auth com bcrypt
2. **Row Level Security (RLS)**: Políticas aplicadas em todas as tabelas
3. **JWT Tokens**: Autenticação baseada em tokens seguros
4. **Validação de Entrada**: Validações client-side e server-side
5. **CORS**: Configurado adequadamente para requisições seguras
6. **Funções SECURITY DEFINER**: Triggers com search_path definido

### Papéis de Usuário

- **Usuário Padrão**: Pode gerenciar apenas seus próprios dados (cronograma, tarefas, matérias)
- **Administrador**: Mesmas permissões do usuário + visualização de todos os perfis

## 🎯 Como Usar

### Primeiro Acesso

1. Acesse a aplicação
2. Clique em "Não tem conta? Cadastre-se"
3. Preencha:
   - Nome completo
   - Email
   - Senha (mínimo 6 caracteres)
   - Tipo de conta (Usuário ou Administrador)
4. Clique em "Criar conta"
5. Faça login com suas credenciais

### Gerenciando Matérias

1. Acesse "Minhas Matérias" no dashboard
2. Clique em "Nova matéria"
3. Preencha nome, descrição e escolha uma cor
4. Salve

### Criando Cronograma

1. Acesse "Cronograma Semanal"
2. Clique em "Adicionar horário"
3. Preencha:
   - Título (ex: "Aula de Matemática")
   - Dia da semana
   - Horário de início e término
   - Matéria (opcional)
   - Observações (opcional)
4. Salve

### Adicionando Tarefas

1. Acesse "Minhas Tarefas"
2. Clique em "Nova tarefa"
3. Preencha:
   - Título
   - Descrição
   - Data de entrega
   - Prioridade
   - Matéria relacionada
4. Salve
5. Marque como concluída clicando no checkbox

## 🛠️ Stack Tecnológica

### Frontend
- **React 18**: Biblioteca UI
- **TypeScript**: Type safety
- **Vite**: Build tool e dev server
- **Tailwind CSS**: Estilização utilitária
- **shadcn/ui**: Componentes UI acessíveis
- **Framer Motion**: Animações suaves
- **React Router**: Navegação
- **date-fns**: Manipulação de datas
- **Lucide Icons**: Ícones modernos

### Backend (Lovable Cloud / Supabase)
- **PostgreSQL**: Banco de dados
- **Supabase Auth**: Autenticação JWT
- **Row Level Security**: Segurança de dados
- **Realtime**: Sincronização em tempo real
- **Edge Functions**: Lógica serverless (se necessário)

### Ferramentas de Desenvolvimento
- **ESLint**: Linting de código
- **TypeScript Compiler**: Verificação de tipos

## 📝 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview

# Lint
npm run lint
```

## 🌐 Deploy

### Lovable Cloud (Recomendado)

1. Faça login em Lovable
2. Clique em "Publish" no canto superior direito
3. Sua aplicação será publicada automaticamente
4. Conecte um domínio customizado nas configurações (plano pago)

### Deploy Manual

Se preferir hospedar em outro lugar:

1. Build da aplicação:
```bash
npm run build
```

2. A pasta `dist/` conterá os arquivos estáticos
3. Configure as variáveis de ambiente do Supabase no seu provedor
4. Faça upload dos arquivos

## 🐛 Troubleshooting

### Erro ao fazer login
- Verifique se o email e senha estão corretos
- Certifique-se de que o Lovable Cloud está ativo

### Dados não aparecem
- Verifique sua conexão com internet
- Abra o console do navegador (F12) para ver erros
- Faça logout e login novamente

### Problemas com RLS
- Os dados são isolados por usuário
- Certifique-se de estar logado
- Administradores podem ver perfis, mas não dados de outros usuários

## 📚 Documentação Adicional

- [Lovable Docs](https://docs.lovable.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto foi criado com Lovable. Todos os direitos reservados.

## ✨ Próximos Passos

- [ ] Adicionar filtros avançados nas tarefas
- [ ] Implementar notificações de prazos
- [ ] Adicionar estatísticas de estudo
- [ ] Exportar cronograma em PDF
- [ ] Modo dark (já estruturado no design system)
- [ ] Integração com Google Calendar
- [ ] App mobile com React Native

---

**Desenvolvido com ❤️ usando Lovable**
