import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (typeof q.year !== 'string' || !q.year.trim() || !/^\d{4}$/.test(q.year.trim())) {
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

  for (const alt of q.alternatives) {
    if (!alt || typeof alt !== 'object') {
      return { valid: false, error: 'Formato de alternativa inválido' }
    }
    const a = alt as Record<string, unknown>
    if (typeof a.letter !== 'string' || !VALID_ALTERNATIVES.includes(a.letter)) {
      return { valid: false, error: `Letra de alternativa inválida: ${a.letter}` }
    }
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
      if (typeof file !== 'string' || !file.startsWith('http')) {
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify admin role
    const { data: roleData, error: roleError } = await supabase.rpc('get_user_role', { _user_id: user.id })

    if (roleError || roleData !== 'admin') {
      console.error('Role check failed:', roleError, 'Role:', roleData)
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem adicionar questões.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse and validate request body
    const body = await req.json()
    const validation = validateQuestionData(body)

    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert question
    const { data, error: insertError } = await supabase
      .from('enem_questions')
      .insert(validation.data)
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ error: `Erro ao inserir questão: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Question added successfully by admin ${user.id}:`, data.id)

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
