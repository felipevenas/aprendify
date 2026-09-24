interface StreakResponse<Row> {
  data: Row | null;
  error: { message: string } | null;
}

/** Garante a linha inicial sem transformar erros de consulta em ausência de dados. */
export async function loadOrCreateStreakRow<Row>(
  read: () => PromiseLike<StreakResponse<Row>>,
  create: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<Row> {
  const first = await read();
  if (first.error) throw first.error;
  if (first.data) return first.data;

  // O upsert com ignoreDuplicates permite chamadas simultâneas no primeiro login.
  const inserted = await create();
  if (inserted.error) throw inserted.error;

  const second = await read();
  if (second.error) throw second.error;
  if (!second.data) {
    throw new Error('Registro de streak indisponível após a criação');
  }
  return second.data;
}
