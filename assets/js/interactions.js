/* interactions.js — front-end behaviour for the static design system.
 * Replaces the original Next.js/GSAP runtime with a lightweight, dependency-free version.
 *  1. Renders every <i data-lucide> placeholder into an inline SVG via the Lucide runtime.
 *  2. Reveals the hero terminal code lines with a staggered "typing" fade-in.
 *  3. Fades in [data-animate-on-scroll] elements as they enter the viewport (IntersectionObserver),
 *     mirroring the original scroll-reveal feel while degrading gracefully to fully visible.
 */
(function () {
  "use strict";

  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  // Terminal typewriter — types the code token by token like the original site.
  // Full text is captured once at load so a mid-animation replay never loses characters.
  var TERMINAL_SEQ = null;
  var typingRun = 0;

  function collectTerminalSeq() {
    if (TERMINAL_SEQ) return TERMINAL_SEQ;
    TERMINAL_SEQ = [];
    document.querySelectorAll("[data-terminal-line]").forEach(function (line) {
      var tokens = Array.prototype.slice.call(line.children).slice(1).map(function (span) {
        return { el: span, text: span.textContent };
      });
      TERMINAL_SEQ.push({ line: line, tokens: tokens });
    });
    return TERMINAL_SEQ;
  }

  var REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function typeTerminal() {
    if (REDUCED_MOTION) {
      document.querySelectorAll("[data-terminal-line]").forEach(function (line) {
        line.style.opacity = "1";
      });
      return;
    }
    var seq = collectTerminalSeq();
    var run = ++typingRun;
    seq.forEach(function (item) {
      item.line.style.opacity = "0";
      item.tokens.forEach(function (t) {
        t.el.textContent = "";
      });
    });
    var li = 0, ti = 0, ci = 0;
    function step() {
      if (run !== typingRun || li >= seq.length) return;
      var item = seq[li];
      item.line.style.opacity = "1";
      if (ti >= item.tokens.length) {
        li++; ti = 0; ci = 0;
        window.setTimeout(step, 100); // pause between lines
        return;
      }
      var tok = item.tokens[ti];
      if (ci >= tok.text.length) {
        ti++; ci = 0;
        step();
        return;
      }
      ci++;
      tok.el.textContent = tok.text.slice(0, ci);
      window.setTimeout(step, 16);
    }
    window.setTimeout(step, 250);
  }

  // Section navigation map for the right rail, sidebar and mobile bottom nav (aria-label → section id).
  var NAV_TARGETS = {
    "Início": "hero", "Sobre": "about", "Habilidades": "skills", "Experiência": "experience",
    "Certificações": "projects", "Formação": "formacao", "Contato": "contact",
    "Ir para main.ts": "hero", "Ir para about.md": "about", "Ir para skills.json": "skills",
    "Ir para experience.git": "experience", "Ir para certificacoes/": "projects",
    "Ir para formacao.md": "formacao", "Ir para contact.exe": "contact",
  };

  function scrollToSection(id) {
    var target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Ordered list of the page sections — drives the right rail's active dot,
  // the keyboard (↑/↓) navigation and the hero's "scroll down" chevron.
  var SECTIONS = ["hero", "about", "skills", "experience", "projects", "formacao", "contact"];
  var currentIndex = 0;

  // Active UI language ("pt" default, "en" available); driven by the PT/EN switch below.
  var CURRENT_LANG = "pt";

  function goSection(dir) {
    var next = Math.min(SECTIONS.length - 1, Math.max(0, currentIndex + dir));
    if (next !== currentIndex) scrollToSection(SECTIONS[next]);
  }

  // Mobile hamburger menu: open/close the slide-in panel and navigate on item tap.
  function setupMobileMenu() {
    var toggle = document.getElementById("mobile-menu-toggle");
    var menu = document.getElementById("mobile-menu");
    if (!toggle || !menu) return;
    function open() { menu.classList.add("open"); toggle.setAttribute("aria-expanded", "true"); menu.setAttribute("aria-hidden", "false"); }
    function close() { menu.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-hidden", "true"); }
    toggle.addEventListener("click", function () {
      if (menu.classList.contains("open")) close(); else open();
    });
    menu.addEventListener("click", function (e) {
      var t = e.target;
      if (t.closest("#mobile-menu-close") || (t.classList && t.classList.contains("mm-backdrop"))) { close(); return; }
      var link = t.closest && t.closest(".mm-link");
      if (link && link.getAttribute("data-nav")) { scrollToSection(link.getAttribute("data-nav")); close(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("open")) close();
    });
  }
  setupMobileMenu();

  // One delegated listener handles every button — survives icon replacement and any init-order issue.
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!btn) return;
    if (btn.id === "btn-about") {
      scrollToSection("about");
      return;
    }
    if (btn.id === "btn-view-projects") {
      scrollToSection("projects");
      return;
    }
    if (btn.id === "scroll-down-hint") {
      goSection(1);
      return;
    }
    var navId = NAV_TARGETS[btn.getAttribute("aria-label")];
    if (navId) scrollToSection(navId);
  });

  function revealOnScroll() {
    var targets = document.querySelectorAll("[data-animate-on-scroll]");
    if (window.location.search.indexOf("noanim") !== -1) return; // test mode: keep everything visible
    if (REDUCED_MOTION) return; // respect prefers-reduced-motion: no fade/slide reveals
    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) {
        el.style.opacity = "1";
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.transition = "opacity .5s ease-out, transform .5s ease-out";
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach(function (el) {
      el.style.opacity = "0";
      el.style.transform = "translateY(20px)";
      observer.observe(el);
    });
  }

  // ---- Contact form ----
  // With no backend on a static page, the form falls back to mailto: (opens the visitor's mail app
  // with everything pre-filled). To upgrade to direct sending, create a free endpoint at
  // https://formspree.io (or https://web3forms.com) and paste its URL below — nothing else changes.
  var CONTACT_ENDPOINT = ""; // sem backend: abre o e-mail com a mensagem pronta
  var CONTACT_EMAIL = "geovana.bragafzys@gmail.com";

  function setupContactForm() {
    var form = document.querySelector("#contact form");
    if (!form) return;
    var button = form.querySelector('button[type="submit"]');
    var label = button ? button.querySelector("span") : null;

    function setStatus(text, done) {
      if (label) label.textContent = tr(text);
      if (button) button.disabled = !done;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.querySelector("#website").value) return; // honeypot: silently drop bots

      var name = form.querySelector("#contact-name").value.trim();
      var email = form.querySelector("#contact-email").value.trim();
      var subject = form.querySelector("#contact-subject").value.trim() || "Contato via portfólio";
      var message = form.querySelector("#contact-message").value.trim();

      if (CONTACT_ENDPOINT) {
        setStatus("Enviando...", false);
        fetch(CONTACT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: name, email: email, subject: subject, message: message }),
        })
          .then(function (res) {
            if (!res.ok) throw new Error(res.status);
            setStatus("✓ Mensagem enviada!", true);
            form.reset();
            window.setTimeout(function () { setStatus("Enviar Mensagem", true); }, 4000);
          })
          .catch(function () {
            setStatus("Erro — tente de novo", true);
            window.setTimeout(function () { setStatus("Enviar Mensagem", true); }, 4000);
          });
      } else {
        var body = message + "\n\n— " + name + " (" + email + ")";
        window.location.href =
          "mailto:" + CONTACT_EMAIL +
          "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(body);
        setStatus("Abrindo seu e-mail...", true);
        window.setTimeout(function () { setStatus("Enviar Mensagem", true); }, 4000);
      }
    });
  }

  // ---- Section navigation: right-rail active dot + keyboard (↑/↓) ----
  // Lights up the rail dot for the section currently in view (and keeps its name
  // label visible, not only on hover), and lets the visitor move section-by-section
  // with the arrow keys. Runs after renderIcons() so the <i> placeholders are SVGs.
  function setupSectionNav() {
    var rail = document.getElementById("rail-nav");
    var buttons = rail ? Array.prototype.slice.call(rail.querySelectorAll("button")) : [];

    // Resolve the state-carrying children of one rail button.
    function parts(btn) {
      var labelDiv = btn.children[0];
      var spans = labelDiv.querySelectorAll("span");
      var wrapper = btn.children[1];
      return {
        labelDiv: labelDiv,
        labelSpan: spans[spans.length - 1], // the section name (last span; first is the "＞")
        ring: wrapper.children[0],
        dot: wrapper.children[1],
        icon: wrapper.children[1].firstElementChild, // <svg> after Lucide render
      };
    }

    // Capture the active/inactive class strings straight from the markup:
    // button[0] ships active, button[1] inactive — so the look stays in sync with the theme.
    var ACT = null, INA = null;
    if (buttons.length >= 2) {
      var p0 = parts(buttons[0]), p1 = parts(buttons[1]);
      ACT = { span: p0.labelSpan.getAttribute("class"), ring: p0.ring.getAttribute("class"), dot: p0.dot.getAttribute("class") };
      INA = { span: p1.labelSpan.getAttribute("class"), ring: p1.ring.getAttribute("class"), dot: p1.dot.getAttribute("class") };
    }

    function setIcon(icon, on) {
      if (!icon) return;
      icon.classList.remove("w-0", "h-0", "opacity-0", "scale-0", "w-4", "h-4", "opacity-100", "scale-100");
      icon.classList.add.apply(icon.classList, on ? ["w-4", "h-4", "opacity-100", "scale-100"] : ["w-0", "h-0", "opacity-0", "scale-0"]);
    }

    function paint(idx) {
      if (!ACT) return;
      buttons.forEach(function (btn, i) {
        var p = parts(btn), on = i === idx, t = on ? ACT : INA;
        p.labelSpan.setAttribute("class", t.span);
        p.ring.setAttribute("class", t.ring);
        p.dot.setAttribute("class", t.dot);
        setIcon(p.icon, on);
        // Keep the active section's name permanently visible; others revert to hover-only.
        p.labelDiv.style.opacity = on ? "1" : "";
        p.labelDiv.style.transform = on ? "translateX(0)" : "";
      });
    }

    var sectionEls = SECTIONS.map(function (id) { return document.getElementById(id); });

    // Scrollspy: the active section is the last one whose top has crossed ~35% of the
    // viewport; at the very bottom of the page we force the last section (which may be
    // too short to ever reach the middle line).
    function computeActive() {
      var line = window.innerHeight * 0.35;
      var idx = 0;
      for (var i = 0; i < sectionEls.length; i++) {
        var el = sectionEls[i];
        if (el && el.getBoundingClientRect().top <= line) idx = i;
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) idx = SECTIONS.length - 1;
      if (idx !== currentIndex) { currentIndex = idx; paint(idx); }
    }

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { computeActive(); ticking = false; });
    }, { passive: true });
    window.addEventListener("resize", computeActive);

    // Arrow keys move between sections (ignored while typing in the contact form).
    document.addEventListener("keydown", function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      var el = e.target, tag = (el && el.tagName ? el.tagName : "").toLowerCase();
      if (tag === "input" || tag === "textarea" || (el && el.isContentEditable)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); goSection(1); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); goSection(-1); }
    });

    paint(currentIndex);
    computeActive();
  }

  // ---- Internationalization (Portuguese default ↔ English) ----
  // The page ships in Portuguese; every translatable string is swapped in place by walking
  // the text nodes and matching them against this PT→EN dictionary — no reload, choice saved
  // in localStorage. Code, filenames, tech names and proper nouns are intentionally left out.
  var PT2EN = {
    // nav / menu
    "Início": "Home", "Sobre": "About", "Habilidades": "Skills", "Experiência": "Experience",
    "Certificações": "Certifications", "Formação": "Education", "Contato": "Contact", "~/navegação": "~/navigation",
    // hero
    "MODO_OFENSIVO :: ATIVO · QA ONLINE": "OFFENSIVE_MODE :: ACTIVE · QA ONLINE",
    "Olá, eu sou": "Hi, I'm",
    "Quebrando o sistema antes que alguém quebre por você. Analista de testes com 3 anos de experiência, agora somando segurança ofensiva e inteligência cibernética — e apps em Flutter.":
      "Breaking the system before someone else does. Test analyst with 3 years of experience, now adding offensive security and cyber intelligence — plus Flutter apps.",
    "Conectar no LinkedIn": "Connect on LinkedIn",
    "Carregando...": "Loading...",
    "Fale comigo": "Get in touch",
    "E-mail": "Email",
    "MÓDULOS_CARREGADOS:": "MODULES_LOADED:",
    "'encontra a falha antes deles'": "'finds the flaw before they do'",
    "// caixa-preta, caixa-branca, e o que houver": "// black box, white box, whatever it takes",
    "// se passar, eu testo mais forte": "// if it passes, I test harder",
    "// ✓ todos os testes passaram": "// ✓ all tests passed",
    "Sobre mim": "About me",
    "Ver Certificações": "View Certifications",
    // about
    "Sobre.system": "About.system",
    "Sou Analista de Testes com 3 anos de experiência na Stefanini, garantindo a qualidade de sistemas críticos. Hoje me especializo em Engenharia de Qualidade de Software e em Segurança Ofensiva — e desenvolvo apps mobile em Flutter.":
      "I'm a Test Analyst with 3 years at Stefanini ensuring the quality of critical systems. Today I'm specializing in Software Quality Engineering and Offensive Security — and I build mobile apps in Flutter.",
    "OPERADOR": "OPERATOR", "FUNÇÃO": "ROLE", "LOCALIZAÇÃO": "LOCATION",
    "EXPERIÊNCIA": "EXPERIENCE", "ANOS": "YEARS",
    "CERTIFICAÇÕES": "CERTIFICATIONS", "CURSOS": "COURSES", "BUGS CAÇADOS": "BUGS HUNTED",
    // skills
    "Habilidades.json": "Skills.json",
    "Arraste para explorar o arsenal de QA e segurança": "Drag to explore the QA & security arsenal",
    // experience
    "Analista de Testes Pleno": "Mid-Level Test Analyst",
    "Responsável pela qualidade de sistemas críticos: planejamento e execução de testes funcionais, casos de teste, relatórios de defeitos e acompanhamento em Kanban junto aos times de desenvolvimento.":
      "Responsible for the quality of critical systems: planning and running functional tests, writing test cases, reporting defects and tracking work in Kanban alongside the development teams.",
    "72 casos de teste": "72 test cases", "+318 validações": "+318 assertions", "-96 defeitos": "-96 defects",
    "Analista de Testes Jr.": "Junior Test Analyst",
    "Primeiros passos em QA: elaboração e execução de casos de teste, registro de defeitos e apoio às rotinas de homologação das entregas.":
      "First steps in QA: writing and running test cases, logging defects and supporting the acceptance routines for each release.",
    "40 casos de teste": "40 test cases", "+150 validações": "+150 assertions", "-38 defeitos": "-38 defects",
    "Testes Funcionais": "Functional Testing", "Casos de Teste": "Test Cases",
    "Gestão de Defeitos": "Defect Management", "Homologação": "Acceptance Testing",
    "git init (2020 — estágio de engenharia na COGERA Energia)": "git init (2020 — engineering internship at COGERA Energia)",
    // certifications / projects
    "Certificações &amp; Cursos": "Certifications &amp; Courses",
    "Segurança em TI": "IT Security",
    "Fundamentos de segurança da informação: superfícies de ataque, boas práticas de proteção e a base que sustenta a atuação ofensiva.":
      "Information security fundamentals: attack surfaces, protection best practices and the base that supports offensive work.",
    "Segurança": "Security", "Fundamentos": "Fundamentals",
    "Flutter — Android &amp; iOS": "Flutter — Android &amp; iOS",
    "Desenvolvimento de aplicativos multiplataforma com Flutter e Dart, do design da interface à publicação nas duas lojas.":
      "Cross-platform app development with Flutter and Dart, from interface design to publishing on both stores.",
    "Projeto PicPay Pro": "PicPay Pro Program",
    "Programa prático com desafios reais de produto e tecnologia, aplicando qualidade e boas práticas em um contexto de fintech.":
      "Hands-on program with real product and technology challenges, applying quality and best practices in a fintech context.",
    "Produto": "Product",
    "IA &amp; Cultura Digital": "AI &amp; Digital Culture",
    "Inteligência artificial no novo contexto da cultura digital — impactos, usos e limites da IA no dia a dia da tecnologia.":
      "Artificial intelligence in the new digital culture — the impact, uses and limits of AI in everyday technology.",
    "Cultura Digital": "Digital Culture",
    "Lógica de programação e automação com Python — a base para scripts de teste e ferramentas de apoio ao trabalho de QA.":
      "Programming logic and automation with Python — the basis for test scripts and tooling that supports QA work.",
    "Automação": "Automation",
    "Kanban &amp; Ágil": "Kanban &amp; Agile",
    "Rotina de qualidade dentro de times ágeis: fluxo de trabalho em Kanban, priorização de defeitos e entregas contínuas.":
      "Quality routine inside agile teams: Kanban workflow, defect prioritisation and continuous delivery.",
    "Ágil": "Agile",
    // education
    "Bacharelado em Análise de Sistemas de Computação": "Bachelor's in Computer Systems Analysis",
    "Base em análise de sistemas, lógica de programação, banco de dados e engenharia de software.":
      "Foundation in systems analysis, programming logic, databases and software engineering.",
    "Pós: Engenharia de Qualidade de Software": "Postgrad: Software Quality Engineering",
    "Aprofundamento em estratégias de teste, automação e métricas de qualidade de software.":
      "Deep dive into test strategy, automation and software quality metrics.",
    "Pós: Segurança Ofensiva e Inteligência Cibernética": "Postgrad: Offensive Security & Cyber Intelligence",
    "Testes de intrusão, análise de vulnerabilidades e inteligência cibernética — pensar como quem ataca para proteger melhor.":
      "Penetration testing, vulnerability analysis and cyber intelligence — thinking like an attacker to protect better.",
    "CURSANDO": "IN PROGRESS",
    "Analista de Testes": "Test Analyst",
    "Stefanini · 3 anos de atuação": "Stefanini · 3 years",
    "Fundamentos de segurança da informação": "Information security fundamentals",
    "Flutter · Android &amp; iOS": "Flutter · Android &amp; iOS",
    "Desenvolvimento mobile multiplataforma": "Cross-platform mobile development",
    "Programa prático de tecnologia": "Hands-on technology program",
    "Inteligência artificial aplicada": "Applied artificial intelligence",
    "Linguagens &amp; Frameworks": "Languages &amp; Frameworks",
    // contact
    "\"disponível\"": "\"available\"",
    "// Alvo em observação — aguardando conexão...": "// Target under watch — awaiting connection...",
    "canal seguro": "secure channel", "para:": "to:", "resposta:": "reply:", "em até 24h": "within 24h",
    "Nome": "Name", "Assunto": "Subject", "Mensagem": "Message",
    "// Protegido por filtros de spam e limites de taxa": "// Protected by spam filters and rate limiting",
    "Enviar Mensagem": "Send Message",
    "Abrindo seu e-mail...": "Opening your email...", "Erro — tente de novo": "Error — try again",
    // footer
    "Testes, Segurança Ofensiva &amp; Flutter": "Testing, Offensive Security &amp; Flutter",
    "© 2026 Geovana Zys. Todos os direitos reservados.": "© 2026 Geovana Zys. All rights reserved.",
  };

  // Inverse map (EN→PT) for switching back, and the few mixed-markup / attribute / <head> strings.
  var EN2PT = {};
  Object.keys(PT2EN).forEach(function (k) { EN2PT[PT2EN[k]] = k; });

  var I18N_HTML = {
    mission: {
      pt: 'Achar o que ninguém viu — antes que vire incidente. Foco em <span class="text-white">automação de testes</span>, <span class="text-white">segurança ofensiva</span> e <span class="text-white">Flutter</span>.',
      en: 'Find what nobody else saw — before it becomes an incident. Focused on <span class="text-white">test automation</span>, <span class="text-white">offensive security</span> and <span class="text-white">Flutter</span>.',
    },
  };

  var I18N_ATTR = [
    { sel: "#contact-name", attr: "placeholder", pt: "Seu Nome", en: "Your Name" },
    { sel: "#contact-subject", attr: "placeholder", pt: "Consulta de projeto / Colaboração", en: "Project inquiry / Collaboration" },
    { sel: "#contact-message", attr: "placeholder", pt: "Conte-me sobre seu projeto, prazo e objetivos...", en: "Tell me about your project, timeline and goals..." },
  ];

  var I18N_TITLE = {
    pt: "Thiago Henrique | Engenheiro de Software Full Stack",
    en: "Thiago Henrique | Full Stack Software Engineer",
  };

  // tr(): translate one string for the current language (used by the contact-form status).
  function tr(s) { return CURRENT_LANG === "en" && PT2EN[s] != null ? PT2EN[s] : s; }

  // Walk every text node under `root`, skipping <script>/<style> and the mixed-markup blocks
  // handled separately, calling fn(textNode) on each.
  function walkTextNodes(root, fn) {
    for (var n = root.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { fn(n); continue; }
      if (n.nodeType !== 1) continue;
      var tag = n.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || n.hasAttribute("data-i18n-html")) continue;
      walkTextNodes(n, fn);
    }
  }

  function applyLang(lang) {
    var map = lang === "en" ? PT2EN : EN2PT;
    walkTextNodes(document.body, function (t) {
      var raw = t.nodeValue;
      var key = raw.trim();
      if (!key || map[key] == null) return;
      var lead = raw.match(/^\s*/)[0];
      var trail = raw.match(/\s*$/)[0];
      t.nodeValue = lead + map[key] + trail;
    });
    // mixed-markup blocks (keyed, so no inverse map needed)
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var entry = I18N_HTML[el.getAttribute("data-i18n-html")];
      if (entry) el.innerHTML = entry[lang] || entry.pt;
    });
    // attributes (placeholders)
    I18N_ATTR.forEach(function (a) {
      var el = document.querySelector(a.sel);
      if (el) el.setAttribute(a.attr, lang === "en" ? a.en : a.pt);
    });
    // document metadata
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "pt-BR");
    document.title = lang === "en" ? I18N_TITLE.en : I18N_TITLE.pt;
    // let the terminal re-capture its (now translated) source on any later replay
    TERMINAL_SEQ = null;
    CURRENT_LANG = lang;
    try { localStorage.setItem("lang", lang); } catch (e) { /* private mode */ }
  }

  function setupLangSwitch() {
    var sw = document.getElementById("lang-switch");
    if (!sw) return;
    var opts = Array.prototype.slice.call(sw.querySelectorAll(".lang-opt"));
    function refresh(lang) {
      opts.forEach(function (b) {
        var on = b.getAttribute("data-lang") === lang;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    sw.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".lang-opt") : null;
      if (!b) return;
      var lang = b.getAttribute("data-lang");
      if (lang === CURRENT_LANG) return;
      applyLang(lang);
      refresh(lang);
    });
    var saved = null;
    try { saved = localStorage.getItem("lang"); } catch (e) { /* private mode */ }
    var initial = saved === "en" ? "en" : "pt";
    if (initial === "en") applyLang("en"); else CURRENT_LANG = "pt";
    refresh(initial);
  }

  // This script is the last classic script in <body>, so the whole DOM above it already exists —
  // run immediately instead of waiting for DOMContentLoaded (which ES-module CDN imports can delay).
  renderIcons();
  typeTerminal();
  revealOnScroll();
  setupContactForm();
  setupSectionNav();
  setupLangSwitch();
})();
