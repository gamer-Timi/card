/* In-game 3D coin and dice renderer / rigid-body animation.
   The camera, cylinder and cube geometry are deliberately small and local:
   the game can play a physical coin toss and a five-dice drop without an
   iframe, a WebGL context, or an external 3D library. */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  function v(x, y, z) { return { x: x, y: y, z: z }; }
  function add(a, b) { return v(a.x + b.x, a.y + b.y, a.z + b.z); }
  function sub(a, b) { return v(a.x - b.x, a.y - b.y, a.z - b.z); }
  function mul(a, s) { return v(a.x * s, a.y * s, a.z * s); }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) {
    return v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { const l = len(a) || 1; return mul(a, 1 / l); }

  function qAxis(axis, angle) {
    const h = angle / 2;
    const s = Math.sin(h);
    return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(h) };
  }
  function qMul(a, b) {
    return {
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
    };
  }
  function qNorm(q) {
    const l = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w) || 1;
    q.x /= l; q.y /= l; q.z /= l; q.w /= l;
    return q;
  }
  function qRot(q, p) {
    const ix = q.w * p.x + q.y * p.z - q.z * p.y;
    const iy = q.w * p.y + q.z * p.x - q.x * p.z;
    const iz = q.w * p.z + q.x * p.y - q.y * p.x;
    const iw = -q.x * p.x - q.y * p.y - q.z * p.z;
    return {
      x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
      y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
      z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x
    };
  }
  function qSlerp(a, b, t) {
    let bx = b.x, by = b.y, bz = b.z, bw = b.w;
    let cos = a.x * bx + a.y * by + a.z * bz + a.w * bw;
    if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    if (cos > 0.9995) {
      return qNorm({ x: a.x + (bx - a.x) * t, y: a.y + (by - a.y) * t, z: a.z + (bz - a.z) * t, w: a.w + (bw - a.w) * t });
    }
    const theta = Math.acos(Math.max(-1, Math.min(1, cos)));
    const sin = Math.sin(theta);
    const wa = Math.sin((1 - t) * theta) / sin;
    const wb = Math.sin(t * theta) / sin;
    return qNorm({ x: a.x * wa + bx * wb, y: a.y * wa + by * wb, z: a.z * wa + bz * wb, w: a.w * wa + bw * wb });
  }
  function integrate(q, omega, dt) {
    const dq = qMul({ x: omega.x, y: omega.y, z: omega.z, w: 0 }, q);
    q.x += dq.x * 0.5 * dt;
    q.y += dq.y * 0.5 * dt;
    q.z += dq.z * 0.5 * dt;
    q.w += dq.w * 0.5 * dt;
    return qNorm(q);
  }

  function makeCamera(cx, cy, screenRadius, radius) {
    const eye = v(0, 4.6, 7.1);
    const target = v(0, 0, 0);
    const forward = norm(sub(target, eye));
    const right = norm(cross(forward, v(0, 1, 0)));
    const up = cross(right, forward);
    const origin = sub(v(0, 0, 0), eye);
    const z0 = dot(origin, forward);
    const focal = screenRadius * z0 / radius;
    return {
      eye: eye,
      project: function (p) {
        const d = sub(p, eye);
        const z = dot(d, forward);
        const iz = z <= 0.01 ? 0.01 : z;
        return {
          x: cx + dot(d, right) * focal / iz,
          y: cy - dot(d, up) * focal / iz,
          z: z
        };
      }
    };
  }

  function makeCoinTexture(face) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const x = c.getContext('2d');
    x.save();
    x.translate(128, 128);
    const g = x.createRadialGradient(-42, -52, 8, 0, 0, 128);
    g.addColorStop(0, '#fff4cb');
    g.addColorStop(0.22, '#f0ce86');
    g.addColorStop(0.53, '#c9954b');
    g.addColorStop(0.8, '#956326');
    g.addColorStop(1, '#674316');
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, 0, 124, 0, TAU);
    x.fill();
    x.strokeStyle = 'rgba(255, 241, 186, 0.8)';
    x.lineWidth = 3;
    x.stroke();
    x.strokeStyle = 'rgba(88, 52, 13, 0.42)';
    x.lineWidth = 1.5;
    x.beginPath(); x.arc(0, 0, 112, 0, TAU); x.stroke();
    x.beginPath(); x.arc(0, 0, 105, 0, TAU); x.stroke();
    x.fillStyle = 'rgba(255, 247, 214, 0.24)';
    x.beginPath();
    x.ellipse(-38, -50, 58, 30, -0.5, 0, TAU);
    x.fill();
    x.fillStyle = 'rgba(66, 37, 6, 0.9)';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = '700 132px "Noto Serif SC", "Songti SC", "SimSun", serif';
    x.fillText(face, 0, 7);
    x.font = '600 15px "Noto Serif SC", serif';
    x.fillStyle = 'rgba(69, 39, 7, 0.6)';
    x.fillText(face === '先' ? 'F I R S T' : 'S E C O N D', 0, 86);
    x.restore();
    return c;
  }

  function drawCoinShadow(ctx, cam, x, y, z, radius, height) {
    const p = cam.project(v(x, 0, z));
    const h = Math.max(0, height);
    ctx.save();
    ctx.globalAlpha = Math.max(0.06, 0.32 - h * 0.04);
    ctx.filter = 'blur(7px)';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.22, radius * (1.1 + h * 0.12), radius * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawCoin(ctx, cam, q, pos, R, T, textures) {
    const ax = qRot(q, v(1, 0, 0));
    const ay = qRot(q, v(0, 1, 0));
    const az = qRot(q, v(0, 0, 1));
    const front = add(pos, mul(az, T / 2));
    const back = sub(pos, mul(az, T / 2));
    const eye = cam.eye;
    const sideN = norm(cross(ax, ay));

    // The edge/rim first. It is a real cylinder wall, one quad per segment.
    const N = 72;
    for (let i = 0; i < N; i++) {
      const a0 = i / N * TAU;
      const a1 = (i + 1) / N * TAU;
      const r0 = add(mul(ax, Math.cos(a0) * R), mul(ay, Math.sin(a0) * R));
      const r1 = add(mul(ax, Math.cos(a1) * R), mul(ay, Math.sin(a1) * R));
      const mid = add(pos, mul(add(r0, r1), 0.5));
      if (dot(norm(add(r0, r1)), sub(eye, mid)) <= 0) continue;
      const p0 = cam.project(add(front, r0));
      const p1 = cam.project(add(front, r1));
      const p2 = cam.project(add(back, r1));
      const p3 = cam.project(add(back, r0));
      const shade = 0.55 + 0.45 * Math.max(0, dot(norm(add(r0, r1)), norm(sub(eye, mid))));
      ctx.fillStyle = 'rgb(' + Math.round(116 * shade) + ',' + Math.round(78 * shade) + ',' + Math.round(30 * shade) + ')';
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath();
      ctx.fill();
      if (i % 3 === 0) {
        ctx.strokeStyle = 'rgba(52, 31, 6, 0.35)';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p3.x, p3.y); ctx.stroke();
      }
    }

    function faceVisible(center, normal) {
      return dot(normal, sub(eye, center)) > 0;
    }
    function drawFace(center, normal, texture, mirror) {
      if (!faceVisible(center, normal)) return;
      const u = mirror ? mul(ax, -1) : ax;
      const vv = ay;
      const pC = cam.project(center);
      const pU = cam.project(add(center, mul(u, R)));
      const pV = cam.project(add(center, mul(vv, R)));
      const U = sub(pU, pC);
      const V = sub(pV, pC);
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU;
        const p = cam.project(add(center, add(mul(u, Math.cos(a) * R), mul(vv, Math.sin(a) * R))));
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.clip();
      ctx.transform(
        U.x / 128, U.y / 128,
        -V.x / 128, -V.y / 128,
        pC.x - U.x + V.x, pC.y - U.y + V.y
      );
      ctx.drawImage(texture, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 244, 198, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU;
        const p = cam.project(add(center, add(mul(u, Math.cos(a) * R), mul(vv, Math.sin(a) * R))));
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // The face whose normal points more toward the camera is the visible one.
    if (dot(az, sub(eye, pos)) >= 0) {
      drawFace(front, az, textures.front, false);
    } else {
      drawFace(back, mul(az, -1), textures.back, true);
    }
  }

  function coin(canvas, options) {
    const opts = options || {};
    const width = opts.width;
    const height = opts.height;
    const dpr = opts.dpr || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    let ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (err) { ctx = null; }
    if (!ctx) {
      setTimeout(function () { if (opts.onDone) opts.onDone(); }, 900);
      return { cancel: function () {} };
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const R = 0.9;
    const T = 0.14;
    const cam = makeCamera(opts.tableX, opts.tableY, opts.radius, R);
    const result = opts.result === '后' ? '后' : '先';
    const textures = { front: makeCoinTexture('先'), back: makeCoinTexture('后') };
    let pos = v(0, 2.55, 0);
    let vel = v(0, 4.45, 0);
    let q = qNorm(qAxis(norm(v(0.6, 1, 0.35)), 0.45));
    let omega = v(8.6, 2.4, 4.2);
    let last = performance.now();
    let started = last;
    let targetQ = null;
    let guideAt = 0;
    let restAt = 0;
    let raf = 0;
    let done = false;
    const GRAVITY = -13.5;

    function support(qq) {
      const n = qRot(qq, v(0, 0, 1));
      const c = Math.min(1, Math.abs(n.y));
      return T / 2 * c + R * Math.sqrt(Math.max(0, 1 - c * c));
    }

    function tick(now) {
      if (done) return;
      const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
      last = now;

      if (!targetQ && now - started > 1100) {
        const base = result === '后' ? Math.PI / 2 : -Math.PI / 2;
        targetQ = qMul(qAxis(v(0, 1, 0), 0.35), qAxis(v(1, 0, 0), base));
        guideAt = now;
      }

      vel.y += GRAVITY * dt;
      pos.y += vel.y * dt;

      if (targetQ) {
        const t = Math.min(1, (now - guideAt) / 1100);
        const e = 1 - Math.pow(1 - t, 3);
        q = qSlerp(q, targetQ, Math.min(1, 0.05 + e * 0.12));
        omega = mul(omega, 0.9);
      } else {
        integrate(q, omega, dt);
        omega = mul(omega, 1 - 0.22 * dt);
      }

      const s = support(q);
      if (pos.y < s) {
        pos.y = s;
        if (Math.abs(vel.y) > 18) {
          vel.y = -vel.y * 0.42;
          omega = mul(omega, 0.6);
        } else {
          vel.y = 0;
        }
      }

      const n = qRot(q, v(0, 0, 1));
      const flat = Math.abs(n.y) > 0.992;
      if (targetQ && flat && Math.abs(vel.y) < 2 && now - guideAt > 1100) {
        if (!restAt) restAt = now;
        if (now - restAt > 600) {
          done = true;
          pos.y = T / 2;
          q = targetQ;
          draw();
          if (opts.onDone) opts.onDone(result);
          return;
        }
      } else {
        restAt = 0;
      }

      draw();
      raf = requestAnimationFrame(tick);
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      drawCoinShadow(ctx, cam, 0, 0, 0, opts.radius, Math.max(0, pos.y - T / 2));
      drawCoin(ctx, cam, q, pos, R, T, textures);
    }

    draw();
    raf = requestAnimationFrame(tick);
    return {
      cancel: function () {
        done = true;
        if (raf) cancelAnimationFrame(raf);
      }
    };
  }

  /* ------------------------------- dice ---------------------------------- */
  function faceDefs(value) {
    const right = (value % 6) + 1;
    const top = ((value + 1) % 6) + 1;
    return [
      { n: v(0, 1, 0), u: v(1, 0, 0), vv: v(0, 0, 1), value: value },
      { n: v(0, -1, 0), u: v(1, 0, 0), vv: v(0, 0, -1), value: 7 - value },
      { n: v(0, 0, 1), u: v(1, 0, 0), vv: v(0, 1, 0), value: top },
      { n: v(0, 0, -1), u: v(-1, 0, 0), vv: v(0, 1, 0), value: 7 - top },
      { n: v(1, 0, 0), u: v(0, 0, -1), vv: v(0, 1, 0), value: right },
      { n: v(-1, 0, 0), u: v(0, 0, 1), vv: v(0, 1, 0), value: 7 - right }
    ];
  }

  const PIPS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };

  function drawDiceShadow(ctx, cam, p, S, height) {
    const q = cam.project(v(p.x, 0, p.z));
    const q2 = cam.project(v(p.x + S, 0, p.z));
    const size = Math.max(12, Math.abs(q2.x - q.x) * 1.05);
    const h = Math.max(0, height);
    ctx.save();
    ctx.globalAlpha = Math.max(0.06, 0.3 - h * 0.035);
    ctx.filter = 'blur(6px)';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(q.x, q.y + size * 0.22, size * 1.0, size * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function roundedPath(ctx, corners, radius) {
    const n = corners.length;
    const rr = Math.max(1, Math.min(radius, len(sub(corners[0], corners[1])) * 0.45, len(sub(corners[1], corners[2])) * 0.45));
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = corners[i];
      const prev = corners[(i + n - 1) % n];
      const next = corners[(i + 1) % n];
      const a = add(p, mul(norm(sub(prev, p)), rr));
      const b = add(p, mul(norm(sub(next, p)), rr));
      if (i === 0) ctx.moveTo(a.x, a.y);
      else ctx.lineTo(a.x, a.y);
      ctx.quadraticCurveTo(p.x, p.y, b.x, b.y);
    }
    ctx.closePath();
  }

  function drawDie(ctx, cam, die, values) {
    const q = die.q;
    const pos = die.pos;
    const S = die.S;
    const axes = [qRot(q, v(1, 0, 0)), qRot(q, v(0, 1, 0)), qRot(q, v(0, 0, 1))];
    const faces = faceDefs(values[die.index]);
    const eye = cam.eye;
    const visible = [];

    for (const f of faces) {
      const n = qRot(q, f.n);
      const center = add(pos, mul(n, S));
      if (dot(n, sub(eye, center)) <= 0) continue;
      const u = qRot(q, f.u);
      const vv = qRot(q, f.vv);
      const corners = [
        add(center, add(mul(u, S), mul(vv, S))),
        add(center, add(mul(u, -S), mul(vv, S))),
        add(center, add(mul(u, -S), mul(vv, -S))),
        add(center, add(mul(u, S), mul(vv, -S)))
      ].map(cam.project);
      const depth = (cam.project(center).z + corners.reduce((a, c) => a + c.z, 0)) / 5;
      visible.push({ f, n, center, u, vv, corners, depth });
    }
    visible.sort((a, b) => b.depth - a.depth);

    for (const item of visible) {
      const light = Math.max(0, dot(item.n, norm(v(-0.45, 0.8, 0.55))));
      const shade = 0.64 + light * 0.32;
      ctx.fillStyle = 'rgb(' + Math.round(242 * shade) + ',' + Math.round(232 * shade) + ',' + Math.round(205 * shade) + ')';
      roundedPath(ctx, item.corners, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(108, 84, 49, 0.36)';
      ctx.lineWidth = 1.1;
      ctx.stroke();

      const inset = [0.86, 0.88, 0.84, 0.86].map((s, i) => {
        const center = item.center;
        return cam.project(add(center, add(mul(item.u, (i === 0 || i === 3 ? 1 : -1) * S * s), mul(item.vv, (i < 2 ? 1 : -1) * S * s))));
      });
      ctx.fillStyle = 'rgba(255, 251, 235, 0.18)';
      roundedPath(ctx, inset, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(115, 88, 50, 0.2)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      const pipR = Math.max(1.5, len(sub(cam.project(add(item.center, mul(item.u, S * 0.1))), cam.project(item.center))) * 0.78);
      const positions = PIPS[item.f.value] || [];
      for (const idx of positions) {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const a = (col - 1) * 0.53;
        const b = (1 - row) * 0.53;
        const p = cam.project(add(item.center, add(mul(item.u, a * S), mul(item.vv, b * S))));
        ctx.fillStyle = 'rgba(38, 33, 26, 0.92)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.2, pipR), 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.beginPath();
        ctx.arc(p.x - pipR * 0.2, p.y - pipR * 0.2, Math.max(0.5, pipR * 0.35), 0, TAU);
        ctx.fill();
      }
    }
  }

  function dice(canvas, options) {
    const opts = options || {};
    const width = opts.width;
    const height = opts.height;
    const dpr = opts.dpr || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    let ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (err) { ctx = null; }
    if (!ctx) {
      setTimeout(function () { if (opts.onDone) opts.onDone(); }, 900);
      return { cancel: function () {} };
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = 0.3;
    const cam = makeCamera(opts.tableX, opts.tableY, opts.radius, 0.9);
    const values = (opts.values || [1, 2, 3, 4, 5]).slice(0, 5);
    const diceState = values.map((value, i) => ({
      index: i,
      S: S,
      pos: v((i - 2) * 0.84, 3.2 + i * 0.14, (i % 2 ? -0.16 : 0.14)),
      vel: v((i - 2) * 0.14, 1.2 + (i % 3) * 0.25, (i % 2 ? -0.1 : 0.08)),
      q: qNorm(qAxis(norm(v(0.7 + i * 0.11, 1, 0.35 + i * 0.09)), 0.5 + i * 0.14)),
      omega: v(4.8 + i * 0.42, 3.1 + i * 0.35, 3.9 + i * 0.27),
      targetQ: qNorm(qAxis(v(0, 1, 0), 0.18 + i * 0.16)),
      targetX: (i - 2) * 0.84,
      targetZ: 0
    }));
    let last = performance.now();
    let started = last;
    let settleAt = 0;
    let restAt = 0;
    let raf = 0;
    let done = false;
    const GRAVITY = -15;

    function support(d) {
      const ax = qRot(d.q, v(1, 0, 0));
      const ay = qRot(d.q, v(0, 1, 0));
      const az = qRot(d.q, v(0, 0, 1));
      return S * (Math.abs(ax.y) + Math.abs(ay.y) + Math.abs(az.y));
    }

    function tick(now) {
      if (done) return;
      const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
      last = now;
      if (!settleAt) {
        for (const d of diceState) {
          d.vel.y += GRAVITY * dt;
          d.pos = add(d.pos, mul(d.vel, dt));
          integrate(d.q, d.omega, dt);
          d.omega = mul(d.omega, 1 - 0.18 * dt);
          const s = support(d);
          if (d.pos.y < s) {
            d.pos.y = s;
            d.vel.y = -d.vel.y * 0.35;
            d.vel.x *= 0.72;
            d.vel.z *= 0.72;
            d.omega = mul(d.omega, 0.7);
          }
        }
        // Cheap but effective sphere separation stops the cubes visibly
        // interpenetrating while they bounce.
        for (let i = 0; i < diceState.length; i++) {
          for (let j = i + 1; j < diceState.length; j++) {
            const a = diceState[i];
            const b = diceState[j];
            const delta = sub(b.pos, a.pos);
            const dist = len(delta) || 0.001;
            const minDist = S * 2.02;
            if (dist < minDist) {
              const n = mul(delta, 1 / dist);
              const push = (minDist - dist) * 0.5;
              a.pos = sub(a.pos, mul(n, push));
              b.pos = add(b.pos, mul(n, push));
              const rel = dot(sub(b.vel, a.vel), n);
              if (rel < 0) {
                const impulse = -rel * 0.5;
                a.vel = sub(a.vel, mul(n, impulse));
                b.vel = add(b.vel, mul(n, impulse));
              }
            }
          }
        }
        if (now - started > 2200) {
          settleAt = now;
        }
      } else {
        const p = Math.min(1, (now - settleAt) / 850);
        const e = 1 - Math.pow(1 - p, 3);
        for (const d of diceState) {
          d.q = qSlerp(d.q, d.targetQ, Math.min(1, e * 0.4));
          d.pos.x += (d.targetX - d.pos.x) * Math.min(1, e * 0.35);
          d.pos.z += (d.targetZ - d.pos.z) * Math.min(1, e * 0.35);
          d.pos.y += (S - d.pos.y) * Math.min(1, e * 0.35);
          if (p >= 1) { d.q = d.targetQ; d.pos = v(d.targetX, S, d.targetZ); }
        }
        if (p >= 1) {
          if (!restAt) restAt = now;
          if (now - restAt > 450) {
            done = true;
            draw();
            if (opts.onDone) opts.onDone();
            return;
          }
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      for (const d of diceState) drawDiceShadow(ctx, cam, d.pos, S, Math.max(0, d.pos.y - S));
      for (const d of diceState) drawDie(ctx, cam, d, values);
    }

    draw();
    raf = requestAnimationFrame(tick);
    return {
      cancel: function () {
        done = true;
        if (raf) cancelAnimationFrame(raf);
      }
    };
  }

  global.Anim3D = { coin: coin, dice: dice };
})(window);
