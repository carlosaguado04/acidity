(() => {
  window.AcidityInteract = window.AcidityInteract || {};

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  if (reduce) {
    window.AcidityInteract.bindAll = function () {};
    window.AcidityInteract.bindPress = function () {};
    window.AcidityInteract.bindCards = function () {};
    return;
  }

  if (!fine) {
    window.AcidityInteract.bindPress = function () {
      document
        .querySelectorAll(".btn, .strip-card, .app-link, .app-card, .stage-link, .explore-card, .primary-nav a")
        .forEach(function (el) {
          if (el.dataset.pressBound) return;
          el.dataset.pressBound = "1";
          el.addEventListener("pointerdown", function () { el.classList.add("is-pressed"); });
          el.addEventListener("pointerup", function () { el.classList.remove("is-pressed"); });
          el.addEventListener("pointerleave", function () { el.classList.remove("is-pressed"); });
          el.addEventListener("pointercancel", function () { el.classList.remove("is-pressed"); });
        });
    };
    window.AcidityInteract.bindCards = function () {};
    window.AcidityInteract.bindTilt = function () {};
    window.AcidityInteract.bindAll = function () {
      window.AcidityInteract.bindPress();
    };
    window.AcidityInteract.bindAll();
    return;
  }

  /* Soft cursor light — desktop fine pointer only */
  const light = document.createElement("div");
  light.id = "cursor-light";
  light.setAttribute("data-cursor-light", "");
  light.setAttribute("aria-hidden", "true");
  document.body.appendChild(light);

  let lx = window.innerWidth / 2;
  let ly = window.innerHeight / 2;
  let tx = lx;
  let ty = ly;
  let lightRaf = 0;

  const tickLight = () => {
    lx += (tx - lx) * 0.07;
    ly += (ty - ly) * 0.07;
    light.style.transform = `translate3d(${lx}px, ${ly}px, 0) translate(-50%, -50%)`;
    lightRaf = requestAnimationFrame(tickLight);
  };

  const kickLight = () => {
    if (!lightRaf) lightRaf = requestAnimationFrame(tickLight);
  };

  window.addEventListener(
    "pointermove",
    (e) => {
      tx = e.clientX;
      ty = e.clientY;
      light.classList.add("is-on");
      kickLight();
      if (!lightRaf) kickLight();
    },
    { passive: true }
  );



  window.AcidityInteract.bindCards = () => {
    document.querySelectorAll(".explore-card").forEach((card) => {
      if (card.dataset.floatBound) return;
      card.dataset.floatBound = "1";
      const face = card.querySelector("[data-card-face]") || card;
      let floatTween = null;
      let resting = true;
      const stopFloat = () => {
        if (floatTween) {
          floatTween.kill();
          floatTween = null;
        }
      };
      card.addEventListener("pointerenter", () => {
        if (typeof gsap === "undefined") return;
        resting = false;
        card.classList.add("is-forward");
        card.style.zIndex = "20";
        stopFloat();
        gsap.to(face, {
          y: -14,
          scale: 1.045,
          duration: 0.5,
          ease: "power3.out",
          overwrite: true,
          onComplete: () => {
            if (resting) return;
            floatTween = gsap.to(face, {
              y: -6,
              duration: 1.7,
              yoyo: true,
              repeat: -1,
              ease: "sine.inOut",
            });
          },
        });
      });
      card.addEventListener("pointerleave", () => {
        if (typeof gsap === "undefined") return;
        resting = true;
        card.classList.remove("is-forward");
        card.style.zIndex = "";
        stopFloat();
        gsap.to(face, {
          y: 0,
          scale: 1,
          duration: 0.45,
          ease: "power3.out",
          overwrite: true,
        });
      });
    });
  };
  window.AcidityInteract.bindPress = () => {
    document
      .querySelectorAll(".btn, .strip-card, .app-link, .app-card, .stage-link, .explore-card, .primary-nav a")
      .forEach((el) => {
        if (el.dataset.pressBound) return;
        el.dataset.pressBound = "1";
        el.addEventListener("pointerdown", () => el.classList.add("is-pressed"));
        el.addEventListener("pointerup", () => el.classList.remove("is-pressed"));
        el.addEventListener("pointerleave", () => el.classList.remove("is-pressed"));
        el.addEventListener("pointercancel", () => el.classList.remove("is-pressed"));
      });
  };

  window.AcidityInteract.bindTilt = () => {
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      if (el.dataset.tiltBound) return;
      el.dataset.tiltBound = "1";
      let raf = 0;
      let crx = 0;
      let cry = 0;
      let clift = 0;
      const trx = { v: 0 };
      const try_ = { v: 0 };
      const tlift = { v: 0 };
      let tracking = false;
      const tick = () => {
        const pressed = el.classList.contains("is-pressed");
        const targetLift = pressed ? 2 : tlift.v;
        const targetScale = pressed ? 0.985 : tracking ? 1.015 : 1;
        crx += (trx.v - crx) * 0.12;
        cry += (try_.v - cry) * 0.12;
        clift += (targetLift - clift) * 0.14;
        el.style.transform = `perspective(1100px) rotateX(${crx.toFixed(3)}deg) rotateY(${cry.toFixed(3)}deg) translate3d(0,0,${clift.toFixed(2)}px) scale(${targetScale})`;
        const moving =
          Math.abs(trx.v - crx) > 0.02 ||
          Math.abs(try_.v - cry) > 0.02 ||
          Math.abs(targetLift - clift) > 0.05 ||
          tracking ||
          pressed;
        if (moving) raf = requestAnimationFrame(tick);
        else {
          raf = 0;
          el.style.transform = "";
        }
      };
      const kick = () => {
        if (!raf) raf = requestAnimationFrame(tick);
      };
      el.addEventListener("pointermove", (e) => {
        tracking = true;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        try_.v = px * 8;
        trx.v = -py * 8;
        tlift.v = 12;
        kick();
      });
      el.addEventListener("pointerleave", () => {
        tracking = false;
        trx.v = 0;
        try_.v = 0;
        tlift.v = 0;
        el.classList.remove("is-pressed");
        kick();
      });
      el.addEventListener("pointerdown", kick);
      el.addEventListener("pointerup", kick);
    });
  };

  window.AcidityInteract.bindMagnetic = () => {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      if (el.dataset.magneticBound) return;
      el.dataset.magneticBound = "1";
      const strength = Number(el.dataset.magnetic || 18);
      let raf = 0;
      let cx = 0;
      let cy = 0;
      let mtx = 0;
      let mty = 0;
      let tracking = false;
      const tick = () => {
        cx += (mtx - cx) * 0.18;
        cy += (mty - cy) * 0.18;
        el.style.transform = "translate3d(" + cx + "px, " + cy + "px, 0)";
        if (Math.abs(mtx - cx) > 0.05 || Math.abs(mty - cy) > 0.05 || tracking) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = 0;
          el.style.transform = "";
        }
      };
      const kick = () => {
        if (!raf) raf = requestAnimationFrame(tick);
      };
      el.addEventListener("pointermove", (e) => {
        tracking = true;
        const r = el.getBoundingClientRect();
        mtx = ((e.clientX - (r.left + r.width / 2)) / r.width) * strength;
        mty = ((e.clientY - (r.top + r.height / 2)) / r.height) * strength;
        kick();
      });
      el.addEventListener("pointerleave", () => {
        tracking = false;
        mtx = 0;
        mty = 0;
        kick();
      });
    });
  };

  window.AcidityInteract.bindAll = () => {
    window.AcidityInteract.bindPress();
    window.AcidityInteract.bindCards();
    window.AcidityInteract.bindTilt();
    window.AcidityInteract.bindMagnetic();
  };

  window.AcidityInteract.bindAll();
})();

