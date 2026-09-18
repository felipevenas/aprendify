interface QuestionMediaProps {
  images: string[];
  altPrefix: string;
  compact?: boolean;
}

const QuestionMedia = ({ images, altPrefix, compact = false }: QuestionMediaProps) => {
  if (images.length === 0) return null;

  return (
    <div className={compact ? "grid gap-3 sm:grid-cols-2" : "space-y-4"}>
      {images.map((image, index) => (
        <figure
          key={`${image}-${index}`}
          className="overflow-hidden rounded-xl border border-border/70 bg-muted/20"
        >
          <div className={compact ? "flex min-h-28 items-center justify-center p-3 sm:min-h-36" : "p-3 sm:p-4"}>
            <img
              src={image}
              alt={`${altPrefix} ${index + 1}`}
              loading="lazy"
              decoding="async"
              className="max-h-[32rem] w-full rounded-lg object-contain"
            />
          </div>
          {images.length > 1 && (
            <figcaption className="border-t border-border/60 px-3 py-2 text-center text-xs text-muted-foreground">
              Imagem {index + 1} de {images.length}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
};

export default QuestionMedia;
