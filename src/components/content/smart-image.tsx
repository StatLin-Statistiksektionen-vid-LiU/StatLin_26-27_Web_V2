import type { ImageRef } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Responsiv bild från mediebiblioteket. Ett foto fyller sin ruta och har bildens dominanta färg som platshållare. En logga (contain)
 * visas hel och utan färgplatta, så att den aldrig beskärs och det genomskinliga förblir genomskinligt.
 */
export function SmartImage({
  image,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  className,
  priority,
  alt,
  contain,
}: {
  image: ImageRef;
  sizes?: string;
  className?: string;
  priority?: boolean;
  alt?: string;
  contain?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt ?? image.alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={cn(contain ? "object-contain" : "object-cover", className)}
      style={contain ? undefined : { backgroundColor: image.color }}
    />
  );
}
