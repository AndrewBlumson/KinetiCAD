import { useEffect, useRef } from "react";
import katex from "katex";

interface EquationProps {
  /** LaTeX source (without surrounding $ delimiters). */
  tex: string;
  className?: string;
  displayMode?: boolean;
}

/**
 * Renders a LaTeX expression with KaTeX. Used for the maths scene.
 */
export function Equation({ tex, className, displayMode = true }: EquationProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    katex.render(tex, ref.current, {
      throwOnError: false,
      displayMode,
      output: "html",
      strict: "ignore",
    });
  }, [tex, displayMode]);

  return <div ref={ref} className={className} />;
}
