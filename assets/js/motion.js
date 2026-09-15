(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof gsap === "undefined") {
    console.warn("[acidity] GSAP missing — motion skipped");
    return;
  }
  if (reduce) return;

  gsap.registerPlugin(ScrollTrigger);

  const wordmark = document.querySelector("[data-split]");
  if (wordmark) {
    const text = wordmark.textContent.trim();
    wordmark.setAttribute("aria-label", text);
    wordmark.textContent = "";
    [...text].forEach((ch) => {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = ch === " " ? "\u00A0" : ch;
      wordmark.appendChild(span);
    });

    const chars = wordmark.querySelectorAll(".char");
    gsap.set(chars, { yPercent: 120, rotateZ: 8, opacity: 0 });
    gsap.to(chars, {
      yPercent: 0,
      rotateZ: 0,
      opacity: 1,
      duration: 1.05,
      stagger: { each: 0.055, from: "start" },
      ease: "power4.out",
      delay: 0.08,
    });

    gsap.to(chars, {
      y: (i) => (i % 2 === 0 ? -6 : 6),
      duration: 2.4,
      stagger: { each: 0.08, yoyo: true, repeat: -1 },
      ease: "sine.inOut",
      delay: 1.3,
    });

    /* Hero scrub — drift / blur / scale; opacity stays >= 0.55 (no vanishing A).
       Uses yPercent so idle float on `y` can keep running at rest. */
    gsap.fromTo(
      chars,
      {
        yPercent: 0,
        x: 0,
        rotationZ: 0,
        scale: 1,
        filter: "blur(0px)",
        opacity: 1,
      },
      {
        yPercent: (i) => (i % 2 === 0 ? -28 : 34),
        x: (i) => (i % 2 === 0 ? -18 : 22),
        rotationZ: (i) => (i % 2 === 0 ? -9 : 11),
        scale: 0.82,
        filter: "blur(2.5px)",
        opacity: 0.55,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      }
    );
  }

  const heroLine = document.querySelector(".hero-line");
  if (heroLine) {
    gsap.from(heroLine, {
      y: 40,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      delay: 0.55,
    });
  }
  const cue = document.querySelector("[data-scroll-cue]");
  if (cue) {
    gsap.fromTo(
      cue,
      { y: 0, opacity: 0.35 },
      {
        y: 8,
        opacity: 1,
        duration: 1.1,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        delay: 1,
      }
    );
  }

  const glow = document.querySelector("[data-hero-glow]");
  if (glow) {
    gsap.to(glow, {
      yPercent: 35,
      scale: 1.25,
      opacity: 0.2,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
  }

  const explore = document.querySelector("[data-explore]");
  const stages = gsap.utils.toArray("[data-stage]");
  const dots = gsap.utils.toArray("[data-explore-dot]");

  if (explore && stages.length) {
    let lastIdx = -1;

    const setActive = (index) => {
      if (index === lastIdx) return;
      lastIdx = index;

      stages.forEach((el, i) => {
        const on = i === index;
        el.classList.toggle("is-active", on);
        if (!on) el.classList.remove("is-punch");
      });
      dots.forEach((d, i) => d.classList.toggle("is-on", i === index));

      const active = stages[index];
      const idxEl = active.querySelector(".stage-index");

      gsap.fromTo(
        active,
        { autoAlpha: 0, y: 70, scale: 0.88, rotateX: 6 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          duration: 0.45,
          ease: "power4.out",
          overwrite: "auto",
        }
      );

      active.classList.remove("is-punch");
      void active.offsetWidth;
      active.classList.add("is-punch");
      window.setTimeout(() => active.classList.remove("is-punch"), 320);

      if (idxEl) {
        gsap.fromTo(
          idxEl,
          { scale: 1.35 },
          { scale: 1, duration: 0.55, ease: "back.out(2.2)", overwrite: "auto" }
        );
      }

      stages.forEach((el, i) => {
        if (i === index) return;
        gsap.to(el, {
          autoAlpha: 0,
          y: i < index ? -50 : 60,
          scale: 0.9,
          rotateX: 0,
          duration: 0.3,
          overwrite: "auto",
          ease: "power2.in",
        });
      });
    };

    gsap.set(stages, { autoAlpha: 0, y: 70, scale: 0.88, transformPerspective: 900 });
    setActive(0);

    ScrollTrigger.create({
      trigger: explore,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.5,
      onUpdate: (self) => {
        const n = stages.length;
        const seg = 1 / n;
        let idx = Math.min(n - 1, Math.floor(self.progress / seg));
        if (self.progress >= 1 - 0.001) idx = n - 1;
        setActive(idx);
      },
    });
  }

  /* Studio about sticky type scrub */
  const aboutLinesRoot = document.querySelector("[data-about-lines]");
  const aboutSpacer = document.querySelector("[data-about-spacer]");
  if (aboutLinesRoot && aboutSpacer) {
    const lines = gsap.utils.toArray(aboutLinesRoot.querySelectorAll(".about-line"));
    if (lines.length) {
      aboutSpacer.style.setProperty("--about-beats", String(lines.length));
      gsap.set(lines, { autoAlpha: 0, y: 30 });
      gsap.set(lines[0], { autoAlpha: 1, y: 0 });

      let aboutIdx = 0;
      ScrollTrigger.create({
        trigger: aboutSpacer,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const n = lines.length;
          let idx = Math.min(n - 1, Math.floor(self.progress * n));
          if (self.progress >= 1 - 0.001) idx = n - 1;
          if (idx === aboutIdx) return;
          aboutIdx = idx;
          lines.forEach((el, i) => {
            const on = i === idx;
            gsap.to(el, {
              autoAlpha: on ? 1 : 0,
              y: on ? 0 : 30,
              duration: 0.35,
              overwrite: "auto",
              ease: "power2.out",
            });
          });
        },
      });
    }
  }

  const immediate = gsap.utils.toArray(".page-head.reveal");
  if (immediate.length) {
    gsap.from(immediate, {
      y: 48,
      opacity: 0,
      duration: 0.95,
      ease: "power3.out",
      stagger: 0.08,
    });
  }

  gsap.utils.toArray(".reveal").forEach((el) => {
    if (el.classList.contains("hero-line")) return;
    if (immediate.includes(el)) return;
    if (el.closest("[data-about-lines]")) return;
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
})();
