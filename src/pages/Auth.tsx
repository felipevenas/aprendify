import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { motion } from "framer-motion";
import { BookOpen, Mail, Lock, User, ArrowRight } from "lucide-react";
import authHero from "@/assets/auth-hero.jpg";

/**
 * Página de autenticação com design moderno split-screen
 * Lado esquerdo: Imagem hero
 * Lado direito: Formulário de login/cadastro
 */
const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Handler para autenticação (login ou signup)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        toast.success("Login realizado com sucesso!");
        navigate("/dashboard");
      } else {
        // Primeiro cria a conta
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: fullName,
              role: "user", // Sempre usuário padrão
            },
          },
        });

        if (signUpError) throw signUpError;

        // Atualiza o perfil com informações adicionais
        if (signUpData.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              username,
              phone,
              birthdate: birthdate || null,
            })
            .eq("id", signUpData.user.id);

          if (profileError) {
            console.error("Erro ao atualizar perfil:", profileError);
            toast.warning("Conta criada, mas algumas informações não foram salvas.");
          }
        }

        toast.success("Cadastro realizado! Faça login para continuar.");
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message || "Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Lado esquerdo - Imagem Hero (hidden em mobile) */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 relative bg-primary overflow-hidden"
      >
        {/* Imagem de fundo */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${authHero})` }}
        >
          {/* Overlay gradiente */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary-dark/90" />
        </div>
        
        {/* Conteúdo sobre a imagem */}
        <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 xl:px-24 text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <BookOpen className="h-12 w-12 text-white" />
              <h1 className="text-5xl font-bold text-white">Learnify</h1>
            </div>
            <h2 className="text-3xl font-semibold mb-4 text-white">
              Organize seus estudos de forma inteligente
            </h2>
            <p className="text-xl text-white mb-8 leading-relaxed">
              Gerencie seu cronograma, resolva questões do ENEM, faça anotações e 
              acompanhe seu progresso em um só lugar.
            </p>
            
            {/* Features */}
            <div className="space-y-4">
              {[
                "Cronogramas personalizados",
                "Banco de questões do ENEM",
                "Anotações organizadas por matéria",
                "Acompanhamento de tarefas"
              ].map((feature, idx) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + idx * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-2 h-2 rounded-full bg-white" />
                  <span className="text-lg text-white">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Lado direito - Formulário */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background"
      >
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="flex lg:hidden items-center justify-center mb-8">
            <BookOpen className="h-10 w-10 text-primary mr-3" />
            <h1 className="text-3xl font-bold text-primary">Learnify</h1>
          </div>

          {/* Header do formulário */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-3xl font-bold text-foreground mb-2">
              {isLogin ? "Bem-vindo de volta" : "Criar sua conta"}
            </h2>
            <p className="text-muted-foreground text-lg">
              {isLogin
                ? "Entre com suas credenciais para continuar"
                : "Preencha os dados para começar sua jornada"}
            </p>
          </motion.div>

          {/* Formulário */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            onSubmit={handleAuth}
            className="space-y-6"
          >
            {/* Campos de cadastro */}
            {!isLogin && (
              <>
                {/* Nome completo */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-base font-medium">
                    Nome Completo
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Seu nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={!isLogin}
                      disabled={loading}
                      className="pl-11 h-12 text-base"
                    />
                  </div>
                </div>

                {/* Nome de usuário */}
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-base font-medium">
                    Nome de Usuário
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="seunome123"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required={!isLogin}
                      disabled={loading}
                      className="pl-11 h-12 text-base"
                    />
                  </div>
                </div>

                {/* Data de nascimento */}
                <div className="space-y-2">
                  <Label htmlFor="birthdate" className="text-base font-medium">
                    Data de Nascimento
                  </Label>
                  <Input
                    id="birthdate"
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    disabled={loading}
                    className="h-12 text-base"
                  />
                </div>

                {/* Celular */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base font-medium">
                    Celular
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required={!isLogin}
                    disabled={loading}
                    className="h-12 text-base"
                  />
                </div>
              </>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-11 h-12 text-base"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base font-medium">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="pl-11 h-12 text-base"
                />
              </div>
            </div>


            {/* Botão de submit */}
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold gap-2" 
              disabled={loading}
            >
              {loading ? (
                "Processando..."
              ) : (
                <>
                  {isLogin ? "Entrar" : "Criar conta"}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>

            {/* Link para alternar entre login/cadastro */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:text-primary-light transition-colors font-medium text-base"
                disabled={loading}
              >
                {isLogin 
                  ? "Não tem conta? Cadastre-se gratuitamente" 
                  : "Já tem conta? Faça login"}
              </button>
            </div>
          </motion.form>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
