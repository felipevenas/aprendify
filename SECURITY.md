# 🛡️ Política de Segurança — Aprendify

Nós levamos a segurança do **Aprendify** muito a sério. Se você descobrir qualquer vulnerabilidade de segurança, agradecemos e incentivamos o reporte responsável.

---

## 📅 Versões Suportadas

Atualmente, apenas a versão mais recente em produção no domínio [aprendify.cloud](https://www.aprendify.cloud) e na branch `main` do repositório oficial recebe atualizações de segurança.

| Versão | Suportada |
| :--- | :--- |
| Versão atual (Produção / main) |  Sim |
| < 0.1.0 | ❌ Não |

---

## 🚨 Como Reportar uma Vulnerabilidade

**Por favor, não abra uma issue pública no GitHub para relatar problemas de segurança.** 

Se você encontrar uma falha de segurança (especialmente relacionada a bypass de autenticação, vazamento de dados via políticas RLS falhas no Supabase ou injeção de scripts/SQL):

1.  Envie um e-mail detalhado para o administrador/desenvolvedor do projeto.
2.  Descreva a vulnerabilidade identificada, os passos exatos para reprodução (Proof of Concept) e o impacto potencial.
3.  Inclua capturas de tela ou logs se achar necessário.

Você deverá receber um retorno inicial confirmando o recebimento da mensagem em até **48 horas**.

---

## 🔄 Nosso Processo de Resposta

1.  **Triagem**: Analisaremos o relatório de forma privada para validar a falha e determinar a gravidade do risco.
2.  **Mitigação**: Desenvolveremos uma correção adequada na branch privada/local correspondente.
3.  **Homologação e Deploy**: A correção será implantada no domínio de produção [aprendify.cloud](https://www.aprendify.cloud) e em seguida mesclada na branch `main` do repositório.
4.  **Divulgação**: Uma menção e agradecimento serão feitos nas notas de versão (Changelog) se o reportador concordar e desejar crédito.
