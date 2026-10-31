import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/** MathLive field. The library (and its fonts, bundled under /vendor) loads on first use. */
export default function VisualMathEditor({ value, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [field, setField] = useState<MathfieldElement | null>(null);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let mf: MathfieldElement | null = null;
    let cancelled = false;
    void import("mathlive").then(({ MathfieldElement }) => {
      if (cancelled || !host.current) return;
      MathfieldElement.fontsDirectory = new URL("/vendor/mathlive/fonts/", location.href).href;
      MathfieldElement.soundsDirectory = null;
      mf = new MathfieldElement();
      mf.smartFence = true;
      mf.addEventListener("input", () => onChangeRef.current(mf!.value));
      host.current.appendChild(mf);
      setField(mf);
      requestAnimationFrame(() => mf?.focus());
    });
    return () => {
      cancelled = true;
      mf?.remove();
    };
  }, []);

  useEffect(() => {
    if (field && field.value !== value) field.setValue(value, { silenceNotifications: true });
  }, [field, value]);

  return <div className="visual-math-editor" ref={host} />;
}
