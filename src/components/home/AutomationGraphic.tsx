import React from "react";

export const AutomationGraphic = () => {
  return (
    <div className="relative w-full max-w-3xl mx-auto aspect-[2/1] overflow-hidden rounded-xl bg-card/20 shadow-sm flex items-center justify-center">
      <svg
        viewBox="0 0 800 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <style>
          {`
            @keyframes pulseGlow {
              0%, 100% { filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.4)); transform: scale(1); }
              50% { filter: drop-shadow(0 0 25px rgba(59, 130, 246, 0.8)); transform: scale(1.05); }
            }
            @keyframes spinSlow {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes spinReverse {
              from { transform: rotate(360deg); }
              to { transform: rotate(0deg); }
            }
            @keyframes dashMove {
              0% { stroke-dashoffset: 20; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { stroke-dashoffset: -250; opacity: 0; }
            }
            @keyframes dashMoveOut {
              0% { stroke-dashoffset: 20; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { stroke-dashoffset: -250; opacity: 0; }
            }

            .hub-core {
              animation: pulseGlow 3s ease-in-out infinite;
              transform-origin: 400px 200px;
            }
            .ring-1 {
              animation: spinSlow 12s linear infinite;
              transform-origin: 400px 200px;
            }
            .ring-2 {
              animation: spinReverse 16s linear infinite;
              transform-origin: 400px 200px;
            }
            .ring-3 {
              animation: spinSlow 24s linear infinite;
              transform-origin: 400px 200px;
            }

            .data-stream-1 {
              stroke-dasharray: 15 500;
              animation: dashMove 2s linear infinite;
            }
            .data-stream-2 {
              stroke-dasharray: 15 500;
              animation: dashMove 2.5s linear infinite;
              animation-delay: 1.2s;
            }
            .data-stream-3 {
              stroke-dasharray: 15 500;
              animation: dashMove 1.8s linear infinite;
              animation-delay: 0.5s;
            }
            .data-stream-out {
              stroke-dasharray: 15 500;
              animation: dashMoveOut 2s linear infinite;
              animation-delay: 0.8s;
            }
          `}
        </style>

        {/* Gradients */}
        <defs>
          <linearGradient
            id="lineGrad1"
            x1="200"
            y1="100"
            x2="400"
            y2="200"
            gradientUnits="userSpaceOnUse"
          >
            <stop
              offset="0%"
              stopColor="hsl(var(--muted-foreground))"
              stopOpacity="0.1"
            />
            <stop
              offset="100%"
              stopColor="hsl(var(--muted-foreground))"
              stopOpacity="0.6"
            />
          </linearGradient>
          <linearGradient
            id="lineGrad2"
            x1="200"
            y1="300"
            x2="400"
            y2="200"
            gradientUnits="userSpaceOnUse"
          >
            <stop
              offset="0%"
              stopColor="hsl(var(--muted-foreground))"
              stopOpacity="0.1"
            />
            <stop
              offset="100%"
              stopColor="hsl(var(--muted-foreground))"
              stopOpacity="0.6"
            />
          </linearGradient>
          <linearGradient
            id="lineGrad3"
            x1="400"
            y1="200"
            x2="600"
            y2="200"
            gradientUnits="userSpaceOnUse"
          >
            <stop
              offset="0%"
              stopColor="hsl(var(--muted-foreground))"
              stopOpacity="0.6"
            />
            <stop
              offset="100%"
              stopColor="hsl(var(--muted-foreground))"
              stopOpacity="0.1"
            />
          </linearGradient>

          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Base Connection Lines */}
        <line
          x1="200"
          y1="100"
          x2="400"
          y2="200"
          stroke="url(#lineGrad1)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="200"
          y1="300"
          x2="400"
          y2="200"
          stroke="url(#lineGrad2)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="400"
          y1="200"
          x2="600"
          y2="200"
          stroke="url(#lineGrad3)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Animated Data Streams */}
        {/* Stream 1 */}
        <line
          x1="200"
          y1="100"
          x2="400"
          y2="200"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          className="data-stream-1"
          filter="url(#neonGlow)"
        />
        {/* Stream 2 */}
        <line
          x1="200"
          y1="300"
          x2="400"
          y2="200"
          stroke="#10b981"
          strokeWidth="3"
          strokeLinecap="round"
          className="data-stream-2"
          filter="url(#neonGlow)"
        />
        <line
          x1="200"
          y1="300"
          x2="400"
          y2="200"
          stroke="#10b981"
          strokeWidth="3"
          strokeLinecap="round"
          className="data-stream-3"
          filter="url(#neonGlow)"
        />

        {/* Stream Out (Processed Data) */}
        <line
          x1="400"
          y1="200"
          x2="600"
          y2="200"
          stroke="#a855f7"
          strokeWidth="4"
          strokeLinecap="round"
          className="data-stream-out"
          filter="url(#neonGlow)"
        />

        {/* Left Nodes (External Systems) */}
        <g transform="translate(200, 100)">
          <circle
            cx="0"
            cy="0"
            r="24"
            fill="hsl(var(--card))"
            stroke="hsl(var(--border))"
            strokeWidth="2"
          />
          <path
            d="M-8 -6 h16 M-8 0 h16 M-8 6 h8"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <text
            x="-40"
            y="5"
            fill="hsl(var(--muted-foreground))"
            fontSize="12"
            fontFamily="monospace"
            textAnchor="end"
          >
            API
          </text>
        </g>

        <g transform="translate(200, 300)">
          <circle
            cx="0"
            cy="0"
            r="24"
            fill="hsl(var(--card))"
            stroke="hsl(var(--border))"
            strokeWidth="2"
          />
          {/* Cloud icon simple */}
          <path
            d="M-6 -2 a 4 4 0 0 1 12 0 a 4 4 0 0 1 0 8 h -12 a 4 4 0 0 1 0 -8 z"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2"
            fill="none"
          />
          <text
            x="-40"
            y="5"
            fill="hsl(var(--muted-foreground))"
            fontSize="12"
            fontFamily="monospace"
            textAnchor="end"
          >
            SFDC
          </text>
        </g>

        {/* Right Node (Output / Local Storage) */}
        <g transform="translate(600, 200)">
          <circle
            cx="0"
            cy="0"
            r="28"
            fill="hsl(var(--card))"
            stroke="hsl(var(--border))"
            strokeWidth="2"
          />
          <path
            d="M-8 -4 L-2 2 L8 -8"
            stroke="#a855f7"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#neonGlow)"
          />
          <text
            x="40"
            y="5"
            fill="hsl(var(--muted-foreground))"
            fontSize="12"
            fontFamily="monospace"
            textAnchor="start"
          >
            LOCAL
          </text>
        </g>

        {/* Central Hub (cmpDesk) */}
        <g className="hub-core">
          {/* Decorative Rings */}
          <circle
            cx="400"
            cy="200"
            r="60"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="1"
            className="ring-3"
            strokeDasharray="4 8"
          />
          <circle
            cx="400"
            cy="200"
            r="45"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            className="opacity-50 ring-2"
            strokeDasharray="30 15 10 15"
          />
          <circle
            cx="400"
            cy="200"
            r="32"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            className="ring-1 opacity-80"
            strokeDasharray="40 20"
          />

          {/* Core Sphere */}
          <circle
            cx="400"
            cy="200"
            r="20"
            fill="hsl(var(--background))"
            stroke="#3b82f6"
            strokeWidth="3"
            filter="url(#neonGlow)"
          />
          <circle cx="400" cy="200" r="8" fill="#3b82f6" />
        </g>
      </svg>
    </div>
  );
};
