import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { consumeRateLimit, rateLimitHeaders } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://app.aprendify.cloud',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin')
  const allowedOrigin = origin === 'https://app.aprendify.cloud' || Boolean(origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    ? origin
    : corsHeaders['Access-Control-Allow-Origin']
  return { ...corsHeaders, 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' }
}

// Validation schema for question data
interface QuestionData {
  year: string
  discipline: string
  index: number
  title: string
  context?: string | null
  alternatives_introduction?: string | null
  alternatives: Array<{ letter: string; text: string }>
  correct_alternative: string
  files?: string[] | null
}

const VALID_DISCIPLINES = ['linguagens', 'ciencias-humanas', 'ciencias-natureza', 'matematica']
const VALID_ALTERNATIVES = ['A', 'B', 'C', 'D', 'E']

function validateQuestionData(data: unknown): { valid: boolean; error?: string; data?: QuestionData } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Dados da questão inválidos' }
  }

  const q = data as Record<string, unknown>

  // Validate year
  if (typeof q.year !== 'string' || !q.year.trim() || !/^20(?:0[9]|1[0-9]|2[0-6])$/.test(q.year.trim())) {
    return { valid: false, error: 'Ano inválido. Use formato YYYY (ex: 2024)' }
  }

  // Validate discipline
  if (typeof q.discipline !== 'string' || !VALID_DISCIPLINES.includes(q.discipline)) {
    return { valid: false, error: `Disciplina inválida. Use: ${VALID_DISCIPLINES.join(', ')}` }
  }

  // Validate index
  if (typeof q.index !== 'number' || !Number.isInteger(q.index) || q.index < 1 || q.index > 200) {
    return { valid: false, error: 'Número da questão inválido. Use um número entre 1 e 200' }
  }

  // Validate title
  if (typeof q.title !== 'string' || !q.title.trim() || q.title.length > 10000) {
    return { valid: false, error: 'Enunciado inválido ou muito longo (máx 10000 caracteres)' }
  }

  // Validate context (optional)
  if (q.context !== null && q.context !== undefined) {
    if (typeof q.context !== 'string' || q.context.length > 50000) {
      return { valid: false, error: 'Contexto muito longo (máx 50000 caracteres)' }
    }
  }

  // Validate alternatives_introduction (optional)
  if (q.alternatives_introduction !== null && q.alternatives_introduction !== undefined) {
    if (typeof q.alternatives_introduction !== 'string' || q.alternatives_introduction.length > 1000) {
      return { valid: false, error: 'Introdução das alternativas muito longa (máx 1000 caracteres)' }
    }
  }

  // Validate alternatives
  if (!Array.isArray(q.alternatives) || q.alternatives.length !== 5) {
    return { valid: false, error: 'Deve haver exatamente 5 alternativas (A-E)' }
  }

  const letters = new Set<string>()
  for (const alt of q.alternatives) {
    if (!alt || typeof alt !== 'object') {
      return { valid: false, error: 'Formato de alternativa inválido' }
    }
    const a = alt as Record<string, unknown>
    if (typeof a.letter !== 'string' || !VALID_ALTERNATIVES.includes(a.letter) || letters.has(a.letter)) {
      return { valid: false, error: `Letra de alternativa inválida: ${a.letter}` }
    }
    letters.add(a.letter)
    if (typeof a.text !== 'string' || !a.text.trim()) {
      return { valid: false, error: `Alternativa ${a.letter} está vazia` }
    }
    if (a.text.length > 5000) {
      return { valid: false, error: `Alternativa ${a.letter} muito longa (máx 5000 caracteres)` }
    }
  }

  // Validate correct_alternative
  if (typeof q.correct_alternative !== 'string' || !VALID_ALTERNATIVES.includes(q.correct_alternative)) {
    return { valid: false, error: 'Alternativa correta inválida. Use A, B, C, D ou E' }
  }

  // Validate files (optional)
  if (q.files !== null && q.files !== undefined) {
    if (!Array.isArray(q.files)) {
      return { valid: false, error: 'Formato de arquivos inválido' }
    }
    for (const file of q.files) {
      if (typeof file !== 'string' || file.length > 2048 || !file.startsWith('https://')) {
        return { valid: false, error: 'URL de arquivo inválida' }
      }
    }
  }

  return {
    valid: true,
    data: {
      year: q.year.trim(),
      discipline: q.discipline,
      index: q.index,
      title: q.title.trim(),
      context: q.context ? (q.context as string).trim() || null : null,
      alternatives_introduction: q.alternatives_introduction ? (q.alternatives_introduction as string).trim() || null : null,
      alternatives: q.alternatives as Array<{ letter: string; text: string }>,
      correct_alternative: q.correct_alternative,
      files: q.files as string[] || null,
    },
  }
}

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req)
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  try {
    // Verify authentication
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    // Verify admin role
    const { data: roleData, error: roleError } = await supabase.rpc('get_user_role', { _user_id: user.id })

    if (roleError || roleData !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem adicionar questões.' }),
        { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    const rateLimit = await consumeRateLimit(supabase, req, user.id, 'add-manual-question', 20, 60)
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Limite de importações atingido', code: 'RATE_LIMITED' }),
        { status: 429, headers: { ...headers, ...rateLimitHeaders(rateLimit), 'Content-Type': 'application/json' } }
      )
    }

    // Parse and validate request body
    const bodyBytes = new Uint8Array(await req.arrayBuffer())
    if (bodyBytes.byteLength > 512 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Payload excede o limite permitido', code: 'PAYLOAD_TOO_LARGE' }),
        { status: 413, headers: { ...headers, ...rateLimitHeaders(rateLimit), 'Content-Type': 'application/json' } }
      )
    }
    let body: unknown
    try {
      body = JSON.parse(new TextDecoder().decode(bodyBytes))
    } catch {
      return new Response(
        JSON.stringify({ error: 'JSON inválido', code: 'INVALID_JSON' }),
        { status: 400, headers: { ...headers, ...rateLimitHeaders(rateLimit), 'Content-Type': 'application/json' } }
      )
    }
    const validation = validateQuestionData(body)

    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...headers, ...rateLimitHeaders(rateLimit), 'Content-Type': 'application/json' } }
      )
    }

    // Insert question
    const { data, error: insertError } = await supabase
      .from('enem_questions')
      .insert(validation.data)
      .select()
      .single()

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível inserir a questão', code: 'QUESTION_INSERT_FAILED' }),
        { status: 500, headers: { ...headers, ...rateLimitHeaders(rateLimit), 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...headers, ...rateLimitHeaders(rateLimit), 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  }
})
