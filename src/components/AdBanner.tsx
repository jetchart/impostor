import { useEffect, useRef } from "react";

export default function AdBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;

    // Set atOptions on window
    (window as any).atOptions = {
      key: "4f0a57d03110f0eafcaed5300cff1c04",
      format: "iframe",
      height: 50,
      width: 320,
      params: {},
    };

    // Create and inject the script
    const script = document.createElement("script");
    script.src = "https://www.highperformanceformat.com/4f0a57d03110f0eafcaed5300cff1c04/invoke.js";
    script.async = true;
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current && script.parentNode === containerRef.current) {
        containerRef.current.removeChild(script);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="flex justify-center items-center min-h-[50px] w-full max-w-[320px] mx-auto"
    />
  );
}
