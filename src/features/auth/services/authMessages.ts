export type AuthOperation = "login" | "signup" | "recovery" | "oauth";

const genericMessages: Record<AuthOperation, string> = {
  login: "Não foi possível entrar. Verifique seus dados e tente novamente.",
  signup: "Não foi possível concluir o cadastro. Revise os dados e tente novamente.",
  recovery: "Não foi possível processar a recuperação. Tente novamente.",
  oauth: "Não foi possível conectar sua conta. Tente novamente.",
};

export const getSafeAuthMessage = (operation: AuthOperation, error: unknown): string => {
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown } | null;
  const status = typeof candidate?.status === "number" ? candidate.status : null;
  const code = typeof candidate?.code === "string" ? candidate.code : "";

  if (status === 429 || code.toLowerCase().includes("rate")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  if (status === 503) {
    return "O serviço está temporariamente indisponível. Tente novamente mais tarde.";
  }

  // Never surface provider messages: they can disclose whether an account exists.
  return genericMessages[operation];
};
