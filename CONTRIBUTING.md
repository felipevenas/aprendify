# 🤝 Diretrizes de Contribuição — Aprendify

Obrigado por querer contribuir para o **Aprendify**! Este documento serve para orientar o fluxo de desenvolvimento do projeto, garantindo consistência no histórico, facilidade nas revisões e alta qualidade de código.

---

## 🚀 Fluxo de Trabalho (Trunk-Based Development)

Este projeto segue o modelo de **Trunk-Based Development**. A branch principal estável é a `main`. Feature branches devem ser curtas, focadas e efêmeras.

### Passo a Passo para Contribuições

1.  **Garanta que sua branch local esteja atualizada:**
    Sempre puxe as alterações mais recentes da `main` antes de iniciar:
    ```bash
    git checkout main
    git pull origin main
    ```

2.  **Crie sua branch de trabalho:**
    Use branches curtas e com nomenclaturas semânticas de acordo com o tipo de alteração:
    ```bash
    git checkout -b <tipo>/<nome-curto-da-tarefa>
    # Exemplos:
    # git checkout -b feat/add-notifications
    # git checkout -b fix/auth-token-refresh
    # git checkout -b chore/update-dependencies
    ```

3.  **Desenvolva e valide localmente:**
    Faça as alterações necessárias. Garanta que o projeto esteja compilando e que o linter não reporte erros:
    ```bash
    npm run lint
    npm run build
    ```

4.  **Mantenha sua branch atualizada durante o desenvolvimento:**
    Se outras alterações forem mescladas na `main` enquanto você trabalha, faça o rebase para manter o histórico limpo e linear:
    ```bash
    git fetch origin
    git rebase origin/main
    ```

5.  **Envie suas alterações e abra um Pull Request:**
    Faça o push da sua branch para o repositório remoto:
    ```bash
    git push origin <tipo>/<nome-curto-da-tarefa>
    ```
    Abra um Pull Request no GitHub apontando para a branch `main`. Preencha todos os campos do template de Pull Request fornecido.

---

## 🏷️ Convenções de Commit

Adotamos a especificação de **Conventional Commits** para manter as mensagens do Git legíveis e padronizar o versionamento semântico (SemVer):

| Prefixo | Significado / Uso | Exemplo de Mensagem |
| :--- | :--- | :--- |
| `feat:` | Nova funcionalidade para o usuário final | `feat: adicionar filtro de prioridade na lista de tarefas` |
| `fix:` | Resolução de bug | `fix: corrigir redirecionamento ao expirar sessão JWT` |
| `chore:` | Alterações de build, ferramentas auxiliares ou pacotes | `chore: configurar regras do editorconfig` |
| `docs:` | Mudanças estritas em documentações | `docs: atualizar instruções de setup no README` |
| `style:` | Alterações estéticas de estilo/layout ou formatação | `style: ajustar alinhamento do botão flutuante de WhatsApp` |
| `refactor:` | Alterações no código que não corrigem bugs ou adicionam features | `refactor: extrair lógica de validação para hook personalizado` |

*Nota: Tente manter o título do commit curto (máximo 72 caracteres) e utilize o corpo do commit se precisar detalhar a alteração.*

---

## 🎨 Padrões de Código e Estilo

1.  **TypeScript**: Tipagem estática é obrigatória. Evite o uso do tipo `any` a menos que seja estritamente indispensável e justificado.
2.  **EditorConfig**: O repositório contém um arquivo `.editorconfig` que define regras de espaçamento e recuo. Certifique-se de ter o plugin correspondente ativo no seu editor.
3.  **Linting**: Execute `npm run lint` antes de submeter alterações. Nossos pipelines de CI não aceitarão código com warnings ou erros de linter.
4.  **Row Level Security (RLS)**: Se você criar novas tabelas no banco de dados Supabase, as políticas de RLS devem ser ativadas e configuradas explicitamente para garantir que dados de outros usuários permaneçam inacessíveis.
