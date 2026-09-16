(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof gsap === "undefined") {
    console.warn("[acidity] GSAP missing — motion skipped");
    document.body.classList.remove("is-booting");
    document.documentElement.classList.remove("is-booting");
    document.querySelector("[data-home-story]")?.classList.add("is-ready");
    document.querySelectorAll(".wordmark .char").forEach((el) => {
      el.style.opacity = "1";
    });
    window.AcidityMotion = { init() {}, kill() {} };
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const kill = () => {
    try {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    } catch {}
    try {
      // Only kill page motion targets — never gsap.killTweensOf("*") (breaks floats/hover)
      const targets = document.querySelectorAll(
        ".wordmark, .wordmark .char, .wordmark-load, .hero-line, [data-card], [data-about-line], .talk-card, .app-card, .reveal, [data-explore-deck]"
      );
      gsap.killTweensOf(targets);
    } catch {}
  };

  const init = ({ soft = false } = {}) => {
    if (reduce) return;
    kill();

    // Soft hops: content already in place — no settle. First loads may animate.
    window.__hadVt = !!soft;

    const wordmark = document.querySelector("[data-split]");
    const story = document.querySelector("[data-home-story]");
    const heroLine = document.querySelector(".hero-line");
    const cards = gsap.utils.toArray("[data-card]");

    /* —— Home —— */
    if (wordmark && story) {
      const text = (wordmark.getAttribute("aria-label") || wordmark.textContent || "").trim() || "Acidity";
      if (!wordmark.querySelector(".char")) {
        const load = wordmark.querySelector("[data-home-boot-pulse]");
        wordmark.setAttribute("aria-label", text);
        wordmark.textContent = "";
        [...text].forEach((ch) => {
          const span = document.createElement("span");
          span.className = "char";
          span.textContent = ch === " " ? " " : ch;
          wordmark.appendChild(span);
        });
        if (load) wordmark.appendChild(load);
      }
      const chars = Array.from(wordmark.querySelectorAll(".char"));
      const narrow = window.matchMedia("(max-width: 720px)").matches;
      const deck = document.querySelector("[data-explore-deck]");
      const deckW = () => (deck ? deck.clientWidth : window.innerWidth);
      const deckH = () => (deck ? deck.clientHeight : window.innerHeight);
      const parseLen = (raw, basis) => {
        const v = String(raw || "0").trim();
        const n = parseFloat(v);
        if (!Number.isFinite(n)) return 0;
        return v.endsWith("%") ? (n / 100) * basis : n;
      };
      const cardFrom = [
        { x: -420, y: 220, rotation: -32 },
        { x: 0, y: 380, rotation: 14 },
        { x: 420, y: 220, rotation: 34 },
      ];
      const finals = () =>
        cards.map((card) => {
          const cs = getComputedStyle(card);
          return {
            x: parseLen(cs.getPropertyValue("--x"), deckW()),
            y: parseLen(cs.getPropertyValue("--y"), deckH()),
            rotation: parseFloat(cs.getPropertyValue("--tilt")) || 0,
          };
        });


      if (soft) {
        // Soft return: park wordmark (no tween fight); cards rise only
        document.querySelector("[data-home-boot-pulse]")?.remove();
        document.body.classList.remove("is-booting");
        const deck = document.querySelector("[data-explore-deck]");
        if (deck) {
          deck.style.opacity = "";
          deck.style.visibility = "";
        }
        gsap.set(wordmark, {
          xPercent: -50,
          yPercent: 0,
          left: "50%",
          top: "2.75rem",
          scale: 0.52,
          transformOrigin: "50% 50%",
          autoAlpha: 1,
        });
        gsap.set(chars, { yPercent: 0, rotateZ: 0, opacity: 1, filter: "blur(0px)", y: 0 });
        if (heroLine) gsap.set(heroLine, { autoAlpha: 0 });
        const lands = finals();
        if (!narrow) {
          cards.forEach((card, i) => {
            const land = lands[i] || { x: 0, y: 0, rotation: 0 };
            gsap.set(card, {
              xPercent: -50,
              yPercent: -50,
              x: land.x,
              y: land.y + 28,
              rotation: land.rotation,
              autoAlpha: 0,
              scale: 1,
              transformOrigin: "50% 50%",
            });
          });
        } else {
          gsap.set(cards, { autoAlpha: 0, y: 28 });
        }
        story.classList.add("is-ready");
        gsap.to(chars, {
          y: (i) => (i % 2 === 0 ? -4 : 4),
          duration: 2.8,
          stagger: { each: 0.1, yoyo: true, repeat: -1 },
          ease: "sine.inOut",
        });
        if (!narrow) {
          cards.forEach((card, i) => {
            const land = lands[i] || { x: 0, y: 0, rotation: 0 };
            gsap.to(card, {
              x: land.x,
              y: land.y,
              autoAlpha: 1,
              duration: 0.8,
              ease: "power3.out",
              delay: 0.06 + i * 0.1,
            });
          });
        } else {
          gsap.to(cards, {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.1,
            delay: 0.06,
          });
        }
      } else {
        const pulse = wordmark.querySelector("[data-home-boot-pulse]");
        // Prime letters off-screen before is-ready — otherwise Acidity paints, then vanishes, then intro.
        gsap.set(chars, {
          yPercent: 140,
          rotateZ: () => gsap.utils.random(-12, 12),
          opacity: 0,
          filter: "blur(8px)",
        });
        gsap.set(wordmark, {
          xPercent: -50,
          yPercent: -50,
          left: "50%",
          top: "50%",
          scale: 1,
          transformOrigin: "50% 50%",
          autoAlpha: 1,
        });
        if (pulse) gsap.set(pulse, { autoAlpha: 0 });
        if (heroLine) gsap.set(heroLine, { autoAlpha: 0, y: 24 });
        if (!narrow) {
          const lands = finals();
          cards.forEach((card, i) => {
            const f = cardFrom[i] || cardFrom[0];
            const land = lands[i] || { x: 0, y: 0, rotation: 0 };
            gsap.set(card, {
              xPercent: -50,
              yPercent: -50,
              x: land.x + f.x,
              y: land.y + f.y,
              rotation: land.rotation + f.rotation,
              autoAlpha: 0,
              scale: 0.86,
              transformOrigin: "50% 50%",
            });
          });
        } else {
          gsap.set(cards, { clearProps: "transform", autoAlpha: 0 });
        }
        story.classList.add("is-ready");

        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro.to(chars, {
          yPercent: 0,
          rotateZ: 0,
          opacity: 1,
          filter: "blur(0px)",
          duration: 1.15,
          stagger: { each: 0.06, from: "center" },
          ease: "power4.out",
        });
        if (pulse) intro.to(pulse, { autoAlpha: 1, duration: 0.4, ease: "power2.out" }, "-=0.35");
        intro.addPause("+=0", () => {
          Promise.all([homeWarm, waitMs(1250)]).finally(() => {
            document.body.classList.remove("is-booting");
            document.documentElement.classList.remove("is-booting");
            intro.resume();
          });
        });
        if (pulse) {
          intro.to(pulse, { autoAlpha: 0, duration: 0.35, ease: "power2.in" });
          intro.add(() => pulse.remove());
        }
        if (heroLine) {
          intro.to(heroLine, { autoAlpha: 1, y: 0, duration: 0.7 }, "-=0.15");
        }
        const floatTween = gsap.to(chars, {
          y: (i) => (i % 2 === 0 ? -7 : 7),
          duration: 2.6,
          stagger: { each: 0.09, yoyo: true, repeat: -1 },
          ease: "sine.inOut",
          paused: true,
        });
        intro.add(() => floatTween.play(), ">-=0.2");
        intro.to({}, { duration: 0.45 });
        intro.add(() => floatTween.pause());
        intro.to(wordmark, { top: "2.75rem", yPercent: 0, scale: 0.52, duration: 1.15, ease: "power3.inOut" }, ">");
        intro.to(chars, { y: 0, yPercent: 0, rotateZ: 0, duration: 0.9, ease: "power2.out" }, "<");
        if (heroLine) intro.to(heroLine, { autoAlpha: 0, y: -28, duration: 0.55, ease: "power2.in" }, "<");
        intro.add(() => {
          gsap.set(chars, { y: 0 });
          floatTween.kill();
          gsap.to(chars, {
            y: (i) => (i % 2 === 0 ? -4 : 4),
            duration: 2.8,
            stagger: { each: 0.1, yoyo: true, repeat: -1 },
            ease: "sine.inOut",
          });
        });
        if (!narrow) {
          cards.forEach((card, i) => {
            const lands = finals();
            const land = lands[i] || { x: 0, y: 0, rotation: 0 };
            const f = cardFrom[i] || cardFrom[0];
            intro.fromTo(
              card,
              {
                xPercent: -50,
                yPercent: -50,
                x: land.x + f.x,
                y: land.y + f.y,
                rotation: land.rotation + f.rotation,
                autoAlpha: 0,
                scale: 0.86,
              },
              {
                xPercent: -50,
                yPercent: -50,
                x: land.x,
                y: land.y,
                rotation: land.rotation,
                autoAlpha: 1,
                scale: 1,
                duration: 0.85,
                ease: "power4.out",
              },
              i === 0 ? ">-=0.15" : "-=0.55"
            );
          });
        } else {
          intro.to(cards, { autoAlpha: 1, duration: 0.6, stagger: 0.1 }, ">-=0.1");
        }
      }
    }

    /* Studio — GSAP prime BEFORE is-ready; never touch page-title on soft (morph) */
    const aboutProse = document.querySelector("[data-about-prose]");
    if (aboutProse) {
      const lines = gsap.utils.toArray(aboutProse.querySelectorAll(":scope > [data-about-line]"));
      const talkCards = gsap.utils.toArray(aboutProse.querySelectorAll(".talk-card.explore-card"));
      const pageTitle = document.querySelector(".page-studio .page-title");

      if (lines.length) {
        gsap.fromTo(
          lines,
          { autoAlpha: 0, y: 28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.08,
            delay: soft ? 0.06 : 0.1,
            immediateRender: true,
          }
        );
      }
      if (talkCards.length) {
        gsap.fromTo(
          talkCards,
          {
            autoAlpha: 0,
            y: 36,
            scale: 0.94,
            rotation: (i, el) => {
              const t = parseFloat(getComputedStyle(el).getPropertyValue("--tilt")) || 0;
              return t + (i === 0 ? -8 : 8);
            },
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotation: (i, el) => parseFloat(getComputedStyle(el).getPropertyValue("--tilt")) || 0,
            duration: 0.85,
            ease: "power4.out",
            stagger: 0.12,
            delay: soft ? 0.28 : 0.45,
            immediateRender: true,
          }
        );
      }
      // Unlock CSS only after GSAP has written opacity:0 inline
      aboutProse.classList.add("is-ready");
      if (pageTitle && !soft) {
        gsap.fromTo(
          pageTitle,
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", delay: 0.05, immediateRender: true }
        );
      }
      // soft: leave page-title completely alone for view-transition morph
    }

    /* Apps + Web — shared .apps-list / .app-card rise; Apps title untouched on soft */
    const appsList = document.querySelector(".apps-list");
    if (appsList) {
      const appCards = gsap.utils.toArray(appsList.querySelectorAll(".app-card"));
      const appsTitle = document.querySelector(".page-apps .page-title");
      if (appCards.length) {
        gsap.fromTo(
          appCards,
          { autoAlpha: 0, y: 28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.1,
            delay: soft ? 0.08 : 0.12,
            immediateRender: true,
          }
        );
      }
      appsList.classList.add("is-ready");
      if (appsTitle && !soft) {
        gsap.fromTo(
          appsTitle,
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", delay: 0.05, immediateRender: true }
        );
      }
    }

    /* Web title — hard load only; soft morphs. Cards use .apps-list (same as Apps). */
    const webTitle = document.querySelector(".page-web .page-title");
    if (webTitle && !soft) {
      gsap.fromTo(
        webTitle,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", delay: 0.05, immediateRender: true }
      );
    }

    if (!soft) {

      gsap.utils.toArray(".reveal").forEach((el) => {
        if (el.classList.contains("hero-line")) return;
        if (el.classList.contains("app-card")) return;
        gsap.from(el, {
          opacity: 0,
          y: 56,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            toggleActions: "play none none none",
          },
        });
      });
    }
  };

  window.AcidityMotion = { init, kill };

  const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));
  let homeWarm = Promise.resolve();

  const preloadImage = (href) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = () => resolve();
      img.src = href;
    });

  const warmHtml = (path) =>
    fetch(path, { headers: { Accept: "text/html" }, credentials: "same-origin" })
      .then((r) => r.text())
      .catch(() => "");

  /**
   * First home load only: wait for fonts, play the letter intro, then hold a
   * loader on that same wordmark (no second Acidity) while pages/images warm.
   * Soft hops never enter this path.
   */
  const finishBootAndIntro = async () => {
    const isHome = document.body.classList.contains("page-home");
    const story = document.querySelector("[data-home-story]");
    const booting = document.body.classList.contains("is-booting");

    const unlock = () => {
      document.body.classList.remove("is-booting");
      document.documentElement.classList.remove("is-booting");
    };

    if (!(isHome && story && booting) || reduce) {
      document.querySelector("[data-home-boot-pulse]")?.remove();
      unlock();
      init({ soft: false });
      return;
    }

    document.documentElement.classList.add("is-booting");

    homeWarm = Promise.all([
      warmHtml("/studio/"),
      warmHtml("/apps/"),
      warmHtml("/web/"),
      preloadImage("/assets/apps/mise.png"),
      preloadImage("/assets/apps/hilo-smile.png"),
      preloadImage("/assets/apps/orza.png"),
    ]).catch(() => {});

    try {
      const fonts =
        document.fonts && document.fonts.ready
          ? Promise.race([document.fonts.ready, waitMs(2000)])
          : Promise.resolve();
      const sheets = Promise.all(
        [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => {
          if (link.sheet) return Promise.resolve();
          return new Promise((resolve) => {
            link.addEventListener("load", resolve, { once: true });
            link.addEventListener("error", resolve, { once: true });
          });
        })
      );
      await Promise.all([fonts, sheets]);
    } catch (err) {
      console.warn("[acidity] boot warm failed, intro anyway", err);
    }

    init({ soft: false });
  };

  finishBootAndIntro();
})();
