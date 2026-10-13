import { useEffect, useRef } from "react";
import { getTamerSprite, onTamerReady } from "@/game/scarf";
import { cn } from "@/lib/utils";

/**
 * The tamer sprite with its scarf recolored by the scarf system — a canvas,
 * because the dye is painted per pixel, not a CSS overlay.
 */
export function TamerSprite({ scarf, alt, className }: { scarf: string; alt: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    const draw = (): void => {
      const cv = ref.current;
      const im = getTamerSprite(scarf);
      if (!cv || !im) return;
      cv.width = im.width;
      cv.height = im.height;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(im, 0, 0);
    };
    draw();
    const off = onTamerReady(() => {
      if (alive) draw();
    });
    return () => {
      alive = false;
      off();
    };
  }, [scarf]);

  return <canvas ref={ref} role="img" aria-label={alt} className={cn("pixel", className)} />;
}
