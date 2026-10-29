(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- theme ---------- */
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  var saved = safeGet("theme");
  if (saved) root.setAttribute("data-theme", saved);
  else if (window.matchMedia("(prefers-color-scheme: light)").matches) root.setAttribute("data-theme", "light");

  document.getElementById("themeBtn").addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    safeSet("theme", next);
  });

  /* ---------- mobile menu ---------- */
  var menuBtn = document.getElementById("menuBtn");
  var links = document.getElementById("links");
  menuBtn.addEventListener("click", function () {
    var open = links.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      links.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });

  /* ---------- scroll progress, nav state, active link ---------- */
  var progress = document.getElementById("progress");
  var nav = document.getElementById("nav");
  var sections = Array.prototype.slice.call(document.querySelectorAll("main section[id]"));
  var navLinks = Array.prototype.slice.call(links.querySelectorAll("a"));

  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
    nav.classList.toggle("scrolled", window.scrollY > 10);

    var current = "";
    sections.forEach(function (s) {
      if (window.scrollY + 140 >= s.offsetTop) current = s.id;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + current);
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- typing effect ---------- */
  var roles = [
    "DevOps Engineer",
    "Python Developer",
    "Cloud & Kubernetes Specialist"
  ];
  var typed = document.getElementById("typed");

  if (reduceMotion) {
    typed.textContent = roles.join(" · ");
  } else {
    var ri = 0, ci = 0, deleting = false;
    (function tick() {
      var word = roles[ri];
      ci += deleting ? -1 : 1;
      typed.textContent = word.slice(0, ci);
      var delay = deleting ? 40 : 85;
      if (!deleting && ci === word.length) { deleting = true; delay = 1600; }
      else if (deleting && ci === 0) { deleting = false; ri = (ri + 1) % roles.length; delay = 400; }
      setTimeout(tick, delay);
    })();
  }

  /* ---------- hero terminal animation ---------- */
  var term = document.getElementById("termBody");
  var lines = [
    '<span class="p">$</span> python3 main.py',
    '<span class="d">Starting KubeDock...</span>',
    '<span class="ok">✔</span> SSH session connected',
    '<span class="ok">✔</span> Embedded web app on :8080',
    '<span class="p">$</span> kubectl get pods',
    '<span class="d">NAME            READY   STATUS</span>',
    'api-7d9f6       1/1     <span class="ok">Running</span>',
    'worker-5b8c2    1/1     <span class="ok">Running</span>',
    'cron-job-x2k    0/1     <span class="w">Pending</span>'
  ];

  if (reduceMotion) {
    term.innerHTML = lines.join("\n");
  } else {
    var li = 0;
    (function nextLine() {
      if (li >= lines.length) return;
      term.innerHTML += (li ? "\n" : "") + lines[li++];
      setTimeout(nextLine, 520);
    })();
  }

  /* ---------- reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 4, 3) * 80 + "ms";
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- count-up stats ---------- */
  var counters = document.querySelectorAll("[data-count]");
  function runCounter(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (reduceMotion) { el.textContent = target; return; }
    var start = null, dur = 1200;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { runCounter(en.target); cio.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  } else {
    counters.forEach(runCounter);
  }

  /* ---------- live GitHub sync ---------- */
  var GH_USER = "HareeshGT";
  var FEATURED = "kubedock";                 // shown in the featured block, skipped in the grid
  var HIDDEN = ["portfolio", GH_USER.toLowerCase()]; // this site's own repo and the profile README repo
  var MAX_CARDS = 8;
  var CACHE_KEY = "gh-repos-v1";
  var CACHE_TTL = 30 * 60 * 1000;            // 30 minutes, keeps us well inside the 60 req/hr anonymous limit

  // Optional hand-written text for repos that have no GitHub description yet.
  var NOTES = {
    consoletypeprojects: "A collection of console-based Java programs, starting with a bank application.",
    project: "A set of small web builds, including a menu bar, a mini calendar, a movie app and a login page.",
    elearnvc: "A repository of video lessons organised into topic series.",
    leetcode: "My problem-solving practice and solutions, kept in version control."
  };

  var cardsEl = document.getElementById("repoCards");
  var noteEl = document.getElementById("syncNote");
  var featMeta = document.getElementById("featuredMeta");

  function readCache() {
    try {
      var raw = safeGet(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function ago(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    var units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (var i = 0; i < units.length; i++) {
      var n = Math.floor(s / units[i][1]);
      if (n >= 1) return n + " " + units[i][0] + (n > 1 ? "s" : "") + " ago";
    }
    return "just now";
  }

  function metaText(r) {
    var parts = [];
    if (r.stargazers_count) parts.push("★ " + r.stargazers_count);
    if (r.forks_count) parts.push("⑂ " + r.forks_count);
    parts.push("updated " + ago(r.pushed_at || r.updated_at));
    return parts.join(" · ");
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function buildCard(r) {
    var card = el("article", "card reveal in");
    card.appendChild(el("p", "tag", r.language || "Repository"));
    // Add invisible break points at camelCase / separator boundaries so long names wrap at word edges.
    var title = r.name.replace(/([a-z0-9])([A-Z])/g, "$1​$2").replace(/([-_.])/g, "$1​");
    var h = el("h3", "", title);
    h.title = r.name;
    card.appendChild(h);
    card.appendChild(el("p", "", r.description || NOTES[r.name.toLowerCase()] || "See the repository on GitHub for details."));

    if (r.topics && r.topics.length) {
      var chips = el("div", "chips");
      r.topics.slice(0, 4).forEach(function (t) { chips.appendChild(el("span", "", t)); });
      card.appendChild(chips);
    }

    card.appendChild(el("p", "card-meta", metaText(r)));

    var a = el("a", "link", "View on GitHub ↗");
    a.href = r.html_url;
    a.target = "_blank";
    a.rel = "noopener";
    card.appendChild(a);

    // Show a live website link only when the repository has a homepage configured.
    var website = (r.homepage || "").trim();
    if (website) {
      if (!/^https?:\/\//i.test(website)) website = "https://" + website;
      try {
        var parsedWebsite = new URL(website);
        if (parsedWebsite.protocol === "https:" || parsedWebsite.protocol === "http:") {
          var siteLink = el("a", "link", "Visit Website ↗");
          siteLink.href = parsedWebsite.href;
          siteLink.target = "_blank";
          siteLink.rel = "noopener noreferrer";
          siteLink.style.marginLeft = "1rem";
          card.appendChild(siteLink);
        }
      } catch (e) {
        // Ignore invalid homepage values; keep the GitHub link available.
      }
    }
    return card;
  }

  function render(repos, fetchedAt, stale) {
    var own = repos.filter(function (r) { return !r.fork; });

    // featured block: live stats
    var feat = own.filter(function (r) { return r.name.toLowerCase() === FEATURED; })[0];
    if (feat && featMeta) {
      featMeta.textContent = metaText(feat);
      featMeta.hidden = false;
    }

    // The featured project's website is optional and comes from GitHub's Homepage field.
    var featuredLink = document.getElementById("featuredLink");
    if (featuredLink && feat) {
      var featuredWebsite = (feat.homepage || "").trim();
      if (featuredWebsite) {
        if (!/^https?:\/\//i.test(featuredWebsite)) featuredWebsite = "https://" + featuredWebsite;
        try {
          var parsedFeaturedWebsite = new URL(featuredWebsite);
          if (parsedFeaturedWebsite.protocol === "https:" || parsedFeaturedWebsite.protocol === "http:") {
            var siteLink = document.getElementById("featuredWebsiteLink");
            if (!siteLink) {
              siteLink = el("a", "link", "Visit Website ↗");
              siteLink.id = "featuredWebsiteLink";
              siteLink.target = "_blank";
              siteLink.rel = "noopener noreferrer";
              siteLink.style.marginLeft = "1rem";
              featuredLink.insertAdjacentElement("afterend", siteLink);
            }
            siteLink.href = parsedFeaturedWebsite.href;
            siteLink.hidden = false;
          }
        } catch (e) {
          var invalidSiteLink = document.getElementById("featuredWebsiteLink");
          if (invalidSiteLink) invalidSiteLink.hidden = true;
        }
      } else {
        var absentSiteLink = document.getElementById("featuredWebsiteLink");
        if (absentSiteLink) absentSiteLink.hidden = true;
      }
    }

    // project grid
    var list = own.filter(function (r) {
      var n = r.name.toLowerCase();
      return n !== FEATURED && HIDDEN.indexOf(n) === -1;
    }).sort(function (a, b) {
      return new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at);
    }).slice(0, MAX_CARDS);

    if (list.length) {
      cardsEl.textContent = "";
      list.forEach(function (r) { cardsEl.appendChild(buildCard(r)); });
    }

    // repo count stat
    var statEl = document.querySelector('[data-count="10"]');
    if (statEl) {
      statEl.setAttribute("data-count", String(repos.length));
      if (statEl.textContent !== "0") statEl.textContent = repos.length;
    }

    noteEl.className = "sync " + (stale ? "stale" : "ok");
    noteEl.textContent = (stale ? "Showing saved GitHub data from " : "Synced with GitHub · ") + ago(new Date(fetchedAt).toISOString());
  }

  function syncGitHub() {
    var cached = readCache();
    if (cached && Date.now() - cached.t < CACHE_TTL) {
      render(cached.repos, cached.t, false);
      return;
    }
    if (!window.fetch) { if (cached) render(cached.repos, cached.t, true); return; }

    fetch("https://api.github.com/users/" + GH_USER + "/repos?per_page=100&sort=pushed", {
      headers: { Accept: "application/vnd.github+json" }
    })
      .then(function (res) {
        if (!res.ok) throw new Error("GitHub responded " + res.status);
        return res.json();
      })
      .then(function (repos) {
        var now = Date.now();
        safeSet(CACHE_KEY, JSON.stringify({ t: now, repos: repos }));
        render(repos, now, false);
      })
      .catch(function () {
        // Rate limited or offline: use older saved data if we have it, otherwise keep the built-in cards.
        if (cached) render(cached.repos, cached.t, true);
        else noteEl.textContent = "";
      });
  }
  syncGitHub();

  /* ---------- footer year ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();
})();