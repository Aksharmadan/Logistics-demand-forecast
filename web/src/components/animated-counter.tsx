"use client";

import { animate } from "framer-motion";
import * as React from "react";

export function AnimatedCounter({
  value,
  format = (n: number) => Math.round(n).toLocaleString(),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = React.useState(0);
  const fromRef = React.useRef(0);

  React.useEffect(() => {
    const ctrl = animate(fromRef.current, value, {
      duration: 1.05,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
      onComplete: () => {
        fromRef.current = value;
      },
    });
    return () => ctrl.stop();
  }, [value]);

  return <span className="tabular-nums">{format(display)}</span>;
}
