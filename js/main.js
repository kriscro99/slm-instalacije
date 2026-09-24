(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Loader ---------- */
  const loader = $('.loader');
  const ready = () => {
    root.classList.add('is-ready');
    try { sessionStorage.setItem('slm-seen', '1'); } catch (e) {}
  };

  if (!loader || root.classList.contains('skip-loader')) {
    loader && loader.remove();
    requestAnimationFrame(ready);
  } else {
    const started = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      loader.classList.add('is-done');
      setTimeout(ready, 280);
      setTimeout(() => loader.remove(), 1200);
    };
    const whenLoaded = () => setTimeout(finish, Math.max(0, 1650 - (performance.now() - started)));
    if (document.readyState === 'complete') whenLoaded();
    else window.addEventListener('load', whenLoaded, { once: true });
    setTimeout(finish, 3800);
  }

  /* ---------- Split riječi ---------- */
  $$('[data-split]').forEach((el) => {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.textContent = part;
            inner.style.setProperty('--i', i++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
  });

  /* ---------- Reveal ---------- */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Izbornik ---------- */
  const burger = $('.burger');
  const menu = $('#menu');
  const setMenu = (open) => {
    root.classList.toggle('menu-open', open);
    root.classList.toggle('html-lock', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Zatvori izbornik' : 'Otvori izbornik');
    menu.setAttribute('aria-hidden', String(!open));
  };
  burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', () => { if (window.innerWidth >= 1040) setMenu(false); });

  /* ---------- Skrol: zaglavlje, napredak, cijev, ventil, dock ---------- */
  const header = $('.header');
  const progress = $('.progress span');
  const hero = $('.hero');
  const steps = $('[data-steps]');
  const stepItems = steps ? $$('.step', steps) : [];
  const valve = $('.urgent__valve');
  const dock = $('.dock');
  const contact = $('#kontakt');
  const navLinks = $$('.nav a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);

  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const docH = document.documentElement.scrollHeight - vh;

    header.classList.toggle('is-scrolled', y > 24);
    progress.style.setProperty('--p', docH > 0 ? clamp(y / docH, 0, 1) : 0);

    // Cijev u "Kako radimo" puni se vodom
    if (steps) {
      const r = steps.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        const start = r.top + 30;
        const len = r.height - 60;
        const mark = vh * 0.62;
        const p = clamp((mark - start) / len, 0, 1);
        steps.style.setProperty('--p', p.toFixed(4));
        stepItems.forEach((li) => {
          const node = li.querySelector('.step__node');
          const nr = node.getBoundingClientRect();
          li.classList.toggle('is-wet', nr.top + nr.height / 2 <= mark + 2);
        });
      }
    }

    // Ventil se okreće dok skrolate
    if (valve) {
      const r = valve.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) valve.style.setProperty('--rot', `${(r.top * -0.35).toFixed(1)}deg`);
    }

    // Traka za poziv (mobitel)
    if (dock) {
      const heroEnd = hero.offsetHeight * 0.7;
      const cr = contact.getBoundingClientRect();
      const nearContact = cr.top < vh * 0.75 && cr.bottom > vh * 0.2;
      dock.classList.toggle('is-visible', y > heroEnd && !nearContact && !root.classList.contains('menu-open'));
    }

    // Aktivna poveznica u navigaciji
    let active = null;
    sections.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      if (r.top <= vh * 0.4 && r.bottom > vh * 0.4) active = navLinks[i];
    });
    navLinks.forEach((a) => a.classList.toggle('is-active', a === active));
  };
  const requestTick = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  onScroll();

  /* ---------- Mjehurići u heroju ---------- */
  const canvas = $('.hero__bubbles');
  if (canvas && canvas.getContext && !reduceMotion) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, bubbles = [], running = false, raf = 0;

    const make = (initial) => {
      const r = Math.random() * 5 + 1.5;
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + r + Math.random() * 60,
        r,
        vy: Math.random() * 0.45 + 0.25 + r * 0.04,
        amp: Math.random() * 14 + 4,
        freq: Math.random() * 0.02 + 0.006,
        phase: Math.random() * Math.PI * 2,
        a: Math.random() * 0.35 + 0.15
      };
    };
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 700 ? 26 : 48;
      bubbles = Array.from({ length: count }, () => make(true));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const b of bubbles) {
        b.y -= b.vy;
        b.phase += b.freq;
        const x = b.x + Math.sin(b.phase) * b.amp;
        if (b.y < -20) Object.assign(b, make(false));
        const fade = clamp(b.y / (h * 0.35), 0, 1);
        ctx.beginPath();
        ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(127,220,255,${b.a * fade})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${b.a * fade * 1.2})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(draw); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    resize();
    let rw = window.innerWidth;
    window.addEventListener('resize', () => {
      // iOS mijenja visinu pri skrolanju (traka adrese) — reagiraj samo na promjenu širine
      if (window.innerWidth !== rw) { rw = window.innerWidth; resize(); }
    });
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(canvas);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }

  /* ---------- 3D nagib loga (desktop) ---------- */
  const badge = $('[data-tilt]');
  if (badge && finePointer && !reduceMotion) {
    hero.addEventListener('pointermove', (e) => {
      const r = badge.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      badge.style.setProperty('--ry', `${(dx * 22).toFixed(2)}deg`);
      badge.style.setProperty('--rx', `${(-dy * 22).toFixed(2)}deg`);
    });
    hero.addEventListener('pointerleave', () => {
      badge.style.setProperty('--ry', '0deg');
      badge.style.setProperty('--rx', '0deg');
    });
  }

  /* ---------- Magnetni gumbi (desktop) ---------- */
  if (finePointer && !reduceMotion) {
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Kapljica/val na dodir ---------- */
  if (!reduceMotion) {
    let last = 0;
    document.addEventListener('pointerdown', (e) => {
      const now = performance.now();
      if (now - last < 90) return;
      last = now;
      if (e.target.closest('input, textarea, label')) return;
      for (let k = 0; k < 2; k++) {
        const t = document.createElement('span');
        t.className = k ? 'tap tap--2' : 'tap';
        t.style.left = `${e.clientX}px`;
        t.style.top = `${e.clientY}px`;
        document.body.appendChild(t);
        t.addEventListener('animationend', () => t.remove(), { once: true });
      }
    }, { passive: true });
  }

  /* ---------- Obavijest ---------- */
  const toast = $('.toast');
  let toastTimer = 0;
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2400);
  };

  /* ---------- Kopiranje broja ---------- */
  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        try { ok = document.execCommand('copy'); } catch (err) {}
        ta.remove();
      }
      showToast(ok ? 'Broj je kopiran: 099 299 6301' : 'Broj: 099 299 6301');
    });
  });

  /* ---------- Brza poruka → SMS ---------- */
  const form = $('[data-quick]');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const ime = (data.get('ime') || '').toString().trim();
      const mjesto = (data.get('mjesto') || '').toString().trim();
      const vrsta = (data.get('vrsta') || '').toString().trim();
      const opis = (data.get('opis') || '').toString().trim();

      if (!opis && !mjesto) {
        showToast('Upišite barem mjesto ili kratak opis');
        $('#q-msg').focus();
        return;
      }

      const lines = [
        `Pozdrav${ime ? `, ovdje ${ime}` : ''}!`,
        `Trebam vodoinstalatera${vrsta ? ` — ${vrsta}` : ''}.`
      ];
      if (mjesto) lines.push(`Lokacija: ${mjesto}`);
      if (opis) lines.push(opis);
      const body = encodeURIComponent(lines.join('\n'));
      window.location.href = `sms:+385992996301?&body=${body}`;
    });
  }

  /* ---------- Godina ---------- */
  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
