(() => {
  const FLAG = "acidity-transit";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const INTERNAL = [
    /^\/$/,
    /^\/studio\/?$/,
    /^\/apps\/?$/,
    /^\/web\/?$/,
    /^\.\/$/,
    /^\.\.\/$/,
    /^\.\.\/studio\/?$/,
    /^\.\.\/apps\/?$/,
    /^\.\.\/web\/?$/,
    /^studio\/?$/,
    /^apps\/?$/,
    /^web\/?$/,
  ];

  const isInternalNav = (a) => {
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:"))
      return false;
    let url;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return false;
    }
    if (url.origin !== window.location.origin) return false;
    const path = url.pathname.replace(/\/index\.html$/, "/").replace(/\/+$/, "/") || "/";
    const rel = href.split(/[?#]/)[0];
    if (
      path === "/" ||
      path === "/studio/" ||
      path === "/apps/" ||
      path === "/web/" ||
      path === "/studio" ||
      path === "/apps" ||
      path === "/web"
    ) {
      const cur =
        window.location.pathname.replace(/\/index\.html$/, "/").replace(/\/+$/, "/") || "/";
      const norm = path.endsWith("/") || path === "/" ? path : path + "/";
      const curN = cur.endsWith("/") || cur === "/" ? cur : cur + "/";
      if (norm === curN) return false;
      return true;
    }
    return INTERNAL.some((re) => re.test(rel));
  };

  const ensureVeil = () => {
    let veil = document.querySelector(".route-veil");
    if (veil) return veil;
    veil = document.createElement("div");
    veil.className = "route-veil";
    veil.setAttribute("aria-hidden", "true");
    veil.innerHTML = '<span class="route-veil-line"></span><span class="route-veil-panel"></span>';
    document.body.appendChild(veil);
    return veil;
  };

  const veil = ensureVeil();

  /* Arrive: play exit if flagged */
  if (sessionStorage.getItem(FLAG) === "1") {
    sessionStorage.removeItem(FLAG);
    if (!reduce) {
      veil.classList.add("is-covering");
      requestAnimationFrame(() => {
        veil.classList.add("is-leaving");
        veil.classList.remove("is-covering");
        const title = document.querySelector(".page-title, .wordmark, .web-hold h1");
        if (title && typeof gsap !== "undefined") {
          gsap.fromTo(
            title,
            { y: 28, filter: "blur(8px)", opacity: 0.35 },
            { y: 0, filter: "blur(0px)", opacity: 1, duration: 0.55, ease: "power3.out", delay: 0.05 }
          );
        }
        window.setTimeout(() => {
          veil.classList.remove("is-leaving");
        }, 420);
      });
    }
  }

  if (reduce) return;

  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest("a[href]");
      if (!isInternalNav(a)) return;
      e.preventDefault();
      const href = a.href;
      sessionStorage.setItem(FLAG, "1");
      veil.classList.add("is-covering");
      window.setTimeout(() => {
        window.location.href = href;
      }, 320);
    },
    true
  );
})();
