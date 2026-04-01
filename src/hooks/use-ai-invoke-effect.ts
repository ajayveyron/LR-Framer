import { useCallback, useRef } from "react";
import { createShaderRipple, type ShaderRippleOptions } from "@/lib/ai-invoke-shader";

/**
 * Single-element radial ripple effect.
 * Attach `ref` to the target, call `triggerEffect(clickX, clickY)` to fire.
 */
export function useAIInvokeEffect<T extends HTMLElement = HTMLElement>(
  options?: ShaderRippleOptions,
) {
  const ref = useRef<T>(null);
  const activeRef = useRef(false);

  const triggerEffect = useCallback(
    (clickX: number, clickY: number) => {
      const el = ref.current;
      if (!el || activeRef.current) return;

      activeRef.current = true;
      createShaderRipple(el, clickX, clickY, () => {
        activeRef.current = false;
      }, options);
    },
    [options],
  );

  return { ref, triggerEffect } as const;
}

/**
 * Multi-element variant for lists/tables.
 */
export function useAIInvokeEffectMap(options?: ShaderRippleOptions) {
  const activeIdsRef = useRef<Set<string>>(new Set());

  const triggerById = useCallback(
    (id: string, el: HTMLElement | null | undefined, clickX: number, clickY: number) => {
      if (!el || activeIdsRef.current.has(id)) return;

      activeIdsRef.current.add(id);
      createShaderRipple(el, clickX, clickY, () => {
        activeIdsRef.current.delete(id);
      }, options);
    },
    [options],
  );

  return { triggerById } as const;
}
