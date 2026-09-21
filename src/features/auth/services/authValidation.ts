import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Nome de usuário deve ter no mínimo 3 caracteres")
  .max(30, "Nome de usuário deve ter no máximo 30 caracteres")
  .regex(/^[a-zA-Z]/, "Nome de usuário deve começar com uma letra")
  .regex(/^[a-zA-Z0-9._]+$/, "Use apenas letras, números, ponto (.) ou underscore (_)")
  .refine((username) => !username.includes("__"), "Não pode ter underscores consecutivos");

/**
 * Valida os requisitos mínimos de senha sem limitar quais símbolos podem ser usados.
 * Espaços continuam fora da regra de caractere especial, mas são preservados na senha.
 */
export const validatePassword = (password: string) => ({
  minLength: Array.from(password).length >= 8,
  hasUpperCase: /\p{Lu}/u.test(password),
  hasLowerCase: /\p{Ll}/u.test(password),
  hasNumber: /\p{N}/u.test(password),
  hasSpecialChar: /[^\p{L}\p{N}\s]/u.test(password),
});
