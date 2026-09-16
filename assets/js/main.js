(() => {
  const root = document.documentElement;
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
  if (!location.hash) window.scrollTo(0, 0);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) root.classList.add("reduce-motion");

  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-primary-nav]");
  if (toggle && nav) {
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
  }

  /* Warm internal pages early so hops feel instant under view transitions */
  const prefetched = new Set();
  const prefetch = (href) => {
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return;
      if (url.hash && url.pathname === location.pathname) return;
      const key = url.pathname;
      if (prefetched.has(key) || key === location.pathname) return;
      prefetched.add(key);
      const link = document.createElement("link");
      // Prefetch only — prerender fights soft hops (esp. Home) and causes stuck nav
      link.rel = "prefetch";
      link.href = url.href;
      link.as = "document";
      document.head.appendChild(link);
    } catch {}
  };
  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("http")) {
      // allow same-origin absolute later via URL check inside prefetch
    }
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
    a.addEventListener("pointerenter", () => prefetch(href), { once: true });
    a.addEventListener("focus", () => prefetch(href), { once: true });
    a.addEventListener("touchstart", () => prefetch(href), { once: true, passive: true });
  });
  // Warm primary nav targets immediately
  document.querySelectorAll(".primary-nav a[href], .explore-card[href]").forEach((a) => {
    prefetch(a.getAttribute("href"));
  });

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();
