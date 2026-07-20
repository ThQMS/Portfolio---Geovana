/* bats.js — gothic-cute flavour layer, all original art drawn on canvas/SVG:
 *   1. Bat cursor trail  — little bats flap away from the pointer (desktop only)
 *   2. Ambient bats      — a few bats drifting slowly across the page background
 * Everything is decorative, honours prefers-reduced-motion and stays light on phones.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var desktop = window.matchMedia("(min-width: 768px)").matches;

  var PURPLE = "#a855f7";
  var PURPLE_SOFT = "#c084fc";
  var PINK = "#f0abfc";

  /* Draw one bat centred on (0,0): two scalloped wings + a round body and ears.
   * `flap` (0..1) raises and lowers the wingtips so it reads as flying. */
  function batPath(ctx, size, flap) {
    var w = size, lift = (flap - 0.5) * size * 0.75;
    ctx.beginPath();
    // right wing
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(w * 0.5, -lift - w * 0.25, w, -lift * 0.3);
    ctx.quadraticCurveTo(w * 0.72, lift * 0.25 + w * 0.12, w * 0.55, -lift * 0.1 + w * 0.05);
    ctx.quadraticCurveTo(w * 0.42, lift * 0.3 + w * 0.22, w * 0.22, w * 0.12);
    ctx.closePath();
    ctx.fill();
    // left wing (mirrored)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-w * 0.5, -lift - w * 0.25, -w, -lift * 0.3);
    ctx.quadraticCurveTo(-w * 0.72, lift * 0.25 + w * 0.12, -w * 0.55, -lift * 0.1 + w * 0.05);
    ctx.quadraticCurveTo(-w * 0.42, lift * 0.3 + w * 0.22, -w * 0.22, w * 0.12);
    ctx.closePath();
    ctx.fill();
    // body
    ctx.beginPath();
    ctx.ellipse(0, w * 0.04, w * 0.2, w * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    // ears
    ctx.beginPath();
    ctx.moveTo(-w * 0.16, -w * 0.18);
    ctx.lineTo(-w * 0.06, -w * 0.42);
    ctx.lineTo(-w * 0.02, -w * 0.16);
    ctx.closePath();
    ctx.moveTo(w * 0.16, -w * 0.18);
    ctx.lineTo(w * 0.06, -w * 0.42);
    ctx.lineTo(w * 0.02, -w * 0.16);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------------- 1. Bat cursor trail ---------------- */
  function batTrail() {
    if (!desktop || reduce) return;
    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "fixed", inset: "0", zIndex: "40", pointerEvents: "none" });
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var W, H;
    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);

    var bats = [], mx = 0, my = 0, moved = false, lastSpawn = 0;
    window.addEventListener("mousemove", function (e) { mx = e.clientX; my = e.clientY; moved = true; });

    function spawn() {
      bats.push({
        x: mx + (Math.random() - 0.5) * 12,
        y: my + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 1.1,
        vy: -0.5 - Math.random() * 0.9,          // they flutter upward and away
        life: 1,
        size: 5 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
        rot: (Math.random() - 0.5) * 0.4,
      });
      if (bats.length > 26) bats.splice(0, bats.length - 26);
    }

    var last = 0;
    function frame(t) {
      requestAnimationFrame(frame);
      if (window.__entranceRunning) return;   // stay quiet while the intro sweep runs; it needs the main thread
      if (t - last < 28) return;                 // ~35fps
      last = t;
      ctx.clearRect(0, 0, W, H);
      if (moved && t - lastSpawn > 90) { spawn(); lastSpawn = t; moved = false; }
      for (var i = bats.length - 1; i >= 0; i--) {
        var b = bats[i];
        b.x += b.vx; b.y += b.vy; b.vy += 0.012; b.life -= 0.016;
        if (b.life <= 0) { bats.splice(i, 1); continue; }
        var flap = 0.5 + Math.sin(t * 0.012 + b.phase) * 0.5;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot + Math.sin(t * 0.004 + b.phase) * 0.12);
        ctx.globalAlpha = b.life * 0.75;
        ctx.fillStyle = b.life > 0.6 ? PINK : PURPLE_SOFT;
        batPath(ctx, b.size, flap);
        ctx.restore();
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- 2. Ambient bats drifting across the page ---------------- */
  function ambientBats() {
    if (reduce) return;
    var canvas = document.createElement("canvas");
    canvas.id = "bats-bg";
    canvas.setAttribute("aria-hidden", "true");
    var shell = document.querySelector(".min-h-screen.bg-dark-200") || document.body;
    shell.insertBefore(canvas, shell.firstChild);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var W, H, RES = desktop ? 1 : 0.8;
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * RES); canvas.height = Math.round(H * RES);
      canvas.style.width = "100%"; canvas.style.height = "100%";
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    var N = desktop ? 7 : 4;
    var flock = [];
    for (var i = 0; i < N; i++) {
      flock.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: 0.25 + Math.random() * 0.5,
        size: 7 + Math.random() * 9,
        phase: Math.random() * Math.PI * 2,
        bob: 14 + Math.random() * 22,
      });
    }

    var last = 0, MIN_DT = desktop ? 33 : 45;
    function frame(t) {
      requestAnimationFrame(frame);
      if (window.__entranceRunning) return;   // stay quiet while the intro sweep runs; it needs the main thread
      if (t - last < MIN_DT) return;
      last = t;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < flock.length; i++) {
        var b = flock[i];
        b.x += b.vx;
        if (b.x - b.size > W) { b.x = -b.size * 2; b.y = Math.random() * H; }
        var y = b.y + Math.sin(t * 0.0011 + b.phase) * b.bob;
        var flap = 0.5 + Math.sin(t * 0.007 + b.phase) * 0.5;
        ctx.save();
        ctx.translate(b.x, y);
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = PURPLE;
        batPath(ctx, b.size, flap);
        ctx.restore();
      }
    }
    requestAnimationFrame(frame);
  }

  function boot() {
    try { batTrail(); } catch (e) {}
    try { ambientBats(); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
