import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Textarea que cresce com o conteúdo (quebra de linha automática). */
export function AutoTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(fit);
  return (
    <textarea
      ref={ref}
      rows={1}
      {...props}
      onInput={(e) => { fit(); props.onInput?.(e); }}
      className={cn("block w-full resize-none overflow-hidden whitespace-pre-wrap break-words", className)}
    />
  );
}
