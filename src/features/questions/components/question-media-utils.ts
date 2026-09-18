import type { QuestionAlternative, StudyQuestion } from "../types";

type ImageCollection = string[] | null | undefined;

const normalizeImages = (collections: ImageCollection[]): string[] => {
  const uniqueImages = new Set<string>();

  collections.forEach((collection) => {
    if (!Array.isArray(collection)) return;

    collection.forEach((image) => {
      const normalizedImage = image?.trim();
      if (normalizedImage) uniqueImages.add(normalizedImage);
    });
  });

  return [...uniqueImages];
};

export const getQuestionImages = (question: Pick<StudyQuestion, "files" | "images">): string[] =>
  normalizeImages([question.files, question.images]);

export const getAlternativeImages = (
  alternative: Pick<QuestionAlternative, "files" | "file">,
): string[] => normalizeImages([alternative.files, alternative.file ? [alternative.file] : null]);
