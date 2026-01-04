-- Padroniza disciplinas inconsistentes no banco
UPDATE enem_questions SET discipline = 'ciencias-natureza' WHERE discipline = 'da-natureza';
UPDATE enem_questions SET discipline = 'ciencias-humanas' WHERE discipline = 'humanas';
UPDATE enem_questions SET discipline = 'matematica' WHERE discipline = 'matemática';