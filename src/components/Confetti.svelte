<script lang="ts">
  /**
   * A short burst of confetti in the theme's colors, fired once when this mounts.
   * Skipped for people who ask for reduced motion. It never blocks taps.
   */
  import { onMount } from 'svelte';

  let canvas = $state<HTMLCanvasElement>();
  let done = $state(false);

  onMount(() => {
    if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done = true;
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const css = getComputedStyle(document.documentElement);
    const colors = ['--amber', '--teal', '--coral', '--text']
      .map((v) => css.getPropertyValue(v).trim())
      .filter(Boolean);

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Two cannons from the bottom corners, aimed up and inward.
    const pieces = Array.from({ length: Math.min(160, Math.round(w / 6)) }, (_, i) => {
      const left = i % 2 === 0;
      const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.6;
      const speed = h * (0.022 + Math.random() * 0.014);
      return {
        x: left ? 0 : w,
        y: h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 6,
        spin: Math.random() * Math.PI,
        spinSpeed: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)] ?? '#f4b942',
        round: Math.random() < 0.3,
      };
    });

    const start = performance.now();
    const length = 3200;
    let frame = 0;
    const draw = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = t > length - 800 ? Math.max(0, (length - t) / 800) : 1;
      for (const p of pieces) {
        p.vy += h * 0.0006;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.spin += p.spinSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Flat paper: squash the width as it spins.
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size * Math.abs(Math.cos(p.spin * 2)), p.size / 2);
        }
        ctx.restore();
      }
      if (t < length) frame = requestAnimationFrame(draw);
      else done = true;
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  });
</script>

{#if !done}
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
{/if}

<style>
  canvas {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 50;
  }
</style>
