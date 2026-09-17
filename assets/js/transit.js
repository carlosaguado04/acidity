(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FLIP_DUR = 0.55;
  const FLIP_EASE = "power3.out";

  const sameOrigin = (url) => {
    try {
      return new URL(url, location.href).origin === location.origin;
    } catch {
      return false;
    }
  };

  const pathOf = (url) => {
    let p = new URL(url, location.href).pathname;
    if (p.endsWith("/index.html")) p = p.slice(0, -10) || "/";
    return p.replace(/\/+$/, "") || "/";
  };

  const isSoftTarget = (a) => {
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    if (!sameOrigin(href)) return false;
    if (/^https?:/i.test(href) && !href.includes(location.host)) return false;
    return true;
  };

  const syncNav = (pathname) => {
    const norm = pathOf(pathname);
    document.querySelectorAll(".primary-nav a[href]").forEach((a) => {
      if (pathOf(a.href) === norm) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  };

  const syncHeader = (doc) => {
    const shell = document.querySelector(".site-shell");
    if (!shell) return;
    const cur = document.querySelector(".site-header");
    const next = doc.querySelector(".site-header");
    const main = document.querySelector("#main");
    if (next) {
      const node = document.importNode(next, true);
      if (cur) cur.replaceWith(node);
      else if (main) main.before(node);
      else shell.prepend(node);
    } else if (cur) {
      cur.remove();
    }
  };

  const syncFooter = (doc) => {
    const curFoot = document.querySelector(".site-footer");
    const nextFoot = doc.querySelector(".site-footer");
    if (curFoot && nextFoot) curFoot.replaceWith(document.importNode(nextFoot, true));
    else if (!curFoot && nextFoot) {
      const shell = document.querySelector(".site-shell");
      if (shell) shell.appendChild(document.importNode(nextFoot, true));
    } else if (curFoot && !nextFoot) {
      curFoot.remove();
    }
  };

  const bindNav = () => {
    const toggle = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-primary-nav]");
    if (!toggle || !nav || toggle.dataset.bound === "1") return;
    toggle.dataset.bound = "1";
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  };

  const hideEntrance = () => document.documentElement.classList.add("is-entering");
  const clearEntering = () => document.documentElement.classList.remove("is-entering");

  const headingEl = (root = document) =>
    root.querySelector(".page-home .wordmark") || root.querySelector(".page-title");

  const headingText = (el) =>
    ((el && (el.getAttribute("aria-label") || el.textContent)) || "").replace(/\s+/g, " ").trim();

  const snapshotHeading = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return null;
    const cs = getComputedStyle(el);
    return {
      text: headingText(el),
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily,
      letterSpacing: cs.letterSpacing,
      color: cs.color,
    };
  };

  /** Shared title FLIP — same recipe on every soft hop, including Apps ↔ Web. */
  const flipHeading = (from, toEl) =>
    new Promise((resolve) => {
      if (!from || !toEl || typeof gsap === "undefined") {
        if (toEl && typeof gsap !== "undefined") {
          gsap.set(toEl, { autoAlpha: 1, clearProps: "opacity,visibility" });
        }
        resolve();
        return;
      }

      const last = toEl.getBoundingClientRect();
      const toCs = getComputedStyle(toEl);
      const toText = headingText(toEl);
      gsap.set(toEl, { autoAlpha: 0 });

      const layer = document.createElement("div");
      layer.className = "title-flip-layer";
      layer.setAttribute("aria-hidden", "true");
      Object.assign(layer.style, {
        position: "fixed",
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${Math.max(from.width, 1)}px`,
        height: `${Math.max(from.height, 1)}px`,
        overflow: "visible",
        zIndex: "10000",
        pointerEvents: "none",
      });

      const makeSpan = (text, snap) => {
        const s = document.createElement("span");
        s.textContent = text;
        Object.assign(s.style, {
          position: "absolute",
          left: "0",
          top: "0",
          whiteSpace: "nowrap",
          fontFamily: snap.fontFamily,
          fontSize: snap.fontSize,
          fontWeight: snap.fontWeight,
          letterSpacing: snap.letterSpacing,
          lineHeight: "1",
          color: snap.color,
          willChange: "opacity, font-size",
        });
        return s;
      };

      const oldSpan = makeSpan(from.text, from);
      const newSpan = makeSpan(toText, {
        fontFamily: toCs.fontFamily,
        fontSize: toCs.fontSize,
        fontWeight: toCs.fontWeight,
        letterSpacing: toCs.letterSpacing,
        color: toCs.color,
      });
      newSpan.style.opacity = "0";
      layer.append(oldSpan, newSpan);
      document.body.appendChild(layer);

      gsap.timeline({
        onComplete: () => {
          layer.remove();
          gsap.set(toEl, { autoAlpha: 1, clearProps: "opacity,visibility" });
          resolve();
        },
      })
        .to(
          layer,
          {
            left: last.left,
            top: last.top,
            width: Math.max(last.width, 1),
            height: Math.max(last.height, 1),
            duration: FLIP_DUR,
            ease: FLIP_EASE,
          },
          0
        )
        .to(
          oldSpan,
          {
            opacity: 0,
            fontSize: toCs.fontSize,
            fontWeight: toCs.fontWeight,
            letterSpacing: toCs.letterSpacing,
            duration: FLIP_DUR * 0.6,
            ease: "power2.out",
          },
          0
        )
        .to(
          newSpan,
          {
            opacity: 1,
            duration: FLIP_DUR * 0.55,
            ease: "power2.out",
          },
          FLIP_DUR * 0.28
        );
    });

  const swapDom = (doc) => {
    const nextMain = doc.querySelector("#main");
    if (!nextMain) throw new Error("no #main in fetched page");

    document.title = doc.title || document.title;
    document.body.className = (doc.body.className || "").replace(/\bis-booting\b/g, "").trim();

    document.querySelector("#main").replaceWith(document.importNode(nextMain, true));
    document.querySelector("[data-home-boot-pulse]")?.remove();

    syncHeader(doc);
    syncFooter(doc);

    const nextTheme = doc.querySelector('meta[name="theme-color"]');
    const curTheme = document.querySelector('meta[name="theme-color"]');
    if (nextTheme && curTheme) {
      curTheme.setAttribute("content", nextTheme.getAttribute("content") || "#070708");
    }

    syncNav(location.pathname);
    window.scrollTo(0, 0);

    if (document.body.classList.contains("page-home") && window.AcidityMotion?.parkHomeWordmark) {
      window.AcidityMotion.parkHomeWordmark();
    }

    hideEntrance();
  };

  const afterSwap = (soft) => {
    bindNav();
    if (window.AcidityMotion) {
      window.AcidityMotion.kill();
      window.AcidityMotion.init({ soft: !!soft });
    }
    requestAnimationFrame(() => clearEntering());
    if (window.AcidityInteract?.bindAll) window.AcidityInteract.bindAll();
    else if (window.AcidityInteract?.bindCards) window.AcidityInteract.bindCards();
    const year = document.querySelector("[data-year]");
    if (year) year.textContent = String(new Date().getFullYear());
  };

  const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitPaint = () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  let busy = false;

  const hop = async (url, { push = true } = {}) => {
    if (document.body.classList.contains("is-booting") || document.documentElement.classList.contains("is-booting")) {
      return;
    }
    const abs = new URL(url, location.href);
    if (pathOf(abs.href) === pathOf(location.href) && abs.hash === location.hash) return;
    if (busy) return;
    busy = true;

    try {
      const res = await fetch(abs.href, {
        headers: { Accept: "text/html" },
        credentials: "same-origin",
      });
      if (!res.ok) {
        location.href = abs.href;
        return;
      }
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      if (!doc.querySelector("#main")) {
        location.href = abs.href;
        return;
      }

      if (!reduce && document.body.classList.contains("page-home")) {
        window.AcidityMotion?.freezeHomeWordmark?.();
      }

      const from = !reduce ? snapshotHeading(headingEl()) : null;
      if (from && typeof gsap !== "undefined") {
        const cur = headingEl();
        if (cur) gsap.set(cur, { autoAlpha: 0 });
      }

      const swapOnly = () => {
        if (push) history.pushState({ soft: true }, "", abs.href);
        swapDom(doc);
        if (from && typeof gsap !== "undefined") {
          const next = headingEl();
          if (next) gsap.set(next, { autoAlpha: 0 });
        }
      };

      // Root void cut only — title hop is FLIP (same on every route).
      if (!reduce && typeof document.startViewTransition === "function") {
        const vt = document.startViewTransition(swapOnly);
        await Promise.race([vt.finished.catch(() => {}), waitMs(900)]);
      } else {
        swapOnly();
      }

      await waitPaint();
      if (from) await flipHeading(from, headingEl());
      afterSwap(true);
    } catch (err) {
      console.warn("[acidity] soft hop failed, hard nav", err);
      location.href = url;
    } finally {
      busy = false;
    }
  };

  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest("a[href]");
      if (!isSoftTarget(a)) return;
      e.preventDefault();
      hop(a.href, { push: true });
    },
    true
  );

  window.addEventListener("popstate", () => {
    const go = () => hop(location.href, { push: false });
    if (!busy) {
      go();
      return;
    }
    const started = Date.now();
    const tmr = setInterval(() => {
      if (!busy || Date.now() - started > 2000) {
        clearInterval(tmr);
        if (!busy) go();
      }
    }, 50);
  });

  bindNav();
  window.AcidityHop = { hop };
})();
