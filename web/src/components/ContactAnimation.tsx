"use client";
import React, { useEffect } from "react";
import "@/styles/components/contact-animation.scss";

// Type declaration for dotlottie-wc web component
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "dotlottie-wc": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          autoplay?: boolean;
          loop?: boolean;
          style?: React.CSSProperties;
        },
        HTMLElement
      >;
    }
  }
}

export const ContactAnimation: React.FC = () => {
  useEffect(() => {
    // Load dotlottie-wc script
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@lottiefiles/dotlottie-wc@0.8.5/dist/dotlottie-wc.js";
    script.type = "module";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script on unmount
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="contact-animation" aria-hidden="true">
      <dotlottie-wc
        src="https://lottie.host/aff8c858-70de-4d2c-996d-ffc295a9a60f/T7DW1moe7j.lottie"
        style={{ width: "300px", height: "300px" }}
        autoplay
        loop
      />
    </div>
  );
};

