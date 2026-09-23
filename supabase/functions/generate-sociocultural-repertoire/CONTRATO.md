# Contrato de geração de repertório sociocultural

## Chamada

- Edge Function: `generate-sociocultural-repertoire`
- Método: `POST`; requer `Authorization: Bearer <access_token>`.
- Body JSON máximo: 4 KiB.
- Limite atual: 30 solicitações por usuário por hora, conforme o helper compartilhado `authorizeAI`; erros da infraestrutura de rate limit falham fechados.
- A função gera uma sugestão revisável e **não grava** na tabela. A tela deve salvar explicitamente os campos revisados, `user_id` do usuário autenticado e `origin: "ai"`.

```json
{
  "topic": "Desafios para a preservação do patrimônio cultural",
  "focus": "memória urbana",
  "context": "Quero discutir desigualdade no acesso a políticas de preservação."
}
```

`topic` é obrigatório (1–180 caracteres). `focus` (até 180) e `context` (até 800) são opcionais.

## Sucesso

HTTP `200`, com o objeto editável em `repertoire`:

```json
{
  "repertoire": {
    "title": "A cidade e o direito à memória",
    "category": "Cinema brasileiro",
    "summary": "A obra permite discutir a preservação da memória coletiva e seus conflitos.",
    "purpose": "Relacionar apagamento cultural, identidade e políticas de preservação.",
    "application_example": "No debate sobre patrimônio cultural, a narrativa evidencia como a ausência de políticas de preservação pode enfraquecer a memória coletiva.",
    "themes": ["Patrimônio cultural", "Memória coletiva"],
    "niches": ["Políticas de preservação", "Identidade cultural"],
    "source_title": null,
    "source_author": null,
    "source_year": null,
    "source_url": null,
    "origin": "ai"
  }
}
```

O modelo não deve inventar dados bibliográficos. Quando a referência não for conhecida com segurança, deixa `source_*` nulos e declara no resumo ou propósito quais detalhes precisam ser conferidos antes da citação. Os campos retornados devem ser tratados como rascunho editável, não como fatos verificados.

## Erros

Erros usam `{ "error": string, "code": string }`.

| HTTP | code | Situação |
| --- | --- | --- |
| 400 | `INVALID_JSON` / `INVALID_BODY` / `INVALID_INPUT` | JSON ou tema inválido |
| 401 | `UNAUTHENTICATED` | Token ausente ou inválido |
| 405 | `METHOD_NOT_ALLOWED` | Método diferente de POST |
| 413 | `PAYLOAD_TOO_LARGE` | Body acima de 4 KiB |
| 429 | `RATE_LIMITED` | Cota horária excedida; pode incluir `Retry-After` e cabeçalhos `X-RateLimit-*` |
| 502 | `AI_UPSTREAM_ERROR` / `AI_INVALID_RESPONSE` | Groq indisponível ou saída incompatível com o contrato |
| 503 | `AI_UNAVAILABLE` / `RATE_LIMIT_UNAVAILABLE` / `AUTH_UNAVAILABLE` / `AUTHZ_UNAVAILABLE` | Chave ou infraestrutura necessária indisponível |
| 504 | `AI_TIMEOUT` | Tempo limite do provedor |

## Persistência

A tabela `public.repertorios_socioculturais` guarda: `id`, `user_id`, `title`, `category`, `summary`, `purpose`, `application_example`, `themes`, `niches`, `source_title`, `source_author`, `source_year` (string anulável), `source_url`, `origin` (`manual` ou `ai`), `created_at`, `updated_at`. O usuário pode ler/criar/editar/excluir apenas as próprias linhas via RLS. A migração adiciona constraints de conteúdo, índice por owner/data e atualização automática de `updated_at`.

## Migração e recuperação

Aplicar `20260922090000_create_repertorios_socioculturais.sql` é aditivo. Se a migração falhar antes de concluir, corrigir e reaplicar conforme a ferramenta de migração; não foi aplicada remotamente. A reversão técnica exige remover trigger, policies, índice e tabela, mas **exclui permanentemente os repertórios já salvos**. Para rollback após uso, exportar/backup dos dados antes de qualquer remoção; em geral, prefira uma migração corretiva para preservar conteúdo.
