(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sameOrigin = (url) => {
    try {
      const u = new URL(url, location.href);
      return u.origin === location.origin;
    } catch {
      return false;
    }
  };

  const pathOf = (url) => {
    let p = new URL(url, location.href).pathname;
    if (p.endsWith("/index.html")) p = p.slice(0, -10) || "/";
    p = p.replace(/\/+$/, "") || "/";
    return p;
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
      const p = pathOf(a.href);
      if (p === norm) a.setAttribute("aria-current", "page");
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
    if (curFoot && nextFoot) {
      curFoot.replaceWith(document.importNode(nextFoot, true));
    } else if (!curFoot && nextFoot) {
      const shell = document.querySelector(".site-shell");
      if (shell) shell.appendChild(document.importNode(nextFoot, true));
    } else if (curFoot && !nextFoot) {
      curFoot.remove();
    }
  };

  const bindNav = () => {
    const toggle = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-primary-nav]");
    if (!toggle || !nav) return;
    if (toggle.dataset.bound === "1") return;
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

  /** CSS-only lock during soft hop — never touch page-title (morph). */
  const hideEntrance = () => {
    document.documentElement.classList.add("is-entering");
  };

  const clearEntering = () => {
    // Only drop the CSS lock. Never strip inline opacity — that wiped GSAP's
    // primed autoAlpha:0 and caused "visible then settle" flashes.
    document.documentElement.classList.remove("is-entering");
  };

  const swapDom = (doc) => {
    const nextMain = doc.querySelector("#main");
    if (!nextMain) throw new Error("no #main in fetched page");

    document.title = doc.title || document.title;
    // Never carry is-booting across soft hops
    document.body.className = (doc.body.className || "").replace(/\bis-booting\b/g, "").trim();

    const curMain = document.querySelector("#main");
    curMain.replaceWith(document.importNode(nextMain, true));
    document.querySelector("[data-home-boot-pulse]")?.remove();

    syncHeader(doc);
    syncFooter(doc);

    const nextTheme = doc.querySelector('meta[name="theme-color"]');
    const curTheme = document.querySelector('meta[name="theme-color"]');
    if (nextTheme && curTheme) curTheme.setAttribute("content", nextTheme.getAttribute("content") || "#070708");

    syncNav(location.pathname);
    window.scrollTo(0, 0);

    // Park home wordmark before the new VT snapshot so inner titles morph into Acidity
    if (document.body.classList.contains("page-home") && window.AcidityMotion?.parkHomeWordmark) {
      window.AcidityMotion.parkHomeWordmark();
    }

    // Must run inside the VT update callback so the "new" snapshot is already hidden
    hideEntrance();
  };

  const afterSwap = (soft) => {
    bindNav();
    if (window.AcidityMotion) {
      window.AcidityMotion.kill();
      window.AcidityMotion.init({ soft: !!soft });
    }
    // Next frame: GSAP opacity:0 is committed, then drop CSS lock
    requestAnimationFrame(() => {
      clearEntering();
      document.documentElement.classList.remove("vt-from-home", "vt-to-home");
    });
    if (window.AcidityInteract && window.AcidityInteract.bindAll) {
      window.AcidityInteract.bindAll();
    } else if (window.AcidityInteract && window.AcidityInteract.bindCards) {
      window.AcidityInteract.bindCards();
    }
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
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      if (!doc.querySelector("#main")) {
        location.href = abs.href;
        return;
      }

      const fromHome = document.body.classList.contains("page-home");
      const toHome = pathOf(abs.href) === "/";
      if (!reduce) {
        if (fromHome) {
          document.documentElement.classList.add("vt-from-home");
          window.AcidityMotion?.freezeHomeWordmark?.();
        }
        if (toHome) document.documentElement.classList.add("vt-to-home");
      }

      const swapOnly = () => {
        if (push) history.pushState({ soft: true }, "", abs.href);
        swapDom(doc);
      };

      if (!reduce && typeof document.startViewTransition === "function") {
        const vt = document.startViewTransition(swapOnly);
        // finished can hang — cap wait; content stays hidden via is-entering + inline
        await Promise.race([vt.finished.catch(() => {}), waitMs(900)]);
        await waitPaint();
        afterSwap(true);
      } else {
        swapOnly();
        await waitPaint();
        afterSwap(true);
      }
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
