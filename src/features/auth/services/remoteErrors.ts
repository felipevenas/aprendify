export type RemoteFailureKind =
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "unavailable"
  | "invalid_request"
  | "server_error";

export interface RemoteFailureOptions {
  operation?: "checkout" | "entitlement" | "essay" | "explanation" | "portal";
  retryAfterSeconds?: number | null;
}

export class RemoteFailure extends Error {
  readonly status: number;
  readonly kind: RemoteFailureKind;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, message: string, kind: RemoteFailureKind, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "RemoteFailure";
    this.status = status;
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null => (
  value !== null && typeof value === "object" ? value as UnknownRecord : null
);

const getErrorStatus = (error: unknown): number => {
  const record = asRecord(error);
  const context = asRecord(record?.context);
  const status = record?.status ?? context?.status;
  return typeof status === "number" ? status : 500;
};

const getRetryAfter = (error: unknown, fallback?: number | null): number | null => {
  if (error instanceof Response) {
    const value = error.headers.get("Retry-After");
    const seconds = value ? Number.parseInt(value, 10) : NaN;
    if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  }

  const record = asRecord(error);
  const context = asRecord(record?.context);
  const headers = context?.headers;

  if (headers && typeof (headers as Headers).get === "function") {
    const value = (headers as Headers).get("Retry-After");
    const seconds = value ? Number.parseInt(value, 10) : NaN;
    if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  }

  return typeof fallback === "number" && Number.isFinite(fallback) && fallback >= 0 ? fallback : null;
};

const kindForStatus = (status: number): RemoteFailureKind => {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 413 || status === 422) return "invalid_request";
  if (status === 500 || status === 502 || status === 504 || status === 503) return "unavailable";
  return "server_error";
};

const messageFor = (status: number, operation: RemoteFailureOptions["operation"]): string => {
  switch (status) {
    case 401:
      return "Sua sessão expirou. Entre novamente para continuar.";
    case 403:
      return operation === "essay"
        ? "O limite ou a permissão do seu plano não permite esta ação agora."
        : "Você não tem permissão para realizar esta ação.";
    case 429:
      return "Muitas tentativas em pouco tempo. Aguarde e tente novamente.";
    case 503:
      return "O serviço está temporariamente indisponível. Tente novamente mais tarde.";
    case 400:
    case 413:
    case 422:
      return "Não foi possível validar os dados enviados. Revise o formulário e tente novamente.";
    default:
      return operation === "checkout"
        ? "Não foi possível iniciar o pagamento. Tente novamente."
        : "Não foi possível concluir a solicitação. Tente novamente.";
  }
};

export const normalizeRemoteFailure = (
  error: unknown,
  options: RemoteFailureOptions = {},
): RemoteFailure => {
  if (error instanceof RemoteFailure) return error;

  const status = getErrorStatus(error);
  return new RemoteFailure(
    status,
    messageFor(status, options.operation),
    kindForStatus(status),
    getRetryAfter(error, options.retryAfterSeconds),
  );
};

export const normalizeHttpFailure = (
  response: Response,
  options: RemoteFailureOptions = {},
): RemoteFailure => new RemoteFailure(
  response.status,
  messageFor(response.status, options.operation),
  kindForStatus(response.status),
  getRetryAfter(response, options.retryAfterSeconds),
);

export const readJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const retryAfterLabel = (seconds: number | null): string | null => {
  if (seconds === null) return null;
  if (seconds < 60) return `Tente novamente em ${seconds} segundos.`;
  const minutes = Math.ceil(seconds / 60);
  return `Tente novamente em aproximadamente ${minutes} minuto${minutes === 1 ? "" : "s"}.`;
};
