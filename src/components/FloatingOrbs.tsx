"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const ORBS = [
  { symbol: "NVDA", sub: "+4.2%", color: "#818cf8", glow: "rgba(99,102,241,0.5)", x: "8%",  y: "18%", size: 108, delay: 0    },
  { symbol: "AAPL", sub: "+1.8%", color: "#67e8f9", glow: "rgba(34,211,238,0.4)",  x: "82%", y: "12%", size: 92,  delay: 0.6  },
  { symbol: "TSLA", sub: "+6.1%", color: "#fbbf24", glow: "rgba(245,158,11,0.45)", x: "88%", y: "58%", size: 84,  delay: 1.2  },
  { symbol: "MSFT", sub: "+2.3%", color: "#c4b5fd", glow: "rgba(139,92,246,0.4)",  x: "5%",  y: "62%", size: 96,  delay: 0.3  },
  { symbol: "AMZN", sub: "+3.7%", color: "#6ee7b7", glow: "rgba(16,185,129,0.4)",  x: "46%", y: "78%", size: 78,  delay: 0.9  },
  { symbol: "META", sub: "+5.0%", color: "#93c5fd", glow: "rgba(59,130,246,0.4)",  x: "25%", y: "8%",  size: 70,  delay: 1.5  },
  { symbol: "GOOGL",sub: "+1.2%", color: "#34d399", glow: "rgba(52,211,153,0.35)", x: "68%", y: "82%", size: 66,  delay: 0.4  },
];

export function FloatingOrbs() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const orbs = containerRef.current.querySelectorAll<HTMLElement>(".crystal-orb");
    const ctx = gsap.context(() => {
      orbs.forEach((orb, i) => {
        const amplitude = 18 + (i % 3) * 8;
        const duration  = 4.5 + (i % 4) * 1.2;
        gsap.to(orb, {
          y: `-=${amplitude}`,
          duration,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: ORBS[i].delay,
        });
        // subtle x drift
        gsap.to(orb, {
          x: `+=${10 + (i % 3) * 6}`,
          duration: duration * 1.4,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: ORBS[i].delay * 0.5,
        });
        // fade in on mount
        gsap.from(orb, {
          opacity: 0,
          scale: 0.6,
          duration: 1.2,
          ease: "back.out(1.4)",
          delay: 0.3 + ORBS[i].delay * 0.6,
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="orbs-container" aria-hidden="true">
      {ORBS.map((orb) => (
        <div
          key={orb.symbol}
          className="crystal-orb"
          style={{
            left: orb.x,
            top:  orb.y,
            width:  orb.size,
            height: orb.size,
            "--orb-color": orb.color,
            "--orb-glow":  orb.glow,
          } as React.CSSProperties}
        >
          <div className="orb-inner">
            <span className="orb-symbol">{orb.symbol}</span>
            <span className="orb-sub" style={{ color: orb.color }}>{orb.sub}</span>
          </div>
          {/* specular highlight */}
          <div className="orb-highlight" />
          {/* bottom reflection */}
          <div className="orb-reflection" />
        </div>
      ))}
    </div>
  );
}
