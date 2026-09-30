(() => {
  // main_globe.js
  (() => {
    "use strict";
    const MAP_WIDTH = 1440;
    const MAP_HEIGHT = 900;
    const BACKGROUND = "#858587";
    const sites = [
      { name: "google.com", visits: 86.6, kind: "private" },
      { name: "youtube.com", visits: 30.4, kind: "private" },
      { name: "facebook.com", visits: 11.5, kind: "private" },
      { name: "instagram.com", visits: 7.6, kind: "private" },
      { name: "chatgpt.com", visits: 5.6, kind: "private" },
      { name: "x.com", visits: 4.6, kind: "private" },
      { name: "reddit.com", visits: 4.2, kind: "private" },
      { name: "bing.com", visits: 3.8, kind: "private" },
      { name: "tiktok.com", visits: 3.8, kind: "private" },
      { name: "whatsapp.com", visits: 3.7, kind: "private" },
      { name: "wikipedia.org", visits: 3.5, kind: "public" },
      { name: "yahoo.co.jp", visits: 2.9, kind: "private" },
      { name: "amazon.com", visits: 2.8, kind: "private" },
      { name: "yahoo.com", visits: 2.7, kind: "private" },
      { name: "yandex.ru", visits: 2.7, kind: "private" }
    ];
    const total = sites.reduce((a, s) => a + s.visits, 0);
    const privateSites = sites.filter((s) => s.kind === "private");
    const key = (x, y) => x + "," + y;
    const hash = (a, b, c = 0) => {
      let n = Math.imul(a + 141, 374761393) ^ Math.imul(b + 317, 668265263) ^ Math.imul(c + 19, 2246822519);
      n = Math.imul(n ^ n >>> 13, 1274126177);
      return ((n ^ n >>> 16) >>> 0) / 4294967296;
    };
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    function spline(t) {
      const anchors = [[0.13, 0.65], [0.24, 0.61], [0.34, 0.57], [0.44, 0.47], [0.54, 0.48], [0.64, 0.43], [0.74, 0.38], [0.83, 0.39]];
      const scaled = t * (anchors.length - 1), i = Math.min(anchors.length - 2, Math.floor(scaled)), u = scaled - i;
      const p0 = anchors[Math.max(0, i - 1)], p1 = anchors[i], p2 = anchors[i + 1], p3 = anchors[Math.min(anchors.length - 1, i + 2)];
      const cat = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
      return [clamp(cat(0), 0, 1), clamp(cat(1), 0, 1)];
    }
    function quotas(n) {
      const exact = sites.map((s) => n * s.visits / total), base = exact.map(Math.floor), left = n - base.reduce((a, b) => a + b, 0);
      exact.map((v, i) => ({ i, fraction: v - base[i] })).sort((a, b) => b.fraction - a.fraction).slice(0, left).forEach((o) => base[o.i]++);
      return base;
    }
    function allocate(cells, items, depth) {
      if (items.length === 1) {
        for (const c of cells) c.owner = items[0];
        return;
      }
      const sum = items.reduce((a, i) => a + sites[i].visits, 0), half = sum / 2;
      let running = 0, cut = 1;
      while (cut < items.length - 1 && running + sites[items[cut - 1]].visits < half) {
        running += sites[items[cut - 1]].visits;
        cut++;
      }
      const first = items.slice(0, cut), second = items.slice(cut), ratio = first.reduce((a, i) => a + sites[i].visits, 0) / sum;
      const angles = [0.18, 1.44, -0.66, 2.08, 0.72, -1.1, 2.62];
      const angle = angles[depth % angles.length], cos = Math.cos(angle), sin = Math.sin(angle);
      cells.sort((a, b) => {
        const score = (c) => {
          const x = c.gx, y = c.gy * 1.35;
          const u = x * cos + y * sin, v = -x * sin + y * cos;
          return u + 3.7 * Math.sin(v * 0.105 + depth * 1.3) + 1.05 * Math.sin(v * 0.255 - depth * 0.7);
        };
        return score(a) - score(b);
      });
      const n = clamp(Math.round(cells.length * ratio), 1, cells.length - 1);
      allocate(cells.slice(0, n), first, depth + 1);
      allocate(cells.slice(n), second, depth + 1);
    }
    function makeRoad(cells, nx, ny) {
      const byKey = new Map(cells.map((c) => [key(c.gx, c.gy), c]));
      function trace(anchors) {
        const ordered = [], seen = /* @__PURE__ */ new Set();
        for (let k = 0; k <= 2500; k++) {
          const scaled = k / 2500 * (anchors.length - 1), i = Math.min(anchors.length - 2, Math.floor(scaled)), t = scaled - i;
          const p0 = anchors[Math.max(0, i - 1)], p1 = anchors[i], p2 = anchors[i + 1], p3 = anchors[Math.min(anchors.length - 1, i + 2)];
          const axis = (a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t * t + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t * t * t);
          const x = axis(0), y = axis(1), gx = clamp(Math.round(x * (nx - 1)), 0, nx - 1), gy = clamp(Math.round(y * (ny - 1)), 0, ny - 1), id = key(gx, gy);
          if (!seen.has(id)) {
            seen.add(id);
            ordered.push(byKey.get(id));
          }
        }
        return ordered.filter(Boolean);
      }
      const joint = [0.46, 0.5];
      return [
        trace([joint, [0.37, 0.51], [0.23, 0.58], [0.06, 0.64]]),
        trace([joint, [0.47, 0.37], [0.53, 0.2], [0.6, 0.03]]),
        trace([joint, [0.58, 0.53], [0.71, 0.63], [0.92, 0.7]])
      ];
    }
    function evenPick(array, n) {
      if (n >= array.length) return array.slice();
      const picked = [];
      for (let i = 0; i < n; i++) picked.push(array[Math.floor((i + 0.5) * array.length / n)]);
      return picked;
    }
    const circle2 = document.querySelector(".circle");
    const canvas = document.getElementById("map-canvas");
    const tagDebugCanvas = document.getElementById("tag-debug-canvas");
    const locationIcon = document.querySelector(".location-icon");
    const infoLocation = document.querySelector(".info-location");
    const infoVisitors = document.querySelector(".info-visitors");
    const infoType = document.querySelector(".info-type");
    const infoAddress = document.querySelector(".info-adress");
    const mapImage = document.createElement("canvas");
    const IMAGE_SCALE = 3;
    mapImage.width = MAP_WIDTH * IMAGE_SCALE;
    mapImage.height = MAP_HEIGHT * IMAGE_SCALE;
    const w = MAP_WIDTH, h = MAP_HEIGHT;
    const ctx = mapImage.getContext("2d");
    ctx.scale(IMAGE_SCALE, IMAGE_SCALE);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    let geometry, lookup;
    function createMap() {
      const spacing = clamp(w / 96, 10.5, 18), nx = Math.max(18, Math.floor((w - 38) / spacing)), ny = Math.max(16, Math.floor((h - 38) / spacing));
      const left = (w - (nx - 1) * spacing) / 2, top = (h - (ny - 1) * spacing) / 2;
      const cells = [];
      for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) cells.push({ gx, gy, owner: -1 });
      const road = makeRoad(cells, nx, ny);
      const grayFraction = 0.29;
      const whiteTarget = Math.round(cells.length * (1 - grayFraction) * sites[10].visits / total);
      const budgets = [Math.round((whiteTarget + 2) * 0.38), Math.round((whiteTarget + 2) * 0.29)];
      budgets.push(whiteTarget + 2 - budgets[0] - budgets[1]);
      const roadSegments = road.map((arm, i) => arm.slice(0, budgets[i]));
      const whiteCandidates = [...new Map(roadSegments.flat().map((c) => [key(c.gx, c.gy), c])).values()];
      const orientedRoad = roadSegments.flatMap((arm) => arm.map((point, i) => {
        const before = arm[Math.max(0, i - 1)], after = arm[Math.min(arm.length - 1, i + 1)];
        return { x: point.gx, y: point.gy, dx: after.gx - before.gx, dy: after.gy - before.gy };
      }));
      const whiteSet = new Set(whiteCandidates.map((c) => key(c.gx, c.gy)));
      const privateCells = cells.filter((c) => !whiteSet.has(key(c.gx, c.gy)));
      allocate(privateCells, privateSites.map((s) => sites.indexOf(s)), 0);
      const owners = new Map(privateCells.map((c) => [key(c.gx, c.gy), c.owner]));
      const byKey = new Map(privateCells.map((c) => [key(c.gx, c.gy), c])), queue = [];
      for (const c of privateCells) {
        c.distance = Infinity;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const neighbour = byKey.get(key(c.gx + dx, c.gy + dy));
          if (neighbour && neighbour.owner !== c.owner) {
            c.distance = 0;
            queue.push(c);
            break;
          }
        }
      }
      for (let q = 0; q < queue.length; q++) {
        const c = queue[q];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const neighbour = byKey.get(key(c.gx + dx, c.gy + dy));
          if (neighbour && neighbour.owner === c.owner && neighbour.distance > c.distance + 1) {
            neighbour.distance = c.distance + 1;
            queue.push(neighbour);
          }
        }
      }
      const hollows = [
        [0.18, 0.18, 0.11, 0.1, 1.07],
        [0.29, 0.84, 0.16, 0.11, 1.03],
        [0.51, 0.2, 0.13, 0.15, 1.01],
        [0.83, 0.68, 0.15, 0.16, 1.08],
        [0.94, 0.08, 0.12, 0.12, 0.91]
      ];
      const grayScore = (c) => {
        const x = c.gx / (nx - 1), y = c.gy / (ny - 1);
        const boundary = 1.13 * Math.exp(-c.distance / 1.7) * (1 + 0.14 * Math.sin(c.gy * 0.19 + c.gx * 0.11));
        const hollow = Math.max(...hollows.map(([bx, by, sx, sy, weight]) => weight * Math.exp(-0.5 * (((x - bx) / sx) ** 2 + ((y - by) / sy) ** 2))));
        const channelY = 0.24 + 0.065 * Math.sin(x * 8.4) + 0.035 * Math.sin(x * 17.2 + 1.1);
        const channel = 0.99 * Math.exp(-0.5 * ((y - channelY) / 0.036) ** 2) * (1 - 0.32 * x);
        let nearest = Infinity, side = 0;
        for (const p of orientedRoad) {
          const dx = c.gx - p.x, dy = c.gy - p.y, distance = dx * dx + dy * dy;
          if (distance < nearest) {
            nearest = distance;
            side = (p.dx * dy - p.dy * dx) / (Math.hypot(p.dx, p.dy) || 1);
          }
        }
        const besideRoad = side > 0 ? 1.25 * Math.exp(-0.5 * ((Math.sqrt(nearest) - 2.8) / 2.6) ** 2) : 0;
        const edge = Math.min(c.gx, nx - 1 - c.gx, c.gy, ny - 1 - c.gy);
        const rim = 0.36 * Math.exp(-edge / 3.5) * (1 + 0.35 * Math.sin(c.gx * 0.16 - c.gy * 0.12));
        return Math.max(boundary, hollow, channel, besideRoad) + rim;
      };
      const grayCount = Math.round(cells.length * grayFraction);
      const graySet = new Set(privateCells.slice().sort((a, b) => grayScore(b) - grayScore(a)).slice(0, grayCount).map((c) => key(c.gx, c.gy)));
      const blue = privateCells.filter((c) => !graySet.has(key(c.gx, c.gy)));
      allocate(blue, privateSites.map((s) => sites.indexOf(s)), 0);
      const final = [...blue.map((c) => ({ ...c })), ...whiteCandidates.map((c) => ({ ...c, owner: 10 }))];
      const radius = Math.max(4.2, clamp(w / 79, 13, 22) * 0.265);
      for (const c of final) {
        const x = c.gx, y = c.gy;
        c.x = left + x * spacing + spacing * (0.28 * Math.sin(y * 0.11 + x * 0.04) + 0.09 * Math.sin(x * 0.23 - y * 0.075) + 0.06 * (hash(x, y, 1) - 0.5));
        c.y = top + y * spacing + spacing * (0.25 * Math.sin(x * 0.1 - y * 0.035) + 0.09 * Math.sin(y * 0.22 + x * 0.055) + 0.06 * (hash(x, y, 2) - 0.5));
      }
      for (const kind of ["private", "public"]) {
        ctx.fillStyle = kind === "private" ? "#0b3df5" : "#ffffff";
        ctx.beginPath();
        for (const c of final) if (sites[c.owner].kind === kind) {
          ctx.moveTo(c.x + radius, c.y);
          ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      lookup = new Map(final.map((c) => [key(c.gx, c.gy), c]));
      geometry = { left, top, spacing, nx, ny, radius };
    }
    createMap();
    window.publicPointCount = [...lookup.values()].filter((point) => sites[point.owner].kind === "public").length;
    window.isPrivateMapPosition = (x, y) => {
      const gx = Math.round((x - geometry.left) / geometry.spacing);
      const gy = Math.round((y - geometry.top) / geometry.spacing);
      const point = lookup.get(key(gx, gy));
      return Boolean(point && sites[point.owner].kind === "private");
    };
    let mapX = MAP_WIDTH / 2, mapY = MAP_HEIGHT / 2;
    let frame = 0;
    const MAP_MOVEMENT_EASE = 0.16;
    function paint() {
      frame = 0;
      const rect2 = circle2.getBoundingClientRect();
      const size = rect2.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixels = Math.round(size * dpr);
      if (canvas.width !== pixels || canvas.height !== pixels) {
        canvas.width = pixels;
        canvas.height = pixels;
      }
      const view = canvas.getContext("2d");
      view.setTransform(dpr, 0, 0, dpr, 0, 0);
      view.fillStyle = BACKGROUND;
      view.fillRect(0, 0, size, size);
      const iconSize = locationIcon.getBoundingClientRect().width;
      const zoom = iconSize / (2 * geometry.radius);
      view.drawImage(mapImage, size / 2 - mapX * zoom, size / 2 - mapY * zoom, MAP_WIDTH * zoom, MAP_HEIGHT * zoom);
      if (tagDebugCanvas) {
        if (tagDebugCanvas.width !== pixels || tagDebugCanvas.height !== pixels) {
          tagDebugCanvas.width = pixels;
          tagDebugCanvas.height = pixels;
        }
        const debugView = tagDebugCanvas.getContext("2d");
        debugView.setTransform(dpr, 0, 0, dpr, 0, 0);
        debugView.clearRect(0, 0, size, size);
        drawDebugTagMarkers(debugView, size, zoom);
      }
    }
    function drawDebugTagMarkers(view, size, zoom) {
      const tags = window.debugTagMapPositions;
      if (!tags?.length) return;
      view.save();
      view.font = '600 11px monospace';
      view.textAlign = 'center';
      view.textBaseline = 'middle';
      const byId = new Map(tags.map((tag) => [Number(tag.id), tag]));
      view.strokeStyle = 'rgba(35, 240, 168, .32)';
      view.lineWidth = Math.max(1, zoom * 0.7);
      for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 2; column++) {
          const from = byId.get(row * 3 + column);
          const to = byId.get(row * 3 + column + 1);
          drawDebugTagLine(view, from, to, size, zoom);
        }
      }
      for (let column = 0; column < 3; column++) {
        for (let row = 0; row < 2; row++) {
          const from = byId.get(row * 3 + column);
          const to = byId.get((row + 1) * 3 + column);
          drawDebugTagLine(view, from, to, size, zoom);
        }
      }
      for (const tag of tags) {
        const x = size / 2 + (tag.x * MAP_WIDTH - mapX) * zoom;
        const y = size / 2 + (tag.y * MAP_HEIGHT - mapY) * zoom;
        const radius = Math.max(5, Math.min(12, 7 * zoom));
        view.fillStyle = tag.detected ? '#23f0a8' : 'rgba(35, 240, 168, .38)';
        view.strokeStyle = '#071b16';
        view.lineWidth = 2;
        view.beginPath();
        view.arc(x, y, radius, 0, Math.PI * 2);
        view.fill();
        view.stroke();
        view.fillStyle = '#071b16';
        view.fillText(`T${tag.id}`, x, y);
      }
      view.restore();
    }
    function drawDebugTagLine(view, from, to, size, zoom) {
      if (!from || !to) return;
      view.beginPath();
      view.moveTo(size / 2 + (from.x * MAP_WIDTH - mapX) * zoom, size / 2 + (from.y * MAP_HEIGHT - mapY) * zoom);
      view.lineTo(size / 2 + (to.x * MAP_WIDTH - mapX) * zoom, size / 2 + (to.y * MAP_HEIGHT - mapY) * zoom);
      view.stroke();
    }
    function schedulePaint() {
      if (!frame) frame = requestAnimationFrame(paint);
    }
    window.requestGlobePaint = schedulePaint;
    function describePoint() {
      infoLocation.textContent = `${Math.round(mapX)} \xD7 ${Math.round(mapY)}`;
      const { left, top, spacing, nx, ny } = geometry;
      const gx = Math.round((mapX - left) / spacing), gy = Math.round((mapY - top) / spacing);
      const point = gx >= 0 && gx < nx && gy >= 0 && gy < ny ? lookup.get(key(gx, gy)) : null;
      const active = point;
      if (active) {
        const site = sites[point.owner];
        infoVisitors.textContent = `${site.visits.toFixed(1)}b`;
        infoType.textContent = site.kind;
        infoAddress.textContent = site.name;
      } else {
        infoVisitors.textContent = "\u2014";
        infoType.textContent = "public ground";
        infoAddress.textContent = "";
      }
      document.dispatchEvent(new CustomEvent("territorychange", {
        detail: {
          site: active ? sites[active.owner] : null,
          gx: active?.gx,
          gy: active?.gy,
          x: mapX / MAP_WIDTH,
          y: mapY / MAP_HEIGHT,
          mapX,
          mapY,
          zoom: locationIcon.getBoundingClientRect().width / (2 * geometry.radius)
        }
      }));
    }
    function moveTo(clientX, clientY) {
      mapX = clamp(clientX / window.innerWidth, 0, 1) * MAP_WIDTH;
      mapY = clamp(clientY / window.innerHeight, 0, 1) * MAP_HEIGHT;
      describePoint();
      schedulePaint();
    }
    window.setGlobePosition = (x, y) => {
      const targetX = clamp(x, 0, 1) * MAP_WIDTH;
      const targetY = clamp(y, 0, 1) * MAP_HEIGHT;
      mapX += (targetX - mapX) * MAP_MOVEMENT_EASE;
      mapY += (targetY - mapY) * MAP_MOVEMENT_EASE;
      describePoint();
      schedulePaint();
    };
    window.addEventListener("pointermove", (event) => {
      if (!window.aprilTagNavigationEnabled) moveTo(event.clientX, event.clientY);
    }, { passive: true });
    window.addEventListener("resize", schedulePaint);
    describePoint();
    schedulePaint();
  })();

  // experience_globe.js
  (() => {
    const circle2 = document.querySelector(".circle");
    const wiki = document.querySelector(".wiki-panel");
    const frame = wiki.querySelector(".wiki-frame");
    const loading = wiki.querySelector(".wiki-loading");
    const link = wiki.querySelector(".wiki-original");
    const layer = document.querySelector(".private-layer");
    const reveal = document.querySelector(".private-reveal");
    const locationIcon = document.querySelector(".location-icon");
    let revealAnimation = null;
    const articleByPoint = /* @__PURE__ */ new Map();
    const articleQueue = [];
    const articleContentById = /* @__PURE__ */ new Map();
    const shuffle = (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = pick(i + 1);
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    };
    async function fetchRandomWikipediaArticles(amount) {
      const batchSize = 50;
      const batches = Math.ceil(amount / batchSize);
      const requests = Array.from({ length: batches }, async (_, index) => {
        const params = new URLSearchParams({
          action: "query",
          list: "random",
          rnnamespace: "0",
          rnlimit: String(Math.min(batchSize, amount - index * batchSize)),
          format: "json",
          origin: "*"
        });
        const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
        if (!response.ok) throw new Error(`Wikipedia API: ${response.status}`);
        const data = await response.json();
        return data.query?.random ?? [];
      });
      const pages = (await Promise.all(requests)).flat();
      return shuffle([...new Map(pages.map((page) => [page.id, page])).values()]);
    }
    async function preloadWikipediaArticles(pages) {
      const batchSize = 20;
      const batches = [];
      for (let index = 0; index < pages.length; index += batchSize) {
        batches.push(pages.slice(index, index + batchSize));
      }
      await Promise.all(batches.map(async (batch) => {
        if (!batch.length) return;
        const params = new URLSearchParams({
          action: "query",
          format: "json",
          formatversion: "2",
          origin: "*",
          pageids: batch.map((page) => page.id).join("|"),
          prop: "extracts",
          redirects: "1"
        });
        const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
        if (!response.ok) throw new Error(`Wikipedia API: ${response.status}`);
        const data = await response.json();
        for (const page of data.query?.pages || []) {
          if (typeof page.extract === "string") {
            articleContentById.set(page.pageid, { title: page.title, html: page.extract });
          }
        }
      }));
    }
    let poolPromise = fetchRandomWikipediaArticles(window.publicPointCount || 100).then((pages) => {
      articleQueue.push(...pages);
      preloadWikipediaArticles(pages).catch(() => {
      });
    }).catch(() => {
    });
    async function pageForPoint(id) {
      if (articleByPoint.has(id)) return articleByPoint.get(id);
      await poolPromise;
      if (!articleQueue.length) {
        poolPromise = fetchRandomWikipediaArticles(50).then((pages) => {
          articleQueue.push(...pages);
          preloadWikipediaArticles(pages).catch(() => {
          });
        });
        await poolPromise;
      }
      const page = articleQueue.pop();
      if (!page) throw new Error("No random article available");
      articleByPoint.set(id, page);
      return page;
    }
    const colors = ["#ee645b", "#ffc247", "#8bd9c4", "#8b94ef", "#f39bd2", "#a7df60", "#62b9ee"];
    const manifestPromise = fetch("assets/content-manifest.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Manifest missing");
      return response.json();
    }).catch(() => ({}));
    const imageURL = (path) => path.split("/").map(encodeURIComponent).join("/");
    let popupCount = 0;
    let mode = "", pointId = "", requestId = 0;
    let popupTimer = null, lastPopupAt = 0, lastSpawnX = 0, lastSpawnY = 0;
    let position = { mapX: 720, mapY: 450, zoom: 1, siteName: "" };
    const pick = (n) => Math.floor(Math.random() * n);
    function placePopups() {
      const size = circle2.getBoundingClientRect().width;
      for (const popup of layer.children) {
        const x = Number(popup.dataset.mapX);
        const y = Number(popup.dataset.mapY);
        popup.style.left = `${size / 2 + (x - position.mapX) * position.zoom}px`;
        popup.style.top = `${size / 2 + (y - position.mapY) * position.zoom}px`;
      }
    }
    function addPopup() {
      const size = circle2.getBoundingClientRect().width;
      let anchor = { x: position.mapX, y: position.mapY };
      for (let attempt = 0; attempt < 36; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = size * (0.35 + Math.random() * 0.12) / position.zoom;
        const candidate = {
          x: position.mapX + Math.cos(angle) * distance,
          y: position.mapY + Math.sin(angle) * distance
        };
        if (window.isPrivateMapPosition(candidate.x, candidate.y)) {
          anchor = candidate;
          break;
        }
      }
      const popup = document.createElement("div");
      popup.className = "territory-popup";
      popup.setAttribute("aria-hidden", "true");
      popup.dataset.mapX = String(anchor.x);
      popup.dataset.mapY = String(anchor.y);
      popup.style.backgroundColor = colors[pick(colors.length)];
      const large = Math.random() < 0.22;
      popup.style.setProperty("--popup-width", `${large ? 46 + pick(13) : 28 + pick(15)}%`);
      popup.style.setProperty("--popup-height", `${large ? 52 + pick(17) : 29 + pick(23)}%`);
      const siteName = position.siteName;
      const popupNumber = ++popupCount;
      manifestPromise.then((manifest) => {
        if (!popup.isConnected || mode !== "private") return;
        const siteImages = manifest[siteName] || [];
        const adImages = manifest.ads || [];
        const useAd = popupNumber > 1 && adImages.length > 0 && Math.random() < 0.22;
        const images = useAd ? adImages : siteImages;
        if (!images.length) return;
        if (useAd) {
          popup.style.setProperty("--popup-width", `${76 + pick(13)}%`);
          popup.style.setProperty("--popup-height", `${78 + pick(13)}%`);
        }
        const img = document.createElement("img");
        img.alt = useAd ? "Advertisement" : `${siteName} content`;
        img.src = imageURL(images[pick(images.length)]);
        img.onerror = () => {
          img.remove();
          popup.classList.remove("has-image");
        };
        popup.append(img);
        popup.classList.add("has-image");
      });
      popup.style.zIndex = String(layer.childElementCount + 1);
      layer.append(popup);
      lastPopupAt = performance.now();
      lastSpawnX = position.mapX;
      lastSpawnY = position.mapY;
      placePopups();
      requestAnimationFrame(() => popup.classList.add("visible"));
    }
    function startPopups() {
      addPopup();
      popupTimer = window.setInterval(() => {
        if (mode === "private") addPopup();
      }, 650);
    }
    function stopPopups() {
      window.clearInterval(popupTimer);
      popupTimer = null;
      layer.replaceChildren();
    }
    function animatePrivateBoundary(entering) {
      const circleSize = circle2.getBoundingClientRect().width;
      const small = locationIcon.getBoundingClientRect().width / circleSize;
      const wasAnimating = reveal.classList.contains("is-active");
      const from = wasAnimating ? reveal.getBoundingClientRect().width / circleSize : entering ? small : 1;
      revealAnimation?.cancel();
      circle2.style.setProperty("--reveal-start", String(small));
      circle2.classList.remove("private-ready");
      reveal.classList.add("is-active");
      const to = entering ? 1 : small;
      const animation = reveal.animate(
        [{ transform: `scale(${from})` }, { transform: `scale(${to})` }],
        {
          duration: Math.max(150, 800 * Math.abs(to - from) / (1 - small)),
          easing: "cubic-bezier(.22, .65, .22, 1)",
          fill: "forwards"
        }
      );
      revealAnimation = animation;
      animation.onfinish = () => {
        if (revealAnimation !== animation) return;
        if (entering && mode === "private") circle2.classList.add("private-ready");
        reveal.classList.remove("is-active");
        animation.cancel();
        revealAnimation = null;
      };
    }
    const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
    function cleanArticleHTML(html) {
      const article2 = new DOMParser().parseFromString(html, "text/html");
      article2.querySelectorAll("script, iframe, object, embed").forEach((node) => node.remove());
      for (const element of article2.body.querySelectorAll("*")) {
        for (const attribute of [...element.attributes]) {
          if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
        }
      }
      return article2.body.innerHTML;
    }
    function articleDocument(pageTitle, articleHTML) {
      const safeTitle = escapeHTML(pageTitle);
      return `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https://upload.wikimedia.org https://thumb.wikimedia.org https://en.wikipedia.org data:; media-src https://upload.wikimedia.org https://thumb.wikimedia.org; style-src 'unsafe-inline'">
      <base href="https://en.wikipedia.org/">
      <style>
        * {box-sizing:border-box} html {scroll-behavior:auto} body {margin:0;background:#fff;color:#202122;font:16px/1.65 Arial,Helvetica,sans-serif}
        .page {padding:14px 24px 80px;max-width:1200px;margin:auto}
        h1 {font:normal 2em/1.3 Georgia,serif;border-bottom:1px solid #a2a9b1;margin:0 0 6px}
        .tabs {display:flex;justify-content:space-between;border-bottom:1px solid #a2a9b1;padding:3px 0 8px;margin-bottom:22px;font-size:14px;color:#36c}
        .tabs b {color:#202122;border-bottom:2px solid #202122;padding-bottom:8px}
        .mw-parser-output {overflow:visible} p {margin:.5em 0 1em} a {color:#36c;text-decoration:none}
        h2 {font:normal 1.5em Georgia,serif;border-bottom:1px solid #a2a9b1;margin:1.2em 0 .35em}
        h3 {font-size:1.15em;margin:1.2em 0 .35em} img {max-width:100%;height:auto}
        .infobox {float:right;clear:right;width:38%;margin:0 0 1em 1.2em;border:1px solid #a2a9b1;background:#f8f9fa;font-size:90%;border-collapse:collapse}
        .infobox th,.infobox td {padding:4px 7px;vertical-align:top} .infobox img {max-width:100%}
        .thumb.tright,.thumb.floatright {float:right;clear:right;margin:.5em 0 1em 1em}
        .thumb.tleft {float:left;margin:.5em 1em 1em 0}
        .thumbinner {border:1px solid #a2a9b1;background:#f8f9fa;padding:4px;max-width:100%}
        .thumbcaption {font-size:85%;line-height:1.35}
        .wikitable {border-collapse:collapse;background:#f8f9fa;margin:1em 0}
        .wikitable th,.wikitable td {border:1px solid #a2a9b1;padding:.3em .5em}
        .hatnote {font-style:italic;margin-bottom:1em;color:#54595d}
        .toc {display:none} sup.reference {font-size:75%;line-height:0}
        .mw-empty-elt,.mw-editsection,.navbox,.metadata {display:none}
      </style></head><body><main class="page">
      <h1>${safeTitle}</h1>
      <div class="tabs"><span><b>Article</b>&nbsp;&nbsp; Talk</span><span><b>Read</b>&nbsp;&nbsp; View source&nbsp;&nbsp; View history</span></div>
      ${articleHTML}</main></body></html>`;
    }
    async function article(id) {
      if (pointId === id) return;
      pointId = id;
      scrollPosition = 0;
      const token = ++requestId;
      frame.removeAttribute("srcdoc");
      loading.textContent = "Loading Wikipedia article \u2026";
      loading.hidden = false;
      link.removeAttribute("href");
      wiki.hidden = false;
      try {
        const page = await pageForPoint(id);
        if (token !== requestId) return;
        let content = articleContentById.get(page.id);
        if (!content) {
          const params = new URLSearchParams({
            action: "parse",
            format: "json",
            formatversion: "2",
            origin: "*",
            pageid: String(page.id),
            prop: "text",
            redirects: "1",
            disableeditsection: "1"
          });
          const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
          if (!response.ok) throw new Error(`Wikipedia API: ${response.status}`);
          const data = await response.json();
          const html = data.parse?.text;
          if (typeof html !== "string") throw new Error("No parsed article HTML");
          content = { title: data.parse.title || page.title, html };
          articleContentById.set(page.id, content);
        }
        if (token !== requestId) return;
        frame.onload = () => {
          if (token === requestId) loading.hidden = true;
        };
        frame.srcdoc = articleDocument(content.title || page.title, cleanArticleHTML(content.html));
        link.href = "https://en.wikipedia.org/wiki/" + encodeURIComponent(content.title || page.title);
      } catch (error) {
        if (token === requestId) loading.textContent = "The article could not be loaded. Try another point.";
      }
    }
    function hideArticle() {
      if (!pointId) return;
      pointId = "";
      ++requestId;
      frame.onload = null;
      frame.removeAttribute("srcdoc");
      wiki.hidden = true;
    }
    document.addEventListener("territorychange", ({ detail }) => {
      const { site, gx, gy, mapX, mapY, zoom } = detail;
      position = { mapX, mapY, zoom, siteName: site?.name || "" };
      const next = site?.kind === "private" ? "private" : "public";
      if (next !== mode) {
        const previous = mode;
        mode = next;
        circle2.dataset.mode = mode;
        if (mode === "private") {
          hideArticle();
          startPopups();
        } else stopPopups();
        if (mode === "private") animatePrivateBoundary(true);
        else if (previous === "private") animatePrivateBoundary(false);
      }
      if (mode === "public" && site?.kind === "public") article(gx + "," + gy);
      else hideArticle();
      if (mode === "private") {
        placePopups();
        const traveled = Math.hypot(mapX - lastSpawnX, mapY - lastSpawnY);
        if (traveled > 90 && performance.now() - lastPopupAt > 350) addPopup();
      }
    });
    let last = 0, scrollPosition = 0;
    function scroll(time) {
      if (mode === "public" && pointId && loading.hidden && time - last > 40) {
        scrollPosition += 0.35;
        try {
          frame.contentWindow.scrollTo(0, scrollPosition);
        } catch (error) {
        }
        last = time;
      } else if (!pointId) scrollPosition = 0;
      requestAnimationFrame(scroll);
    }
    requestAnimationFrame(scroll);
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: innerWidth / 2, clientY: innerHeight / 2 }));
  })();

  // main_apriltag.js
  var TAG_IDS = new Set(Array.from({ length: 9 }, (_, id) => id));
  var mapWidth = 1498;
  var mapHeight = 927;
  var SQUARE_SIZE_METRES = 3;
  var TAG_SIZE_METRES = 0.17;
  var TAG_EDGE_MARGIN_METRES = 0.2;
  var TAG_WORLD_POSITIONS = {};
  var TAG_SCREEN_POSITIONS = {};
  var tagsPerSide = Math.sqrt(TAG_IDS.size);
  var tagGridSpanMetres = SQUARE_SIZE_METRES - TAG_EDGE_MARGIN_METRES * 2;
  var tagSpacingMetres = tagGridSpanMetres / (tagsPerSide - 1);
  for (let row = 0; row < tagsPerSide; row++) {
    for (let column = 0; column < tagsPerSide; column++) {
      const id = row * tagsPerSide + column;
      const x = TAG_EDGE_MARGIN_METRES + column * tagSpacingMetres;
      const y = TAG_EDGE_MARGIN_METRES + row * tagSpacingMetres;
      TAG_WORLD_POSITIONS[id] = { x, y };
      TAG_SCREEN_POSITIONS[id] = {
        x: mapWidth * x / SQUARE_SIZE_METRES,
        y: mapHeight * y / SQUARE_SIZE_METRES
      };
    }
  }
  window.debugTagMapPositions = Object.entries(TAG_WORLD_POSITIONS).map(([id, position]) => ({
    id,
    x: position.x / SQUARE_SIZE_METRES,
    y: position.y / SQUARE_SIZE_METRES,
    detected: false
  }));
  window.requestGlobePaint?.();
  var POINT_TARGET_PAUSE_MS = 400;
  var POINT_MAX_SPEED = 0.25;
  var POINT_MAX_ACCELERATION = 0.5;
  var POINT_STOP_DISTANCE = 5e-3;
  var pointXMetres = SQUARE_SIZE_METRES / 2;
  var pointYMetres = SQUARE_SIZE_METRES / 2;
  var detectedTags = {};
  var apriltag = null;
  var detecting = false;
  var cameraHeading = 0;
  var pointerHeading = null;
  var cameraPoseValid = false;
  var smoothedCameraX = null;
  var smoothedCameraY = null;
  var smoothedCameraHeading = null;
  var multiTagTargetId = null;
  var pointTargetMode = null;
  var pointPauseUntil = 0;
  var pointVelocityX = 0;
  var pointVelocityY = 0;
  var lastPointUpdateAt = null;
  var video;
  var cameraOverlay;
  var cameraCanvas;
  var cameraStream;
  var cameraSelect;
  var selectedCameraId = "";
  var cameraWidth = 640;
  var cameraHeight = 480;
  async function setup() {
    const trackingCanvas = createCanvas(mapWidth, mapHeight);
    trackingCanvas.parent(document.getElementById("tracking-layer"));
    video = document.getElementById("video");
    cameraOverlay = document.getElementById("camera-overlay");
    cameraSelect = document.getElementById("camera-select");
    cameraSelect.addEventListener("change", async () => {
      selectedCameraId = cameraSelect.value;
      await startCamera();
    });
    if (!video) {
      setStatus("Video element not found");
      return;
    }
    await startCamera();
    if (!cameraStream) return;
    await startAprilTag();
  }
  async function startCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    const videoConstraints = {
      width: { ideal: cameraWidth },
      height: { ideal: cameraHeight }
    };
    if (selectedCameraId) {
      videoConstraints.deviceId = { exact: selectedCameraId };
    } else {
      videoConstraints.facingMode = "environment";
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      video.srcObject = cameraStream;
      await video.play();
      await updateCameraList();
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cameraWidth = video.videoWidth;
        cameraHeight = video.videoHeight;
      }
      cameraCanvas = document.createElement("canvas");
      cameraCanvas.width = cameraWidth;
      cameraCanvas.height = cameraHeight;
      cameraOverlay.width = cameraWidth;
      cameraOverlay.height = cameraHeight;
      setStatus("Camera ready - loading AprilTag...");
    } catch (error) {
      console.error("Camera error:", error);
      setStatus("Could not access camera");
    }
  }
  async function updateCameraList() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    cameraSelect.replaceChildren();
    cameras.forEach((camera, index) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.textContent = camera.label || `Camera ${index + 1}`;
      cameraSelect.appendChild(option);
    });
    const activeTrack = cameraStream?.getVideoTracks()[0];
    selectedCameraId = activeTrack?.getSettings().deviceId || selectedCameraId;
    if (selectedCameraId) cameraSelect.value = selectedCameraId;
    cameraSelect.disabled = cameras.length < 2;
  }
  async function startAprilTag() {
    try {
      setStatus("Loading AprilTag WASM...");
      const worker = new Worker("apriltag/apriltag.js");
      const Apriltag = Comlink.wrap(worker);
      apriltag = await new Apriltag(Comlink.proxy(() => {
        setStatus("AprilTag ready - show all 9 tags");
        requestAnimationFrame(detectFrame);
      }));
    } catch (error) {
      console.error("AprilTag initialization error:", error);
      setStatus("AprilTag failed - check console");
    }
  }
  async function detectFrame() {
    if (!apriltag || !video || video.readyState < 2 || detecting) {
      requestAnimationFrame(detectFrame);
      return;
    }
    detecting = true;
    const context = cameraCanvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(video, 0, 0, cameraWidth, cameraHeight);
    try {
      const pixels = context.getImageData(0, 0, cameraWidth, cameraHeight).data;
      const grayscalePixels = new Uint8Array(cameraWidth * cameraHeight);
      for (let pixel = 0, gray = 0; pixel < pixels.length; pixel += 4, gray++) {
        grayscalePixels[gray] = Math.round((pixels[pixel] + pixels[pixel + 1] + pixels[pixel + 2]) / 3);
      }
      const detections = await apriltag.detect(grayscalePixels, cameraWidth, cameraHeight);
      detectedTags = {};
      for (const detection of detections) {
        if (TAG_IDS.has(detection.id)) detectedTags[detection.id] = detection;
      }
      if (window.debugTagMapPositions) {
        for (const tag of window.debugTagMapPositions) tag.detected = Boolean(detectedTags[tag.id]);
        window.requestGlobePaint?.();
      }
      drawCameraOverlay();
      calculateCameraPose();
      const numberOfTags = Object.keys(detectedTags).length;
      if (numberOfTags > 0) {
        if (cameraPoseValid) {
          setStatus(`Tracking - ${numberOfTags}/9 tags | point x: ${formatCoordinate(pointXMetres)} m, y: ${formatCoordinate(pointYMetres)} m | heading ${Math.round(cameraHeading)} deg`);
        } else {
          setStatus(`Tracking - ${numberOfTags}/9 AprilTags detected`);
        }
      } else {
        cameraPoseValid = false;
        pointTargetMode = null;
        multiTagTargetId = null;
        pointVelocityX = 0;
        pointVelocityY = 0;
        lastPointUpdateAt = null;
        setStatus("Show the AprilTags - 0/9 detected");
      }
    } catch (error) {
      console.error("AprilTag detection error:", error);
    }
    detecting = false;
    requestAnimationFrame(detectFrame);
  }
  function calculateCameraPose() {
    const correspondences = [];
    for (const detection of Object.values(detectedTags)) {
      const worldCenter = TAG_WORLD_POSITIONS[detection.id];
      const corners = detection.corners;
      if (!worldCenter || !Array.isArray(corners) || corners.length < 4) continue;
      const halfTagSize = TAG_SIZE_METRES / 2;
      const worldCorners = [
        { x: -halfTagSize, y: -halfTagSize },
        { x: halfTagSize, y: -halfTagSize },
        { x: halfTagSize, y: halfTagSize },
        { x: -halfTagSize, y: halfTagSize }
      ].map((corner) => ({
        x: worldCenter.x + corner.x,
        y: worldCenter.y + corner.y
      }));
      for (let cornerIndex = 0; cornerIndex < 4; cornerIndex++) {
        correspondences.push({ world: worldCorners[cornerIndex], image: corners[cornerIndex] });
      }
    }
    const homography = solveHomography(correspondences);
    if (!homography) {
      cameraPoseValid = false;
      return;
    }
    const imageCenter = { x: cameraWidth / 2, y: cameraHeight / 2 };
    const mapPosition = projectImageToWorld(homography, imageCenter);
    const imageUp = projectImageToWorld(homography, {
      x: imageCenter.x,
      y: imageCenter.y - Math.min(cameraWidth, cameraHeight) * 0.15
    });
    if (!mapPosition || !imageUp) {
      cameraPoseValid = false;
      return;
    }
    const heading = Math.atan2(imageUp.y - mapPosition.y, imageUp.x - mapPosition.x) * 180 / Math.PI;
    const poseSmoothing = 0.25;
    smoothedCameraX = smoothedCameraX === null ? mapPosition.x : lerp(smoothedCameraX, mapPosition.x, poseSmoothing);
    smoothedCameraY = smoothedCameraY === null ? mapPosition.y : lerp(smoothedCameraY, mapPosition.y, poseSmoothing);
    smoothedCameraHeading = smoothedCameraHeading === null ? heading : interpolateAngle(smoothedCameraHeading, heading, poseSmoothing);
    updatePointPosition();
    cameraHeading = smoothedCameraHeading;
    window.setGlobePosition?.(pointXMetres / SQUARE_SIZE_METRES, pointYMetres / SQUARE_SIZE_METRES);
    const targetHeading = getPointHeading();
    pointerHeading = pointerHeading === null ? targetHeading : interpolateAngle(pointerHeading, targetHeading, 0.25);
    document.documentElement.style.setProperty("--pointer-angle", `${pointerHeading}deg`);
    cameraPoseValid = true;
  }
  function getPointHeading() {
    const tagEntries = Object.entries(detectedTags);
    if (tagEntries.length === 0) return cameraHeading;
    const targetId = multiTagTargetId && detectedTags[multiTagTargetId] ? multiTagTargetId : findClosestTagId(tagEntries);
    const targetPosition = TAG_WORLD_POSITIONS[targetId];
    if (!targetPosition) return cameraHeading;
    const differenceX = targetPosition.x - pointXMetres;
    const differenceY = targetPosition.y - pointYMetres;
    if (Math.hypot(differenceX, differenceY) <= POINT_STOP_DISTANCE) return cameraHeading;
    return Math.atan2(differenceY, differenceX) * 180 / Math.PI;
  }
  function updatePointPosition() {
    const tagEntries = Object.entries(detectedTags);
    const now = performance.now();
    let targetPosition;
    let targetMode;
    let targetId = null;
    if (tagEntries.length >= 2) {
      targetMode = "tag";
      const retainedTargetId = multiTagTargetId && detectedTags[multiTagTargetId] ? multiTagTargetId : null;
      targetId = retainedTargetId || findClosestTagId(tagEntries);
      targetPosition = TAG_WORLD_POSITIONS[targetId];
    } else {
      targetMode = "camera";
      targetPosition = { x: smoothedCameraX, y: smoothedCameraY };
    }
    if (!targetPosition) return;
    const targetChanged = pointTargetMode !== targetMode || targetMode === "tag" && multiTagTargetId !== targetId;
    if (targetChanged) {
      pointTargetMode = targetMode;
      multiTagTargetId = targetId;
      pointPauseUntil = now + POINT_TARGET_PAUSE_MS;
      pointVelocityX = 0;
      pointVelocityY = 0;
      lastPointUpdateAt = now;
      return;
    }
    if (now < pointPauseUntil) return;
    const deltaSeconds = Math.min((now - lastPointUpdateAt) / 1e3, 0.1);
    lastPointUpdateAt = now;
    const differenceX = targetPosition.x - pointXMetres;
    const differenceY = targetPosition.y - pointYMetres;
    const distance = Math.hypot(differenceX, differenceY);
    if (distance <= POINT_STOP_DISTANCE) {
      pointXMetres = targetPosition.x;
      pointYMetres = targetPosition.y;
      pointVelocityX = 0;
      pointVelocityY = 0;
      return;
    }
    const desiredSpeed = Math.min(POINT_MAX_SPEED, distance / deltaSeconds);
    const desiredVelocityX = differenceX / distance * desiredSpeed;
    const desiredVelocityY = differenceY / distance * desiredSpeed;
    const maxVelocityChange = POINT_MAX_ACCELERATION * deltaSeconds;
    pointVelocityX = approach(pointVelocityX, desiredVelocityX, maxVelocityChange);
    pointVelocityY = approach(pointVelocityY, desiredVelocityY, maxVelocityChange);
    pointXMetres = constrain(pointXMetres + pointVelocityX * deltaSeconds, 0, SQUARE_SIZE_METRES);
    pointYMetres = constrain(pointYMetres + pointVelocityY * deltaSeconds, 0, SQUARE_SIZE_METRES);
  }
  function approach(current, target, maximumChange) {
    if (Math.abs(target - current) <= maximumChange) return target;
    return current + Math.sign(target - current) * maximumChange;
  }
  function findClosestTagId(tagEntries) {
    return tagEntries.reduce((closestId, [id, detection]) => {
      const closestDetection = detectedTags[closestId];
      return detectionArea(detection) > detectionArea(closestDetection) ? id : closestId;
    }, tagEntries[0][0]);
  }
  function detectionArea(detection) {
    if (!detection || !Array.isArray(detection.corners) || detection.corners.length < 4) return 0;
    return Math.abs(detection.corners.reduce((area, corner, index, corners) => {
      const nextCorner = corners[(index + 1) % corners.length];
      return area + corner.x * nextCorner.y - nextCorner.x * corner.y;
    }, 0) / 2);
  }
  function interpolateAngle(from, to, amount) {
    const difference = (to - from + 540) % 360 - 180;
    return from + difference * amount;
  }
  function solveHomography(correspondences) {
    if (correspondences.length < 4) return null;
    const matrix = Array.from({ length: 8 }, () => Array(9).fill(0));
    for (const correspondence of correspondences) {
      const { x, y } = correspondence.world;
      const { x: imageX, y: imageY } = correspondence.image;
      addHomographyEquation(matrix, [x, y, 1, 0, 0, 0, -imageX * x, -imageX * y], imageX);
      addHomographyEquation(matrix, [0, 0, 0, x, y, 1, -imageY * x, -imageY * y], imageY);
    }
    for (let pivot = 0; pivot < 8; pivot++) {
      let pivotRow = pivot;
      for (let row = pivot + 1; row < 8; row++) {
        if (Math.abs(matrix[row][pivot]) > Math.abs(matrix[pivotRow][pivot])) pivotRow = row;
      }
      if (Math.abs(matrix[pivotRow][pivot]) < 1e-9) return null;
      [matrix[pivot], matrix[pivotRow]] = [matrix[pivotRow], matrix[pivot]];
      const pivotValue = matrix[pivot][pivot];
      for (let column = pivot; column <= 8; column++) matrix[pivot][column] /= pivotValue;
      for (let row = 0; row < 8; row++) {
        if (row === pivot) continue;
        const factor = matrix[row][pivot];
        for (let column = pivot; column <= 8; column++) matrix[row][column] -= factor * matrix[pivot][column];
      }
    }
    return [...matrix.map((row) => row[8]), 1];
  }
  function addHomographyEquation(matrix, coefficients, result) {
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        matrix[row][column] += coefficients[row] * coefficients[column];
      }
      matrix[row][8] += coefficients[row] * result;
    }
  }
  function projectImageToWorld(homography, imagePoint) {
    const [h0, h1, h2, h3, h4, h5, h6, h7] = homography;
    const determinant = h0 * (h4 - h5 * h7) - h1 * (h3 - h5 * h6) + h2 * (h3 * h7 - h4 * h6);
    if (Math.abs(determinant) < 1e-9) return null;
    const inverse = [
      (h4 - h5 * h7) / determinant,
      (h2 * h7 - h1) / determinant,
      (h1 * h5 - h2 * h4) / determinant,
      (h5 * h6 - h3) / determinant,
      (h0 - h2 * h6) / determinant,
      (h2 * h3 - h0 * h5) / determinant,
      (h3 * h7 - h4 * h6) / determinant,
      (h1 * h6 - h0 * h7) / determinant,
      (h0 * h4 - h1 * h3) / determinant
    ];
    const denominator = inverse[6] * imagePoint.x + inverse[7] * imagePoint.y + inverse[8];
    if (Math.abs(denominator) < 1e-9) return null;
    return {
      x: (inverse[0] * imagePoint.x + inverse[1] * imagePoint.y + inverse[2]) / denominator,
      y: (inverse[3] * imagePoint.x + inverse[4] * imagePoint.y + inverse[5]) / denominator
    };
  }
  function drawCameraOverlay() {
    if (!cameraOverlay) return;
    const context = cameraOverlay.getContext("2d");
    context.clearRect(0, 0, cameraWidth, cameraHeight);
    context.lineJoin = "round";
    context.font = "600 13px monospace";
    context.textBaseline = "top";
    for (const detection of Object.values(detectedTags)) {
      const corners = detection.corners;
      if (!Array.isArray(corners) || corners.length < 4) continue;
      const xValues = corners.map((corner) => corner.x);
      const yValues = corners.map((corner) => corner.y);
      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);
      const angle = Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x) * 180 / Math.PI;
      const center = detection.center || {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2
      };
      const label = `ID ${detection.id}  X ${Math.round(center.x)} Y ${Math.round(center.y)}  W ${Math.round(maxX - minX)} H ${Math.round(maxY - minY)}  ${Math.round(angle)} deg`;
      const labelHeight = 20;
      const labelWidth = context.measureText(label).width + 12;
      const labelX = Math.max(0, Math.min(minX, cameraWidth - labelWidth));
      const labelY = Math.max(0, minY - labelHeight - 4);
      context.strokeStyle = "#23f0a8";
      context.lineWidth = 3;
      context.strokeRect(minX, minY, maxX - minX, maxY - minY);
      context.beginPath();
      context.moveTo(corners[0].x, corners[0].y);
      for (const corner of corners.slice(1)) context.lineTo(corner.x, corner.y);
      context.closePath();
      context.strokeStyle = "#ffe66d";
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = "rgba(8, 18, 25, 0.88)";
      context.fillRect(labelX, labelY, labelWidth, labelHeight);
      context.fillStyle = "#ffffff";
      context.fillText(label, labelX + 6, labelY + 3);
      context.fillStyle = "#ffe66d";
      for (const corner of corners) {
        context.beginPath();
        context.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  function formatCoordinate(value) {
    return value.toFixed(3);
  }
  function setStatus(message) {
    const status = document.getElementById("status");
    if (status) status.textContent = message;
  }
  window.setup = setup;
})();
