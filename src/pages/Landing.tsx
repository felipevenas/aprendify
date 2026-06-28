import { useEffect, useRef } from "react";
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
   CreditCard,
   ChevronDown,
   GraduationCap,
   Rocket
} from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Hook to add 'visible' class when elements enter the viewport
 */
function useRevealOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    const targets = el.querySelectorAll(".landing-reveal");
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);
  return ref;
}

const Landing = () => {
  const revealRef = useRevealOnScroll();

  const features = [
    {
      icon: BookOpen,
      title: "2.700+ Questões ENEM",
       description: "Banco completo de questões oficiais de 2009 a 2025, organizadas por disciplina e dificuldade.",
       gradient: "from-blue-500/20 to-cyan-500/20"
    },
    {
      icon: Brain,
      title: "IA Explicativa",
       description: "Explicações detalhadas geradas por inteligência artificial para cada questão.",
       gradient: "from-purple-500/20 to-pink-500/20"
    },
    {
      icon: Trophy,
      title: "Gamificação",
       description: "Desafios semanais, ranking e conquistas para manter você motivado.",
       gradient: "from-amber-500/20 to-orange-500/20"
    },
    {
      icon: Target,
      title: "Simulados Completos",
       description: "Simule o dia da prova com cronômetro e cálculo de nota TRI.",
       gradient: "from-red-500/20 to-rose-500/20"
    },
    {
      icon: Sparkles,
      title: "Plano de Estudos IA",
       description: "Recomendações personalizadas baseadas no seu desempenho.",
       gradient: "from-emerald-500/20 to-teal-500/20"
    },
    {
      icon: BarChart3,
      title: "Estatísticas Detalhadas",
       description: "Acompanhe sua evolução com gráficos e métricas precisas.",
       gradient: "from-indigo-500/20 to-violet-500/20"
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
      price: "R$ 9,90",
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
      price: "R$ 7,92",
      period: "/mês",
      description: "Economize 20% no plano anual",
      originalPrice: "R$ 118,80",
      finalPrice: "R$ 95,04/ano",
      features: [
        "Tudo do plano mensal",
        "Economia de R$ 23,76/ano",
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
     <div className="min-h-screen bg-background overflow-x-hidden" ref={revealRef}>
       {/* Animated background */}
       <div className="fixed inset-0 pointer-events-none">
         <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
         <div className="absolute top-0 left-1/4 w-72 h-72 md:w-96 md:h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
         <div className="absolute bottom-1/4 right-1/4 w-64 h-64 md:w-80 md:h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
       </div>
      
      {/* Header */}
       <header className="border-b border-border/30 bg-background/70 backdrop-blur-2xl sticky top-0 z-50 landing-animate-header">
         <div className="container mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
           <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group">
             <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/30 group-hover:scale-105 transition-all duration-300">
               <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground drop-shadow-sm" />
            </div>
             <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
              Aprendify
            </span>
           </Link>
          <div className="flex items-center gap-2 sm:gap-3">
             <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex hover:bg-primary/10 transition-colors">
              <Link to="/auth">Entrar</Link>
            </Button>
             <Button asChild size="sm" className="shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300">
              <Link to="/auth">Criar Conta</Link>
            </Button>
          </div>
        </div>
       </header>

      {/* Hero Section */}
       <section className="container mx-auto px-4 pt-8 pb-12 sm:pt-12 sm:pb-16 md:py-20 lg:py-24 relative">
         <div className="text-center max-w-4xl mx-auto relative z-10">
           <div className="landing-animate-up landing-animate-up-delay-1">
             <Badge className="mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors cursor-default">
               <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1.5" />
               Preparação completa para o ENEM 2025
             </Badge>
           </div>
           
           <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 sm:mb-6 leading-tight landing-animate-up landing-animate-up-delay-2">
             Sua aprovação no ENEM{" "}
             <span className="relative">
               <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                 começa aqui
               </span>
               <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/50 rounded-full landing-animate-underline" />
             </span>
           </h1>
           
           <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-2 landing-animate-up landing-animate-up-delay-3">
             Plataforma completa com questões oficiais, simulados com TRI, 
             correção de redação por IA e plano de estudos personalizado.
           </p>
           
           <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0 landing-animate-up landing-animate-up-delay-4">
             <Button size="lg" asChild className="shadow-xl shadow-primary/25 hover:shadow-primary/35 hover:-translate-y-1 transition-all duration-300 text-base">
               <Link to="/auth">
                 <Rocket className="mr-2 h-4 w-4" />
                 Começar Gratuitamente
               </Link>
             </Button>
             <Button size="lg" variant="outline" asChild className="border-2 hover:bg-primary/5 transition-all duration-300">
               <a href="#planos">
                 Ver Planos
                 <ChevronDown className="ml-2 h-4 w-4" />
               </a>
             </Button>
           </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mt-10 sm:mt-12 md:mt-16 max-w-3xl mx-auto landing-animate-up landing-animate-up-delay-5">
          {stats.map((stat, index) => (
            <div 
              key={index} 
               className="text-center p-3 sm:p-4 md:p-5 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 hover:border-primary/40 hover:bg-card/80 hover:scale-[1.03] hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 group"
            >
               <div className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-br from-primary via-primary to-primary/60 bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary transition-all">
                 {stat.value}
               </div>
               <div className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
       <section className="bg-gradient-to-b from-muted/30 via-muted/50 to-muted/30 py-12 sm:py-16 md:py-20 lg:py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-8 sm:mb-10 md:mb-12 landing-reveal">
             <Badge className="mb-4 px-3 sm:px-4 py-1.5 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Recursos
            </Badge>
             <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Tudo que você precisa para ser aprovado
            </h2>
             <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              Ferramentas poderosas desenvolvidas para maximizar seu aprendizado
            </p>
          </div>

           <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="landing-reveal hover:-translate-y-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                style={{ transitionDelay: `${index * 0.1}s` }}
              >
                 <Card className="h-full hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/40 transition-all duration-300 group overflow-hidden relative">
                   <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                   <CardHeader className="relative">
                     <div className={`h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                     <CardTitle className="text-lg sm:text-xl group-hover:text-primary transition-colors">{feature.title}</CardTitle>
                  </CardHeader>
                   <CardContent className="relative">
                     <CardDescription className="text-sm sm:text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
       <section id="planos" className="container mx-auto px-4 py-12 sm:py-16 md:py-20 lg:py-24 relative">
        <div className="text-center mb-8 sm:mb-10 md:mb-12 landing-reveal">
           <Badge className="mb-4 px-3 sm:px-4 py-1.5 bg-primary/10 text-primary border-primary/20">
            <CreditCard className="h-3.5 w-3.5 mr-1.5" />
            Planos
          </Badge>
           <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            Planos que cabem no seu bolso
          </h2>
           <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            Escolha o plano ideal para sua jornada de estudos
          </p>
        </div>

         <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`landing-reveal hover:-translate-y-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ${plan.popular ? 'sm:col-span-2 lg:col-span-1 lg:-mt-4 lg:mb-4 order-first lg:order-none' : ''}`}
              style={{ transitionDelay: `${index * 0.1}s` }}
            >
               <Card className={`h-full relative transition-all duration-300 overflow-hidden ${plan.popular ? 'border-primary border-2 shadow-2xl shadow-primary/20 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent' : 'hover:border-primary/30 hover:shadow-xl'}`}>
                 {plan.popular && (
                   <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary" />
                 )}
                {plan.popular && (
                   <div className="absolute -top-0.5 left-1/2 -translate-x-1/2">
                     <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-3 sm:px-4 shadow-lg rounded-t-none rounded-b-lg text-xs sm:text-sm">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Mais Popular
                    </Badge>
                  </div>
                )}
                 <CardHeader className={`text-center pb-2 ${plan.popular ? 'pt-8 sm:pt-10' : ''}`}>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                   <CardDescription className="text-sm">{plan.description}</CardDescription>
                  <div className="mt-4">
                     <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  {plan.finalPrice && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="line-through">{plan.originalPrice}</span>
                      {" → "}
                      <span className="text-primary font-semibold">{plan.finalPrice}</span>
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                       <li 
                         key={featureIndex} 
                         className="flex items-start gap-2"
                       >
                         <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0 mt-0.5" />
                         <span className="text-xs sm:text-sm">{feature}</span>
                       </li>
                    ))}
                  </ul>
                  <Button 
                     className={`w-full transition-all duration-300 ${plan.popular ? 'shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30' : ''}`}
                    variant={plan.popular ? "default" : "outline"}
                     size="default"
                    asChild
                  >
                    <Link to="/auth">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Section */}
       <section className="bg-gradient-to-b from-muted/50 to-muted/30 py-10 sm:py-12 md:py-16">
        <div className="container mx-auto px-4">
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-3xl mx-auto landing-reveal">
             <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left p-4 rounded-xl hover:bg-card/50 transition-colors">
               <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                 <Shield className="h-6 w-6 text-primary" />
               </div>
              <div>
                 <p className="font-semibold text-sm sm:text-base">Garantia de 7 dias</p>
                <p className="text-sm text-muted-foreground">Devolução integral</p>
              </div>
            </div>
             <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left p-4 rounded-xl hover:bg-card/50 transition-colors">
               <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                 <Clock className="h-6 w-6 text-primary" />
               </div>
              <div>
                 <p className="font-semibold text-sm sm:text-base">Cancele quando quiser</p>
                <p className="text-sm text-muted-foreground">Sem multas ou taxas</p>
              </div>
            </div>
             <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left p-4 rounded-xl hover:bg-card/50 transition-colors">
               <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                 <Users className="h-6 w-6 text-primary" />
               </div>
              <div>
                 <p className="font-semibold text-sm sm:text-base">Suporte humanizado</p>
                <p className="text-sm text-muted-foreground">Resposta em até 24h</p>
              </div>
            </div>
           </div>
        </div>
      </section>

      {/* CTA Section */}
       <section className="container mx-auto px-4 py-12 sm:py-16 md:py-20 lg:py-24">
        <div className="landing-reveal bg-gradient-to-br from-primary via-primary to-primary/90 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12 text-center text-primary-foreground relative overflow-hidden">
           {/* Decorative elements */}
           <div className="absolute top-0 right-0 w-40 h-40 sm:w-64 sm:h-64 bg-white/10 rounded-full blur-3xl" />
           <div className="absolute bottom-0 left-0 w-32 h-32 sm:w-48 sm:h-48 bg-white/5 rounded-full blur-2xl" />
           
           <div className="relative z-10">
             <div className="inline-flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 sm:mb-6">
               <GraduationCap className="h-7 w-7 sm:h-8 sm:w-8" />
             </div>
             <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            Comece sua jornada agora
          </h2>
             <p className="text-sm sm:text-base md:text-lg opacity-90 mb-6 sm:mb-8 max-w-xl mx-auto">
               Junte-se a milhares de estudantes que já estão se preparando para o ENEM com o Aprendify.
          </p>
             <Button size="lg" variant="secondary" asChild className="shadow-xl hover:-translate-y-1 transition-all duration-300">
               <Link to="/auth">
                 Criar Conta Gratuita
                 <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
               </Link>
             </Button>
           </div>
        </div>
      </section>

      {/* Footer */}
       <footer className="border-t border-border/30 py-6 sm:py-8 bg-muted/20">
        <div className="container mx-auto px-4">
           <div className="flex flex-col items-center gap-4 sm:gap-6">
             <Link to="/" className="flex items-center gap-2">
               <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                 <BookOpen className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Aprendify
              </span>
             </Link>
             <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-muted-foreground">
               <Link to="/auth" className="hover:text-primary transition-colors">Entrar</Link>
               <a href="#planos" className="hover:text-primary transition-colors">Planos</a>
               <Link to="/feedback" className="hover:text-primary transition-colors">Contato</Link>
             </div>
             <p className="text-xs sm:text-sm text-muted-foreground text-center">
              © 2025 Aprendify. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
