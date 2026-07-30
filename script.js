// Reloading with the browser sitting on a scrolled-down position (its
// default scroll-restoration behavior) starts the header/hero/quote scroll
// effects out of sync with Lenis's own (0-based) internal scroll state —
// they only catch up once a real scroll event fires, which reads as the
// header "not showing" until the page nudges into sync. Forcing scroll
// restoration off keeps every reload starting at the top, in sync.
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

// Shared by every scroll-progress calculation below (quote slide, quote
// reveal, card stack, CTA scale, founder pull).
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Sound effects: browsers block Audio.play() unless it's called from (or
// shortly after) a real user "activation" gesture — scrolling never counts
// as one, no matter which event it's wired to, so a play() triggered
// purely by scroll position can be silently rejected if no gesture has
// happened anywhere on the page yet. Two layers handle this:
//   1. On the first qualifying gesture (pointerdown/touchstart/keydown —
//      wheel/scroll never qualify), every registered sound is muted-played
//      once to unlock it for later scroll-driven playback.
//   2. If a scroll-driven play() is attempted before that's happened and
//      gets rejected, it's queued and actually played (audibly) on the
//      next qualifying gesture instead of being silently lost.
const soundEffects = [];
const pendingPlays = new Set();
// Sound effects are off by default until the user turns them on via
// .sound-toggle (see below).
let soundsMuted = true;
function registerSound(src) {
  const audio = new Audio(src);
  audio.muted = soundsMuted;
  audio.volume = 0.5;
  soundEffects.push(audio);
  return audio;
}
// Use this instead of calling audio.play() directly for anything triggered
// by scroll (not a click/tap), so a blocked attempt gets retried later.
function playSound(audio) {
  audio.currentTime = 0;
  audio.play().catch(() => {
    pendingPlays.add(audio);
  });
}
function unlockSoundEffects() {
  soundEffects.forEach((audio) => {
    if (pendingPlays.has(audio)) {
      pendingPlays.delete(audio);
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {});
  });
  ["pointerdown", "touchstart", "keydown"].forEach((type) =>
    document.removeEventListener(type, unlockSoundEffects),
  );
}
["pointerdown", "touchstart", "keydown"].forEach((type) =>
  document.addEventListener(type, unlockSoundEffects),
);

// Sound toggle button: mutes/unmutes every registered sound effect. Sound
// starts off, so turning it on plays a click as immediate confirmation.
const soundToggle = document.querySelector(".sound-toggle");
if (soundToggle) {
  const soundToggleIcon = soundToggle.querySelector(".sound-toggle-icon");
  const toggleClickSound = registerSound("Assets/Sound effects/Marker_Twist.mp3");
  soundToggle.addEventListener("click", () => {
    soundsMuted = !soundsMuted;
    soundEffects.forEach((audio) => {
      audio.muted = soundsMuted;
    });
    soundToggle.setAttribute("aria-pressed", String(!soundsMuted));
    soundToggle.setAttribute(
      "aria-label",
      soundsMuted ? "Unmute sound effects" : "Mute sound effects",
    );
    soundToggleIcon.src = soundsMuted
      ? "Assets/Icons/Volume_Off.png"
      : "Assets/Icons/Volume_On.png";
    if (!soundsMuted) {
      toggleClickSound.currentTime = 0;
      toggleClickSound.play().catch(() => {});
    }
  });
}

// Pen press/release sounds on any button
const btnPressSound = registerSound("Assets/Sound effects/Pen_Press.mp3");
const btnReleaseSound = registerSound("Assets/Sound effects/Pen_Release.mp3");
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".btn")) return;
  btnPressSound.currentTime = 0;
  btnPressSound.play().catch(() => {});
});
document.addEventListener("pointerup", (event) => {
  if (!event.target.closest(".btn")) return;
  btnReleaseSound.currentTime = 0;
  btnReleaseSound.play().catch(() => {});
});

// "Ask a question" / "Write us something" open the user's mail client
document.querySelectorAll(".mailto-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const subject = encodeURIComponent("Design Diaries: [REPLACE THIS]");
    window.location.href = `mailto:info@dasonluo.com?subject=${subject}`;
  });
});

// "Open Diary" / "See for yourself" / "Write Something" go to the app.
// Unlike mailto: (which doesn't unload the page), this navigates the same
// tab away immediately — a brief delay lets the pointerup release sound
// above actually finish playing before the page tears down.
document.querySelectorAll(".app-link-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setTimeout(() => {
      window.location.href = "https://www.app.designdiaries.xyz";
    }, 200);
  });
});

// "Follow us online" opens Instagram in a new tab
document.querySelectorAll(".instagram-link-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    window.open("https://www.instagram.com/helloimdason", "_blank", "noopener");
  });
});

// Smooth scrolling (site-wide)
const lenis = new Lenis({
  duration: 0.5,
  easing: (t) => 1 - Math.pow(1 - t, 3),
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Sticky header: hide on scroll down, reveal on scroll up
const siteHeader = document.querySelector(".site-header");
if (siteHeader) {
  let lastScrollY = window.scrollY;
  const siteFooterEl = document.querySelector(".site-footer");
  const headerLogo = siteHeader.querySelector(".logo");
  const LOGO_LIGHT_BG = "Assets/Logo/Logo_DesignDiaries.svg";
  const LOGO_DARK_BG = "Assets/Logo/Logo_DesignDiaries_Outlined.svg";
  let isOnDark = false;

  function updateHeader() {
    const currentY = window.scrollY;
    if (currentY <= 0) {
      siteHeader.classList.remove("is-hidden");
    } else if (currentY > lastScrollY) {
      siteHeader.classList.add("is-hidden");
    } else if (currentY < lastScrollY) {
      siteHeader.classList.remove("is-hidden");
    }
    lastScrollY = currentY;

    // Once the (sticky, pinned) header visually overlaps the dark footer
    // scrolling up beneath it, swap the logo/button so they stay legible.
    if (siteFooterEl) {
      const headerRect = siteHeader.getBoundingClientRect();
      const footerRect = siteFooterEl.getBoundingClientRect();
      const onDark = footerRect.top <= headerRect.bottom;
      if (onDark !== isOnDark) {
        isOnDark = onDark;
        siteHeader.classList.toggle("is-on-dark", onDark);
        if (headerLogo) {
          headerLogo.src = onDark ? LOGO_DARK_BG : LOGO_LIGHT_BG;
        }
      }
    }
  }

  lenis.on("scroll", updateHeader);
  updateHeader();
}

// Quote section slides over the hero as you scroll. The hero itself is
// plain normal-flow content (never sticky/fixed) — as it scrolls past at
// the normal rate, .quote-section's margin-top is eased from 0 down to a
// negative value, which pulls it (and everything after it) up faster than
// normal scroll so it visually overtakes and covers the hero. Using
// margin (not transform) keeps later sections' layout consistent with
// where the quote section actually ends, so nothing overlaps once the
// pull finishes easing in.
const heroPin = document.querySelector(".hero-pin");
const quoteSection = document.querySelector(".quote-section");
if (heroPin && quoteSection) {
  const MAX_PULL = 400; // px of overlap once the hero has fully scrolled past
  const quoteSlideSound = registerSound("Assets/Sound effects/Paper_Slide_3.mp3");
  let quoteSliding = false;
  let quoteSlideSoundPlayed = false;

  function updateQuoteSlide() {
    const rect = heroPin.getBoundingClientRect();
    const heroH = rect.height;
    const progress = clamp(-rect.top / heroH, 0, 1);
    quoteSection.style.marginTop = `${-MAX_PULL * progress}px`;

    if (progress > 0 && !quoteSliding) {
      quoteSliding = true;
      quoteSlideSoundPlayed = false;
    } else if (progress <= 0 && quoteSliding) {
      quoteSliding = false;
      quoteSlideSoundPlayed = false;
      // Quote section has moved back away (scrolling back up) — play again.
      quoteSlideSound.currentTime = 0;
      quoteSlideSound.play().catch(() => {});
    }
    // Retry directly on each scroll tick (rather than queuing for the next
    // click anywhere on the page) so it only ever plays while the quote
    // section is actually sliding over the hero.
    if (quoteSliding && !quoteSlideSoundPlayed) {
      quoteSlideSound.currentTime = 0;
      quoteSlideSound
        .play()
        .then(() => {
          quoteSlideSoundPlayed = true;
        })
        .catch(() => {});
    }
  }

  lenis.on("scroll", updateQuoteSlide);
  updateQuoteSlide();
}

// Letter-by-letter quote reveal
const quoteText = document.querySelector(".quote-text");
if (quoteText) {
  const text = quoteText.textContent.trim().replace(/\s+/g, " ");
  quoteText.innerHTML = Array.from(text)
    .map((ch) => (ch === " " ? " " : `<span class="letter">${ch}</span>`))
    .join("");
  const letterEls = quoteText.querySelectorAll(".letter");

  // maxProgress only ever increases, so scrolling back up never hides
  // letters that have already been revealed.
  let maxProgress = 0;

  function updateQuoteReveal() {
    const rect = quoteText.getBoundingClientRect();
    const vh = window.innerHeight;
    const start = vh * 0.85;
    const end = vh * 0.25;
    const progress = clamp((start - rect.top) / (start - end), 0, 1);
    if (progress > maxProgress) maxProgress = progress;
    const revealCount = Math.round(maxProgress * letterEls.length);

    letterEls.forEach((el, i) => {
      if (i < revealCount) el.classList.add("is-revealed");
    });
  }

  lenis.on("scroll", updateQuoteReveal);
  updateQuoteReveal();
}

// Scroll-driven card stack (feature section) — desktop only; on tablet/phone
// the cards use a plain CSS sticky-stack instead (see styles.css).
const stackSection = document.querySelector(".simple-section");
if (stackSection && window.innerWidth >= 1280) {
  const cards = stackSection.querySelectorAll(".feature-card");
  const STACK_EASE = 0.08; // lower = smoother/laggier catch-up, higher = snappier
  const HOLD_VH = 0.7; // extra scroll (in viewport heights) held on the last card before unpinning

  let targetProgress = 0;
  let smoothProgress = 0;

  function applyStack(progress) {
    const segment = 1 / cards.length;
    cards.forEach((card, i) => {
      const segmentStart = i * segment;
      const localProgress = clamp((progress - segmentStart) / segment, 0, 1);
      card.style.setProperty("--p", localProgress);
    });
  }

  function updateStackTarget() {
    const rect = stackSection.getBoundingClientRect();
    const scrollableDistance = stackSection.offsetHeight - window.innerHeight;
    const holdDistance = window.innerHeight * HOLD_VH;
    const cardsDistance = scrollableDistance - holdDistance;
    targetProgress = clamp(-rect.top / cardsDistance, 0, 1);
  }

  // Decouples the card stack's visual speed from raw scroll speed: a fast
  // swipe still moves targetProgress a lot, but smoothProgress can only
  // chase it a fraction of the way each frame, so cards never "zoom through".
  function tickStack() {
    smoothProgress += (targetProgress - smoothProgress) * STACK_EASE;
    if (Math.abs(targetProgress - smoothProgress) < 0.0005) {
      smoothProgress = targetProgress;
    }
    applyStack(smoothProgress);
    requestAnimationFrame(tickStack);
  }

  lenis.on("scroll", updateStackTarget);
  updateStackTarget();
  smoothProgress = targetProgress;
  requestAnimationFrame(tickStack);
}

// Paper-slide sound as each feature card enters the viewport, and again if
// it exits back out the top while scrolling up — an IntersectionObserver
// (rather than the desktop-only stack logic above) so it fires the same way
// on desktop, tablet, and phone.
const featureCards = document.querySelectorAll(".feature-card");
if (featureCards.length) {
  const featureCardSound = registerSound("Assets/Sound effects/Paper_Slide_4.mp3");
  let featureScrollingDown = true;
  let featureLastScrollY = window.scrollY;
  lenis.on("scroll", () => {
    const y = window.scrollY;
    featureScrollingDown = y > featureLastScrollY;
    featureLastScrollY = y;
  });
  const featureCardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          playSound(featureCardSound);
        } else if (!featureScrollingDown) {
          playSound(featureCardSound);
        }
      });
    },
    { threshold: 0.5 },
  );
  featureCards.forEach((card) => featureCardObserver.observe(card));
}

// Draggable card stack (together section)
const cardStack = document.querySelector(".together-art");
if (cardStack) {
  const cards = Array.from(cardStack.querySelectorAll(".entry-card"));
  const count = cards.length;
  const ROTATIONS = [-6, 4, -3]; // fixed to each card's identity, never changes
  const RELEASE_THRESHOLD = 90; // px drag distance that commits to cycling the stack

  const dragSound = registerSound("Assets/Sound effects/Paper_Slide_1.mp3");

  // zIndices[i] is the current stacking depth of cards[i]; count-1 = top.
  let zIndices = cards.map((_, i) => count - 1 - i);

  function applyZIndices() {
    cards.forEach((card, i) => {
      card.style.zIndex = String(zIndices[i]);
    });
  }

  // Every card always rests at the exact same centered spot when not being
  // dragged — only its fixed rotation and z-index differ. Cycling the stack
  // never moves a card's position, so there's nothing for it to travel to.
  function restTransform(cardIndex) {
    return `translate(-50%, -50%) rotate(${ROTATIONS[cardIndex % ROTATIONS.length]}deg)`;
  }

  function resetPosition(card, animate) {
    const idx = cards.indexOf(card);
    const target = restTransform(idx);
    card.getAnimations().forEach((a) => a.cancel());
    if (!animate) {
      card.style.transform = target;
      return;
    }
    const from = card.style.transform;
    const anim = card.animate(
      [{ transform: from }, { transform: target }],
      { duration: 650, easing: "cubic-bezier(0.16, 0.68, 0.2, 1)", fill: "forwards" }
    );
    anim.onfinish = () => {
      card.style.transform = target;
      anim.cancel(); // release the animation's hold so the inline style (above) takes over
    };
  }

  let dragCard = null;
  let startX = 0;
  let startY = 0;
  let targetX = 0; // raw pointer delta (where the cursor actually is)
  let targetY = 0;
  let curX = 0; // eased delta actually applied to the card (chases target)
  let curY = 0;
  let dragRafId = null;
  const FOLLOW_EASE = 0.35; // lower = softer/laggier follow, higher = snappier

  function isTop(card) {
    return zIndices[cards.indexOf(card)] === count - 1;
  }

  function followLoop() {
    if (!dragCard) return;
    curX += (targetX - curX) * FOLLOW_EASE;
    curY += (targetY - curY) * FOLLOW_EASE;
    const idx = cards.indexOf(dragCard);
    const rotate = ROTATIONS[idx % ROTATIONS.length] + curX * 0.08;
    dragCard.style.transform = `translate(calc(-50% + ${curX}px), calc(-50% + ${curY}px)) rotate(${rotate}deg)`;
    dragRafId = requestAnimationFrame(followLoop);
  }

  function onPointerDown(event) {
    const card = event.currentTarget;
    if (!isTop(card)) return;
    dragSound.currentTime = 0;
    dragSound.play().catch(() => {});
    dragCard = card;
    dragCard.getAnimations().forEach((a) => a.cancel());
    targetX = 0;
    targetY = 0;
    curX = 0;
    curY = 0;
    startX = event.clientX;
    startY = event.clientY;
    dragCard.style.willChange = "transform";
    dragCard.setPointerCapture(event.pointerId);
    if (dragRafId) cancelAnimationFrame(dragRafId);
    dragRafId = requestAnimationFrame(followLoop);
  }

  function onPointerMove(event) {
    if (!dragCard) return;
    targetX = event.clientX - startX;
    targetY = event.clientY - startY;
  }

  function onPointerUp() {
    if (!dragCard) return;
    if (dragRafId) cancelAnimationFrame(dragRafId);
    dragRafId = null;
    const card = dragCard;
    dragCard = null;
    card.style.willChange = "";
    const distance = Math.hypot(targetX, targetY);

    if (distance > RELEASE_THRESHOLD) {
      // Every card's depth advances by one: whoever was directly underneath
      // the dragged card becomes the new top; the dragged card (top,
      // count-1) wraps around to 0, the bottom.
      zIndices = zIndices.map((z) => (z + 1) % count);
      applyZIndices();
    }
    resetPosition(card, true);
  }

  cards.forEach((card) => {
    card.addEventListener("pointerdown", onPointerDown);
  });
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  applyZIndices();

  // Entrance: deal the cards in one at a time like a stack of playing cards
  // being built up — the back of the stack (bottom card) lands first, then
  // each card above it, finishing with the front (top) card.
  const REVEAL_STAGGER = 450; // ms between each card's reveal start
  const REVEAL_DROP = 140; // px the card falls from as it settles into place
  const dealOrder = [...cards].reverse(); // bottom-of-stack card first

  dealOrder.forEach((card) => {
    const idx = cards.indexOf(card);
    card.style.opacity = "0";
    card.style.pointerEvents = "none";
    card.style.transform = `translateY(${REVEAL_DROP}px) ${restTransform(idx)} scale(0.92)`;
  });

  let dealt = false;
  function dealStack() {
    if (dealt) return;
    dealt = true;
    dealOrder.forEach((card, i) => {
      const idx = cards.indexOf(card);
      setTimeout(() => {
        card.style.pointerEvents = "";
        const anim = card.animate(
          [
            { transform: `translateY(${REVEAL_DROP}px) ${restTransform(idx)} scale(0.92)`, opacity: 0 },
            { transform: restTransform(idx), opacity: 1 },
          ],
          { duration: 550, easing: "cubic-bezier(0.16, 0.68, 0.2, 1)", fill: "forwards" }
        );
        anim.onfinish = () => {
          card.style.transform = restTransform(idx);
          card.style.opacity = "1";
          anim.cancel();
        };
      }, i * REVEAL_STAGGER);
    });
  }

  const dealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          dealStack();
          dealObserver.disconnect();
        }
      });
    },
    { threshold: 0.4 }
  );
  dealObserver.observe(cardStack);
}

// Rotating testimonial carousel (auto-rotate, slows on hover)
const testimonialRow = document.querySelector(".testimonial-row");
if (testimonialRow) {
  const track = testimonialRow.querySelector(".testimonial-track");
  const originalCards = Array.from(track.querySelectorAll(".testimonial-card"));

  // Duplicate the set once so the track can loop seamlessly.
  originalCards.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    track.appendChild(clone);
  });

  const isTouchBreakpoint = window.innerWidth < 1280;
  const SPEED = isTouchBreakpoint ? 0.4 : 0.7; // px per frame, steady-state rotation
  const HOVER_SPEED = 0.1; // px per frame, while the pointer is over the carousel
  const BOOST_SPEED = 14; // px per frame, burst speed when the section enters view
  const BOOST_DECAY = 0.03; // how fast speed eases toward its target
  let speed = SPEED;
  let targetSpeed = SPEED;
  let offset = 0;

  testimonialRow.addEventListener("mouseenter", () => {
    targetSpeed = HOVER_SPEED;
  });
  testimonialRow.addEventListener("mouseleave", () => {
    targetSpeed = SPEED;
  });

  // Cache the loop width instead of reading track.scrollWidth every frame,
  // which forces a synchronous layout reflow 60x/sec. A ResizeObserver (not
  // a one-off "load" listener) keeps it correct even while avatar images are
  // still loading — starting the loop with a too-small width made it wrap
  // early, then visibly jump once the real (wider) size came in.
  let cachedLoopWidth = 0;
  const trackResizeObserver = new ResizeObserver(() => {
    cachedLoopWidth = track.scrollWidth / 2;
  });
  trackResizeObserver.observe(track);

  // Slide in fast as the section scrolls into view, then ease down to the
  // steady rotation speed.
  const testimonialsObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          speed = BOOST_SPEED;
          testimonialsObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 },
  );
  testimonialsObserver.observe(testimonialRow);

  function tick() {
    if (cachedLoopWidth > 0) {
      speed += (targetSpeed - speed) * BOOST_DECAY;
      offset += speed;
      offset = ((offset % cachedLoopWidth) + cachedLoopWidth) % cachedLoopWidth;
      track.style.transform = `translateX(${-offset}px)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function animateAccordionHeight(panel, toHeight) {
  const fromHeight = panel.getBoundingClientRect().height;
  panel.getAnimations().forEach((a) => a.cancel());

  if (fromHeight === toHeight) return;

  const overshoot = Math.max(fromHeight, toHeight) * 1.12 + 10;
  const anim = panel.animate(
    [
      { height: `${fromHeight}px` },
      { height: `${overshoot}px`, offset: 0.55 },
      { height: `${toHeight}px` },
    ],
    { duration: 500, easing: "cubic-bezier(0.33, 1, 0.68, 1)", fill: "forwards" }
  );
  anim.onfinish = () => {
    panel.style.height = `${toHeight}px`;
    anim.cancel();
  };
}

// Marker-twist sound for the CTA's radial arrows turning toward/away from
// the button — hover in/out on desktop, or the scroll-driven expand/collapse
// toggle below on tablet/phone.
const arrowSpinSound = registerSound("Assets/Sound effects/Marker_Twist.mp3");
function playArrowSpin() {
  arrowSpinSound.currentTime = 0;
  arrowSpinSound.play().catch(() => {});
}

// CTA frame lifts up as it scrolls into view
const ctaFrame = document.querySelector(".cta-frame");
if (ctaFrame) {
  const arrowCta = ctaFrame.querySelector(".arrow-cta");
  // No real hover on tablet/phone, so once the frame finishes expanding,
  // flip the arrows to point at the button the same way desktop hover does.
  const isTouchBreakpoint = window.innerWidth < 1280;
  let arrowsExpanded = false;

  function updateCtaScale() {
    const rect = ctaFrame.getBoundingClientRect();
    const vh = window.innerHeight;
    const center = rect.top + rect.height / 2;
    const start = vh; // frame center at viewport bottom -> just entering
    const end = vh / 2; // frame center at viewport center -> fully lifted
    const progress = clamp((start - center) / (start - end), 0, 1);
    const scale = 1 + 0.4 * progress;
    ctaFrame.style.transform = `scale(${scale})`;

    if (isTouchBreakpoint && arrowCta) {
      const shouldExpand = progress >= 1;
      if (shouldExpand !== arrowsExpanded) {
        arrowsExpanded = shouldExpand;
        arrowCta.classList.toggle("is-expanded", shouldExpand);
        playArrowSpin();
      }
    }
  }

  lenis.on("scroll", updateCtaScale);
  updateCtaScale();
}

// Desktop: hover in/out on each arrow individually, and on the button
// itself (CSS turns the arrows toward it on :hover via .arrow-cta:has())
const ctaArrows = document.querySelectorAll(".arrow-cta .arrow");
ctaArrows.forEach((arrow) => {
  arrow.addEventListener("pointerenter", playArrowSpin);
  arrow.addEventListener("pointerleave", playArrowSpin);
});
const ctaArrowButton = document.querySelector(".arrow-cta .btn-large");
if (ctaArrowButton) {
  ctaArrowButton.addEventListener("pointerenter", playArrowSpin);
  ctaArrowButton.addEventListener("pointerleave", playArrowSpin);
}

document.querySelectorAll(".accordion-panel").forEach((panel) => {
  const inner = panel.querySelector(".accordion-panel-inner");
  if (panel.classList.contains("is-open")) {
    panel.style.height = `${inner.scrollHeight}px`;
  }
});

// Accordion items: an SVG outline (rect starts its path at the top-left
// corner and traces clockwise) draws itself in via stroke-dashoffset once
// the accordion list scrolls into view, instead of a static CSS border.
// All items are triggered together (observing the shared list, not each
// item individually) so every outline draws in at the same time.
const SVG_NS = "http://www.w3.org/2000/svg";
const accordionItems = document.querySelectorAll(".accordion-item");
accordionItems.forEach((item) => {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("accordion-outline");
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("rx", "8");
  rect.setAttribute("pathLength", "1");
  svg.appendChild(rect);
  item.appendChild(svg);
});

const accordionList = document.querySelector(".accordion-list");
if (accordionList) {
  const accordionLineSound = registerSound(
    "Assets/Sound effects/Pencil_Line.mp3",
  );
  const accordionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          accordionItems.forEach((item) => item.classList.add("is-drawn"));
          playSound(accordionLineSound);
          accordionObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.45 },
  );
  accordionObserver.observe(accordionList);
}

// Marker-lid sound: plays on every accordion click, since each one either
// opens a panel, closes one, or both (closing the previous, opening the new).
const accordionLidSound = registerSound("Assets/Sound effects/Marker_Lid.mp3");

document.querySelectorAll(".accordion-trigger").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    accordionLidSound.currentTime = 0;
    accordionLidSound.play().catch(() => {});

    // The trigger is wrapped in an <h3> for accessible heading navigation,
    // so the panel is now a sibling of that wrapper, not of the button.
    const panel = trigger.closest("h3").nextElementSibling;
    const isOpen = trigger.getAttribute("aria-expanded") === "true";

    // Close all
    document.querySelectorAll(".accordion-trigger").forEach((t) => {
      t.setAttribute("aria-expanded", "false");
      const p = t.closest("h3").nextElementSibling;
      p.classList.remove("is-open");
      animateAccordionHeight(p, 0);
    });

    // Open clicked one if it wasn't already open
    if (!isOpen) {
      trigger.setAttribute("aria-expanded", "true");
      panel.classList.add("is-open");
      const inner = panel.querySelector(".accordion-panel-inner");
      animateAccordionHeight(panel, inner.scrollHeight);
    }
  });
});

// Founder heading: split into letters so it can type on once the paper
// has fully slid out of the envelope (see updateFounderPull below).
const founderHeading = document.querySelector(".founder-heading");
if (founderHeading) {
  const headingText = founderHeading.textContent;
  founderHeading.textContent = "";
  founderHeading.setAttribute("aria-label", headingText);
  [...headingText].forEach((char, i) => {
    const span = document.createElement("span");
    span.textContent = char;
    span.className = "founder-heading-letter";
    span.style.transitionDelay = `${i * 30}ms`;
    span.setAttribute("aria-hidden", "true");
    founderHeading.appendChild(span);
  });
}

// Founder card slides up out of the envelope as you scroll to it
const founderCard = document.querySelector(".founder-card");
if (founderCard) {
  const PULL_DISTANCE = 260; // px the paper travels, tucked in envelope -> fully out
  const pullSound = registerSound("Assets/Sound effects/Paper_Slide_2.mp3");
  let headingRevealed = false;
  let hasStartedMoving = false;
  let pullSoundPlayed = false;

  function updateFounderPull() {
    const rect = founderCard.getBoundingClientRect();
    const vh = window.innerHeight;
    const start = vh; // card top at viewport bottom -> still tucked in
    const end = vh * 0.4; // card top partway up the viewport -> fully pulled out
    const progress = clamp((start - rect.top) / (start - end), 0, 1);
    const y = PULL_DISTANCE * (1 - progress);
    founderCard.style.transform = `translateY(${y}px)`;
    if (progress > 0 && !hasStartedMoving) {
      hasStartedMoving = true;
      pullSoundPlayed = false;
    } else if (progress <= 0 && hasStartedMoving) {
      hasStartedMoving = false;
      pullSoundPlayed = false;
      // Paper has moved back into the envelope (scrolling back up) — play again.
      pullSound.currentTime = 0;
      pullSound.play().catch(() => {});
    }
    // Retry playing directly on each scroll tick instead of queuing for the
    // next click anywhere on the page — queuing meant a click made after
    // the card had scrolled back out of view would still fire the sound.
    if (hasStartedMoving && !pullSoundPlayed) {
      pullSound.currentTime = 0;
      pullSound
        .play()
        .then(() => {
          pullSoundPlayed = true;
        })
        .catch(() => {});
    }
    if (progress >= 1 && !headingRevealed && founderHeading) {
      headingRevealed = true;
      founderHeading.classList.add("is-revealed");
    }
  }

  lenis.on("scroll", updateFounderPull);
  updateFounderPull();
}

// Self-portrait lift: hover handles this on desktop; on tablet/phone (no
// reliable hover), tap toggles it up, tap again sends it back down.
const founderPortrait = document.querySelector(".founder-portrait");
if (founderPortrait && window.innerWidth < 1280) {
  founderPortrait.addEventListener("click", () => {
    founderPortrait.classList.toggle("is-lifted");
  });
}

// Paper-slide sound on the self-portrait: pointerenter covers both hover-in
// (desktop) and tap (tablet/phone, since a touch's pointer lifecycle starts
// with pointerenter); pointerleave covers hover-out and tap-away.
if (founderPortrait) {
  const portraitSlideSound = registerSound(
    "Assets/Sound effects/Paper_Slide_5.mp3",
  );
  ["pointerenter", "pointerleave"].forEach((type) =>
    founderPortrait.addEventListener(type, () => playSound(portraitSlideSound)),
  );
}

// Hero floaters: draggable once their pop-in animation finishes. They stay
// wherever they're dropped — no snap-back.
document.querySelectorAll(".hero-float").forEach((el) => {
  el.addEventListener(
    "animationend",
    () => {
      el.classList.add("is-settled");
    },
    { once: true },
  );

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  el.addEventListener("pointerdown", (e) => {
    dragging = true;
    el.classList.add("is-dragging");
    el.setPointerCapture(e.pointerId);

    const parentRect = el.offsetParent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // Lock the element to explicit left/top pixels so drag math is simple,
    // dropping whichever mix of right/bottom anchors it started with.
    el.style.left = `${elRect.left - parentRect.left}px`;
    el.style.top = `${elRect.top - parentRect.top}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";

    offsetX = e.clientX - elRect.left;
    offsetY = e.clientY - elRect.top;
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const parentRect = el.offsetParent.getBoundingClientRect();
    el.style.left = `${e.clientX - parentRect.left - offsetX}px`;
    el.style.top = `${e.clientY - parentRect.top - offsetY}px`;
  });

  function stopDragging() {
    dragging = false;
    el.classList.remove("is-dragging");
  }
  el.addEventListener("pointerup", stopDragging);
  el.addEventListener("pointercancel", stopDragging);
});

// Footer scratchpad: draw a trail with the cursor. Nothing is persisted —
// the canvas is just an in-memory bitmap, so it's gone on refresh.
const siteFooter = document.querySelector(".site-footer");
if (siteFooter) {
  const canvas = document.createElement("canvas");
  canvas.className = "footer-draw-canvas";
  siteFooter.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  function resizeFooterCanvas() {
    const rect = siteFooter.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.strokeStyle = "#fdfdfc";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  resizeFooterCanvas();
  window.addEventListener("resize", resizeFooterCanvas);

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  function footerPoint(e) {
    const rect = siteFooter.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // Graphite texture: several thin, jittered, semi-transparent passes
  // instead of one solid line, so overlapping strokes build up unevenly
  // like real pencil grain rather than a flat ballpoint line. Grain flecks
  // scattered along the segment add the gritty, uneven graphite look.
  function drawPencilSegment(fromX, fromY, toX, toY) {
    const passes = 6;
    for (let i = 0; i < passes; i++) {
      const jx = () => (Math.random() - 0.5) * 2.2;
      const jy = () => (Math.random() - 0.5) * 2.2;
      ctx.globalAlpha = 0.2 + Math.random() * 0.3;
      ctx.lineWidth = 0.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(fromX + jx(), fromY + jy());
      ctx.lineTo(toX + jx(), toY + jy());
      ctx.stroke();
    }

    const dist = Math.hypot(toX - fromX, toY - fromY);
    const grainCount = Math.max(2, Math.round(dist / 3));
    ctx.fillStyle = "#fdfdfc";
    for (let i = 0; i < grainCount; i++) {
      const t = Math.random();
      const gx = fromX + (toX - fromX) * t + (Math.random() - 0.5) * 3.5;
      const gy = fromY + (toY - fromY) * t + (Math.random() - 0.5) * 3.5;
      ctx.globalAlpha = 0.12 + Math.random() * 0.4;
      ctx.beginPath();
      ctx.arc(gx, gy, Math.random() * 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  siteFooter.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    // Starting a press on a button/link is a click, not a draw — leave it
    // alone so its click still fires normally.
    if (e.target.closest("button, a")) return;
    e.preventDefault();
    isDrawing = true;
    siteFooter.classList.add("is-drawing");
    const p = footerPoint(e);
    lastX = p.x;
    lastY = p.y;
  });
  siteFooter.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !isDrawing) return;
    const p = footerPoint(e);
    drawPencilSegment(lastX, lastY, p.x, p.y);
    lastX = p.x;
    lastY = p.y;
  });
  function stopFooterDrawing() {
    isDrawing = false;
    siteFooter.classList.remove("is-drawing");
  }
  window.addEventListener("pointerup", stopFooterDrawing);
  siteFooter.addEventListener("pointerleave", stopFooterDrawing);
}
