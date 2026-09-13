export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      ...extraHeaders,
      "Content-Type": "application/json",
    },
  });
}

export async function readJsonObject(
  req: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Payload excede o limite permitido");
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Payload excede o limite permitido");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "JSON inválido");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(400, "INVALID_BODY", "O corpo deve ser um objeto JSON");
  }
  return parsed as Record<string, unknown>;
}

export function errorResponse(
  error: unknown,
  headers: Record<string, string>,
  fallbackCode = "INTERNAL_ERROR",
  fallbackMessage = "Erro interno do servidor",
): Response {
  if (error instanceof ApiError) {
    return jsonResponse({ error: error.message, code: error.code }, error.status, headers);
  }
  return jsonResponse({ error: fallbackMessage, code: fallbackCode }, 500, headers);
}

