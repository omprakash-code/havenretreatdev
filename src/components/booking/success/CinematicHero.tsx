"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

export default function CinematicHero() {
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let rafId = 0;

    const colors = [
      "#245e5b",
      "#347f7c",
      "#5f9f9a",
      "#8eb7b1",
      "#b7d5cf",
      "#edf3f1",
    ];

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      rotation: number;
      rotationVelocity: number;
      color: string;
      life: number;
      maxLife: number;
      shape: "rect" | "circle";
    };

    let particles: Particle[] = [];

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnConfetti = () => {
      const total = 140;
      particles = Array.from({ length: total }, (_, index) => {
        const isLeft = index % 2 === 0;
        const originX = isLeft ? -10 : width + 10;
        const originY = height * (0.55 + (Math.random() - 0.5) * 0.2);
        const angleDeg = isLeft
          ? -95 + Math.random() * 40
          : -125 + Math.random() * 40;
        const angle = (angleDeg * Math.PI) / 180;
        const speed = 4 + Math.random() * 7;

        return {
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 4 + Math.random() * 4,
          rotation: Math.random() * Math.PI * 2,
          rotationVelocity: (Math.random() - 0.5) * 0.22,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 0,
          maxLife: 90 + Math.random() * 40,
          shape: Math.random() > 0.45 ? "rect" : "circle",
        };
      });
    };

    const drawParticle = (particle: Particle) => {
      const alpha = Math.max(0, 1 - particle.life / particle.maxLife);
      if (alpha <= 0) return;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;

      if (particle.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(
          -particle.size / 2,
          -particle.size / 2,
          particle.size,
          particle.size * 0.65
        );
      }

      ctx.restore();
    };

    const step = () => {
      ctx.clearRect(0, 0, width, height);

      particles = particles.filter((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.09;
        particle.vx *= 0.996;
        particle.rotation += particle.rotationVelocity;
        particle.life += 1;

        drawParticle(particle);

        return particle.life < particle.maxLife && particle.y < height + 30;
      });

      if (particles.length > 0) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    resizeCanvas();
    spawnConfetti();
    step();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      ctx.clearRect(0, 0, width, height);
    };
  }, []);

  return (
    <section className="relative min-h-[24vh] sm:min-h-[28vh] flex items-center justify-center overflow-hidden py-5 sm:py-6">
      <canvas
        ref={confettiCanvasRef}
        className="pointer-events-none fixed inset-0 z-30"
        aria-hidden="true"
      />

      {/* Radial Spotlight Glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] sm:w-[460px] sm:h-[460px] bg-gradient-radial from-[#347f7c]/25 via-[#8eb7b1]/10 to-transparent rounded-full blur-3xl"
      />

      {/* Full-Width Headline Sweep */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        <motion.span
          className="absolute left-1/2 top-[50%] h-[150px] sm:h-[180px] w-[360vw] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-[#347f7c]/25 to-transparent md:h-[210px]"
          initial={{ x: "-260vw", opacity: 0 }}
          animate={{ x: "260vw", opacity: [0, 0.9, 0] }}
          transition={{ duration: 2.2, delay: 0.5, ease: "easeInOut" }}
        />
      </div>

      {/* Content */}
      <div className="relative z-20 text-center px-4 sm:px-5 max-w-4xl">
        {/* Main Headline with Shimmer Effect */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.h1
            className="relative mb-2 inline-block text-[clamp(1.2rem,6vw,2.25rem)] leading-tight font-bold text-slate-900"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <span className="relative block">Your Haven Retreat Booking Is Confirmed</span>
          </motion.h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-xs sm:text-sm md:text-base text-slate-700 font-light tracking-wide"
        >
          Your private venue is reserved. Get ready for a relaxed poolside celebration.
        </motion.p>

        {/* Animated Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="w-24 h-px bg-gradient-to-r from-transparent via-[#347f7c] to-transparent mx-auto mt-5"
        />
      </div>

      {/* Subtle Light Rays */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{
              duration: 3,
              delay: i * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-0 w-px h-full bg-gradient-to-b from-zinc-400/55 via-zinc-300/20 to-transparent"
            style={{ left: `${20 + i * 15}%` }}
          />
        ))}
      </div>
    </section>
  );
}
