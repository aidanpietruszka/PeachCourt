import { useEffect, useState } from "react";

function currentHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

export function useVisualViewportHeight(): number {
  const [height, setHeight] = useState(currentHeight);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }
    const update = () => setHeight(viewport.height);
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return height;
}
