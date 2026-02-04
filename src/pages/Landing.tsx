import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Brain, 
  Trophy, 
  Target, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Users,
  BarChart3,
  Clock,
  Star,
  Zap,
  Shield,
  GraduationCap
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Landing = () => {
  const features = [
    {
      icon: BookOpen,
      title: "2.700+ Questões ENEM",
      description: "Banco completo de questões oficiais de 2009 a 2025, organizadas por disciplina e dificuldade."
    },
    {
      icon: Brain,
      title: "IA Explicativa",
      description: "Explicações detalhadas geradas por inteligência artificial para cada questão."
    },
    {
      icon: Trophy,
      title: "Gamificação",
      description: "Desafios semanais, ranking e conquistas para manter você motivado."
    },
    {
      icon: Target,
      title: "Simulados Completos",
      description: "Simule o dia da prova com cronômetro e cálculo de nota TRI."
    },
    {
      icon: Sparkles,
      title: "Plano de Estudos IA",
      description: "Recomendações personalizadas baseadas no seu desempenho."
    },
    {
      icon: BarChart3,
      title: "Estatísticas Detalhadas",
      description: "Acompanhe sua evolução com gráficos e métricas precisas."
    }
  ];

  const plans = [
    {
      name: "Gratuito",
      price: "R$ 0",
      period: "",
      description: "Para começar a estudar",
      features: [
        "10 questões por dia",
        "3 matérias customizáveis",
        "Histórico de 7 dias",
        "1 redação por mês"
      ],
      cta: "Começar Grátis",
      popular: false
    },
    {
      name: "Premium Mensal",
      price: "R$ 19,90",
      period: "/mês",
      description: "Acesso completo à plataforma",
      features: [
        "Questões ilimitadas",
        "Matérias ilimitadas",
        "Histórico completo",
        "12 redações por mês",
        "Explicações por IA",
        "Simulados com TRI",
        "Estatísticas avançadas",
        "Suporte prioritário"
      ],
      cta: "Assinar Agora",
      popular: true
    },
    {
      name: "Premium Anual",
      price: "R$ 15,92",
      period: "/mês",
      description: "Economize 20% no plano anual",
      originalPrice: "R$ 238,80",
      finalPrice: "R$ 191,04/ano",
      features: [
        "Tudo do plano mensal",
        "Economia de R$ 47,76/ano",
        "Acesso garantido por 12 meses",
        "Atualizações incluídas"
      ],
      cta: "Assinar Anual",
      popular: false
    }
  ];

  const stats = [
    { value: "2.700+", label: "Questões ENEM" },
    { value: "2009-2025", label: "Provas Oficiais" },
    { value: "98%", label: "Satisfação" },
    { value: "24/7", label: "Disponível" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/0056438c-afde-473e-9a53-b79e41424fcc.png" alt="Aprendify" className="h-8 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Criar Conta</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-4xl mx-auto"
        >
          <Badge className="mb-4 px-4 py-1.5 text-sm" variant="secondary">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Preparação completa para o ENEM 2025
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Sua aprovação no ENEM 
            <span className="text-primary"> começa aqui</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Plataforma completa com questões oficiais, simulados com TRI, 
            correção de redação por IA e plano de estudos personalizado.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="xl" asChild>
              <Link to="/auth">
                Começar Gratuitamente
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="xl" variant="outline" asChild>
              <a href="#planos">Ver Planos</a>
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto"
        >
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/50 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que você precisa para ser aprovado
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ferramentas poderosas desenvolvidas para maximizar seu aprendizado
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="container mx-auto px-4 py-16 md:py-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Planos que cabem no seu bolso
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Escolha o plano ideal para sua jornada de estudos
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className={`h-full relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4">
                      <Star className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  {plan.finalPrice && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="line-through">{plan.originalPrice}</span>
                      {" → "}
                      <span className="text-primary font-medium">{plan.finalPrice}</span>
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                    asChild
                  >
                    <Link to="/auth">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust Section */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-center md:text-left">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">Garantia de 7 dias</p>
                <p className="text-sm text-muted-foreground">Devolução integral</p>
              </div>
            </div>
            <div className="h-12 w-px bg-border hidden md:block" />
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">Cancele quando quiser</p>
                <p className="text-sm text-muted-foreground">Sem multas ou taxas</p>
              </div>
            </div>
            <div className="h-12 w-px bg-border hidden md:block" />
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">Suporte humanizado</p>
                <p className="text-sm text-muted-foreground">Resposta em até 24h</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-primary rounded-2xl p-8 md:p-12 text-center text-primary-foreground"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Comece sua jornada agora
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Junte-se a milhares de estudantes que já estão se preparando para o ENEM com o Aprendify.
          </p>
          <Button size="xl" variant="secondary" asChild>
            <Link to="/auth">
              Criar Conta Gratuita
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/lovable-uploads/0056438c-afde-473e-9a53-b79e41424fcc.png" alt="Aprendify" className="h-6 w-auto" />
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Aprendify. Todos os direitos reservados.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/auth" className="hover:text-foreground transition-colors">Entrar</Link>
              <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
              <Link to="/feedback" className="hover:text-foreground transition-colors">Contato</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
