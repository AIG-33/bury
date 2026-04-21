"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
};

type Props = {
  className?: string;
};

/**
 * LivingBall — cursor-reactive felt-textured tennis ball rendered on a 2D canvas.
 *
 * It fakes 3D depth via:
 *  - radial light/shadow gradient that follows the cursor (Phong-ish lobe)
 *  - parallax-rotated felt fibre layer drawn with seeded noise
 *  - soft white seam that bends with the cursor
 *  - lime-neon particle burst when the cursor enters the ball
 *
 * No three.js / no WebGL — strictly Canvas 2D + DPR-aware rendering.
 * Pauses when off-screen and respects prefers-reduced-motion.
 */
export function LivingBall({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cssW = 0;
    let cssH = 0;
    let cx = 0;
    let cy = 0;
    let radius = 0;

    // Cursor target & spring-damped current position (in canvas-CSS coords).
    const cursor = { x: 0, y: 0, hover: false };
    const eye = { x: 0, y: 0 };

    // Felt fibres baked once per resize as offset map.
    let fibres: Array<{ a: number; r: number; len: number; alpha: number }> =
      [];

    const particles: Particle[] = [];
    let lastT = performance.now();
    let visible = true;
    let raf = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cx = cssW / 2;
      cy = cssH / 2;
      radius = Math.min(cssW, cssH) * 0.42;
      // Centre cursor on first paint to avoid initial jump.
      eye.x = cx;
      eye.y = cy;
      cursor.x = cx;
      cursor.y = cy;

      // Bake felt fibres (deterministic per radius).
      fibres = [];
      const count = Math.round(radius * 6);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        fibres.push({
          a,
          r,
          len: 1 + Math.random() * 2.2,
          alpha: 0.05 + Math.random() * 0.18,
        });
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      cursor.x = e.clientX - rect.left;
      cursor.y = e.clientY - rect.top;
      const dx = cursor.x - cx;
      const dy = cursor.y - cy;
      const inside = Math.hypot(dx, dy) < radius * 1.05;
      if (inside && !cursor.hover) spawnBurst(8);
      cursor.hover = inside;
    };

    const onPointerLeave = () => {
      cursor.hover = false;
      cursor.x = cx;
      cursor.y = cy;
    };

    const onPointerDown = () => {
      if (cursor.hover) spawnBurst(22);
    };

    const spawnBurst = (n: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 180;
        particles.push({
          x: cx + Math.cos(a) * radius * 0.8,
          y: cy + Math.sin(a) * radius * 0.8,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 30,
          life: 0,
          ttl: 0.7 + Math.random() * 0.7,
          size: 1 + Math.random() * 2.4,
        });
      }
    };

    const drawBall = (t: number) => {
      ctx.clearRect(0, 0, cssW, cssH);

      // Spring towards cursor
      const stiffness = reduceMotion ? 0 : 0.085;
      eye.x += (cursor.x - eye.x) * stiffness;
      eye.y += (cursor.y - eye.y) * stiffness;

      // Light direction: from cursor (above-left bias when inside)
      const lx = (eye.x - cx) / radius; // -1..1
      const ly = (eye.y - cy) / radius;
      const lightX = cx + lx * radius * 0.55;
      const lightY = cy + ly * radius * 0.55 - radius * 0.25;

      // Soft outer glow
      const glow = ctx.createRadialGradient(
        cx,
        cy,
        radius * 0.9,
        cx,
        cy,
        radius * 1.6,
      );
      glow.addColorStop(0, "rgba(212, 255, 58, 0.18)");
      glow.addColorStop(1, "rgba(212, 255, 58, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Ball base — felt yellow with shaded sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      const base = ctx.createRadialGradient(
        lightX,
        lightY,
        radius * 0.05,
        cx,
        cy,
        radius * 1.05,
      );
      base.addColorStop(0, "#F8FDB8");
      base.addColorStop(0.35, "#E2F644");
      base.addColorStop(0.7, "#B5CB04");
      base.addColorStop(1, "#454F01");
      ctx.fillStyle = base;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      // Felt fibres — slight rotation based on cursor for parallax illusion
      const rot = Math.atan2(ly, lx) * 0.06;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.translate(-cx, -cy);
      for (let i = 0; i < fibres.length; i++) {
        const f = fibres[i];
        const fx = cx + Math.cos(f.a) * f.r;
        const fy = cy + Math.sin(f.a) * f.r;
        const fxe = fx + Math.cos(f.a + 1.4) * f.len;
        const fye = fy + Math.sin(f.a + 1.4) * f.len;
        ctx.strokeStyle = `rgba(255,255,255,${f.alpha})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fxe, fye);
        ctx.stroke();
      }

      // Subtle terminator shadow on far side from light
      const shade = ctx.createRadialGradient(
        cx - lx * radius * 0.4,
        cy - ly * radius * 0.4,
        radius * 0.3,
        cx,
        cy,
        radius,
      );
      shade.addColorStop(0, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,21,48,0.55)");
      ctx.fillStyle = shade;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      ctx.restore();

      // White seam — curves through the ball, slightly sympathetic to cursor
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(0.6 + rot * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.96)";
      ctx.lineWidth = Math.max(2, radius * 0.025);
      ctx.lineCap = "round";
      ctx.beginPath();
      const r = radius;
      ctx.moveTo(-r * 0.95, 0);
      ctx.bezierCurveTo(-r * 0.4, -r * 0.9, r * 0.4, -r * 0.9, r * 0.95, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, 0);
      ctx.bezierCurveTo(-r * 0.4, r * 0.9, r * 0.4, r * 0.9, r * 0.95, 0);
      ctx.stroke();

      // Tiny shadow alongside seam to give 3D edge
      ctx.strokeStyle = "rgba(0,30,60,0.18)";
      ctx.lineWidth = Math.max(1, radius * 0.012);
      ctx.beginPath();
      ctx.moveTo(-r * 0.93, r * 0.06);
      ctx.bezierCurveTo(
        -r * 0.4,
        -r * 0.85,
        r * 0.4,
        -r * 0.85,
        r * 0.93,
        r * 0.06,
      );
      ctx.stroke();
      ctx.restore();

      // Specular highlight (small lobe near light)
      const spec = ctx.createRadialGradient(
        lightX,
        lightY,
        0,
        lightX,
        lightY,
        radius * 0.45,
      );
      spec.addColorStop(0, "rgba(255,255,255,0.7)");
      spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(lightX, lightY, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Contact shadow on the floor
      const sh = ctx.createRadialGradient(
        cx,
        cy + radius * 1.05,
        0,
        cx,
        cy + radius * 1.05,
        radius * 1.1,
      );
      sh.addColorStop(0, "rgba(0,0,0,0.45)");
      sh.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sh;
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy + radius * 1.05,
        radius * 1.05,
        radius * 0.18,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Particles
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life > p.ttl) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += 320 * dt;
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const a = 1 - p.life / p.ttl;
        ctx.fillStyle = `rgba(212,255,58,${a * 0.85})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const tick = (t: number) => {
      drawBall(t);
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
          if (visible && !raf) {
            lastT = performance.now();
            raf = requestAnimationFrame(tick);
          } else if (!visible && raf) {
            cancelAnimationFrame(raf);
            raf = 0;
          }
        }
      },
      { threshold: 0.01 },
    );

    resize();
    io.observe(wrap);
    raf = requestAnimationFrame(tick);

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={className}
      aria-hidden
      style={{ touchAction: "none" }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
