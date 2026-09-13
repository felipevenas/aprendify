import { ArrowLeft, BookOpen, Mail, Scale, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const LAST_UPDATED = "13 de setembro de 2026";
const PRIVACY_CONTACT = "contato@aprendify.com";

type Section = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

const privacySections: Section[] = [
  {
    title: "1. Quem somos",
    paragraphs: [
      "A Aprendify é uma plataforma digital de apoio aos estudos, com recursos de questões, redações, flashcards, planejamento e acompanhamento de desempenho. Esta Política explica como tratamos dados pessoais quando você utiliza a solução.",
    ],
  },
  {
    title: "2. Dados que podemos coletar",
    bullets: [
      "Dados de cadastro: nome, e-mail, nome de usuário, telefone e data de nascimento, quando informados.",
      "Dados de autenticação: informações necessárias para login por e-mail, senha ou provedores de terceiros, como o Google.",
      "Dados de uso e desempenho: respostas, redações, anotações, flashcards, preferências, metas e histórico de estudos.",
      "Dados técnicos: endereço IP, navegador, dispositivo, sistema operacional, registros de acesso e informações de segurança.",
      "Dados de pagamento: informações necessárias para confirmar a assinatura. Dados completos de cartão são processados pelos provedores de pagamento e não ficam armazenados pela Aprendify.",
    ],
  },
  {
    title: "3. Para que usamos os dados",
    paragraphs: ["Usamos os dados para:"],
    bullets: [
      "criar e proteger sua conta e autenticar seu acesso.",
      "fornecer, personalizar e melhorar as funcionalidades de estudo.",
      "processar assinaturas, pagamentos, reembolsos e suporte.",
      "enviar comunicações operacionais e, quando permitido, comunicações sobre a solução.",
      "prevenir fraude, abusos e incidentes de segurança.",
      "cumprir obrigações legais e exercer direitos em processos administrativos ou judiciais.",
    ],
  },
  {
    title: "4. Bases legais",
    paragraphs: [
      "O tratamento pode se basear na execução do contrato ou de procedimentos preliminares, no cumprimento de obrigação legal, no exercício regular de direitos, no legítimo interesse e no consentimento, conforme a finalidade e a legislação aplicável.",
    ],
  },
  {
    title: "5. Compartilhamento e operadores",
    paragraphs: [
      "Podemos compartilhar o mínimo necessário com fornecedores que apoiam hospedagem, autenticação, pagamentos, envio de e-mails, segurança e funcionamento da plataforma. Esses fornecedores devem tratar os dados conforme instruções e medidas de proteção aplicáveis.",
      "Também poderemos compartilhar dados quando necessário para cumprir lei, ordem de autoridade competente, prevenir fraude ou proteger direitos da Aprendify, dos usuários e de terceiros.",
    ],
  },
  {
    title: "6. Transferências internacionais",
    paragraphs: [
      "Alguns fornecedores de tecnologia podem processar dados fora do Brasil. Nesses casos, adotamos as medidas e garantias exigidas pela legislação aplicável para proteger os dados pessoais.",
    ],
  },
  {
    title: "7. Retenção e segurança",
    paragraphs: [
      "Mantemos os dados pelo período necessário para cumprir as finalidades descritas, manter a conta, atender obrigações legais e resolver disputas. Aplicamos controles técnicos e organizacionais compatíveis com os riscos, mas nenhum serviço conectado à internet é totalmente livre de incidentes.",
    ],
  },
  {
    title: "8. Cookies e tecnologias semelhantes",
    paragraphs: [
      "Usamos armazenamento local, cookies e tecnologias semelhantes para manter a sessão, lembrar preferências, proteger a conta e entender o uso da plataforma. Você pode controlar cookies no navegador, mas algumas funções podem deixar de funcionar corretamente.",
    ],
  },
  {
    title: "9. Direitos do titular",
    paragraphs: [
      "Nos limites da LGPD e de outras normas aplicáveis, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamentos e revogação do consentimento, quando aplicável.",
      "Para exercer seus direitos, escreva para o canal indicado ao final desta Política. Podemos solicitar informações adicionais para confirmar a identidade e proteger a conta.",
    ],
  },
  {
    title: "10. Crianças e adolescentes",
    paragraphs: [
      "A solução não deve ser utilizada sem a participação e a supervisão dos responsáveis quando isso for exigido pela legislação. Se identificarmos tratamento inadequado de dados de criança ou adolescente, adotaremos as providências cabíveis.",
    ],
  },
  {
    title: "11. Alterações",
    paragraphs: [
      "Podemos atualizar esta Política para refletir mudanças legais, técnicas ou na solução. A versão vigente ficará disponível nesta página, com a data de atualização indicada no início.",
    ],
  },
  {
    title: "12. Contato",
    paragraphs: [
      `Para dúvidas, solicitações ou exercício de direitos relacionados à privacidade, entre em contato pelo e-mail ${PRIVACY_CONTACT}.`,
    ],
  },
];

const termsSections: Section[] = [
  {
    title: "1. Aceitação",
    paragraphs: [
      "Ao criar uma conta ou utilizar a Aprendify, você declara que leu e concorda com estes Termos de Serviço e com a Política de Privacidade. Se não concordar, não utilize a solução.",
    ],
  },
  {
    title: "2. Sobre a solução",
    paragraphs: [
      "A Aprendify oferece ferramentas digitais para organização, prática e acompanhamento de estudos. A plataforma é um recurso educacional e não garante aprovação em exames, notas específicas ou resultados determinados.",
    ],
  },
  {
    title: "3. Conta e segurança",
    bullets: [
      "Forneça informações verdadeiras, atualizadas e que você tenha autorização para utilizar.",
      "Mantenha sua senha e os meios de acesso em sigilo e avise a Aprendify ao suspeitar de uso indevido.",
      "Você é responsável pelas atividades realizadas na sua conta, salvo quando houver falha comprovada da Aprendify.",
      "Não crie contas para burlar limites, restrições, cobranças ou mecanismos de segurança.",
    ],
  },
  {
    title: "4. Uso permitido",
    paragraphs: ["Você pode utilizar a solução para fins pessoais e educacionais, respeitando a lei e estes Termos. É proibido:"],
    bullets: [
      "fraudar, explorar vulnerabilidades ou tentar obter acesso não autorizado.",
      "copiar, revender, redistribuir ou explorar comercialmente a plataforma sem autorização.",
      "enviar código malicioso, spam, conteúdo ilegal ou material que viole direitos de terceiros.",
      "usar automação abusiva, scraping ou qualquer método que prejudique a disponibilidade do serviço.",
    ],
  },
  {
    title: "5. Conteúdo do usuário",
    paragraphs: [
      "Você mantém os direitos sobre conteúdos que criar e enviar, como redações, respostas e anotações. Ao enviar conteúdo, autoriza a Aprendify a armazená-lo e processá-lo apenas na medida necessária para operar, proteger e melhorar a solução, respeitando a Política de Privacidade.",
      "Você declara que possui os direitos necessários sobre o conteúdo enviado e que ele não viola lei, direitos autorais, privacidade ou direitos de terceiros.",
    ],
  },
  {
    title: "6. Conteúdo da Aprendify",
    paragraphs: [
      "A marca, o software, o layout, os textos, os bancos de questões, os materiais e demais elementos disponibilizados pela Aprendify são protegidos pela legislação aplicável. O acesso não transfere a você direitos de propriedade intelectual sobre esses elementos.",
    ],
  },
  {
    title: "7. Assinaturas e pagamentos",
    bullets: [
      "Os recursos, valores, periodicidade e condições de cada plano são apresentados no momento da contratação.",
      "A cobrança é realizada por provedor de pagamento parceiro, conforme as condições informadas no checkout.",
      "Cancelamentos, reembolsos e garantias observarão a oferta contratada e a legislação aplicável, inclusive o Código de Defesa do Consumidor quando aplicável.",
      "Podemos suspender recursos pagos em caso de falha de pagamento, estorno ou uso irregular, respeitando os direitos do consumidor.",
    ],
  },
  {
    title: "8. Inteligência artificial",
    paragraphs: [
      "Algumas funcionalidades utilizam inteligência artificial para gerar explicações, sugestões, correções e análises. Esses resultados são auxiliares, podem conter imprecisões e não substituem a avaliação de um professor ou profissional qualificado. Não use a plataforma como única fonte para decisões de alto impacto.",
    ],
  },
  {
    title: "9. Disponibilidade e alterações",
    paragraphs: [
      "Buscamos manter a solução disponível e segura, mas podemos realizar manutenções, corrigir falhas, alterar funcionalidades ou descontinuar recursos. Quando possível, comunicaremos mudanças relevantes com antecedência razoável.",
    ],
  },
  {
    title: "10. Suspensão e encerramento",
    paragraphs: [
      "Podemos limitar ou encerrar o acesso quando houver violação destes Termos, risco à segurança, fraude, obrigação legal ou inadimplência. Você pode encerrar sua conta pelos canais disponíveis na plataforma, sem prejuízo de obrigações já constituídas.",
    ],
  },
  {
    title: "11. Limitação de responsabilidade",
    paragraphs: [
      "Na extensão permitida pela legislação, a Aprendify não responde por indisponibilidade causada por terceiros, falhas de internet, uso inadequado da conta ou decisões tomadas exclusivamente com base em conteúdo educacional ou gerado por inteligência artificial. Nada nestes Termos exclui direitos que não possam ser afastados por lei.",
    ],
  },
  {
    title: "12. Lei aplicável e contato",
    paragraphs: [
      "Estes Termos são interpretados conforme as leis brasileiras. Dúvidas sobre a solução podem ser encaminhadas para o canal de suporte informado na plataforma ou para o e-mail de contato indicado na Política de Privacidade.",
    ],
  },
];

function SectionContent({ section }: { section: Section }) {
  return (
    <section className="space-y-3" aria-labelledby={section.title}>
      <h2 id={section.title} className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {section.title}
      </h2>
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="text-base leading-7 text-muted-foreground">
          {paragraph}
        </p>
      ))}
      {section.bullets && (
        <ul className="list-disc space-y-2 pl-6 text-base leading-7 text-muted-foreground">
          {section.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function LegalPage() {
  const { pathname } = useLocation();
  const isPrivacy = pathname === "/politica-de-privacidade";
  const title = isPrivacy ? "Política de Privacidade" : "Termos de Serviço";
  const description = isPrivacy
    ? "Entenda como a Aprendify coleta, utiliza e protege seus dados pessoais."
    : "As regras para usar a Aprendify com segurança e transparência.";
  const sections = isPrivacy ? privacySections : termsSections;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/auth" className="flex items-center gap-2 text-primary" aria-label="Voltar para o login">
            <BookOpen className="h-7 w-7" aria-hidden="true" />
            <span className="text-xl font-bold">Aprendify</span>
          </Link>
          <Link to="/auth" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para o login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-10 border-b border-border/60 pb-8">
          <div className="mb-4 flex items-center gap-3 text-primary">
            {isPrivacy ? <ShieldCheck className="h-7 w-7" aria-hidden="true" /> : <Scale className="h-7 w-7" aria-hidden="true" />}
            <span className="text-sm font-semibold uppercase tracking-[0.18em]">Aprendify</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p>
          <p className="mt-4 text-sm text-muted-foreground">Última atualização: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10">
          {sections.map((section) => <SectionContent key={section.title} section={section} />)}
        </div>

        <aside className="mt-12 rounded-lg border border-primary/20 bg-primary/5 p-5" aria-label="Canal de contato">
          <div className="flex gap-3">
            <Mail className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-foreground">Precisa falar conosco?</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Para dúvidas sobre estes documentos ou solicitações relacionadas aos seus dados, escreva para {PRIVACY_CONTACT}.
              </p>
            </div>
          </div>
        </aside>
      </main>

      <footer className="border-t border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Aprendify. Todos os direitos reservados.</p>
        <div className="mt-3 flex justify-center gap-4">
          <Link className="hover:text-foreground" to="/politica-de-privacidade">Política de Privacidade</Link>
          <Link className="hover:text-foreground" to="/termos-de-servico">Termos de Serviço</Link>
        </div>
      </footer>
    </div>
  );
}
