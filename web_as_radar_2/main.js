(() => {
    'use strict';
    // Dieselben Daten, Formen, Punktabstände und Farben wie in der bestehenden Karte.
    // Die feste Kartengröße hält die Gebiete beim Verschieben unverändert.
    const MAP_WIDTH = 1440;
    const MAP_HEIGHT = 900;
    const BACKGROUND = '#858587';
    const sites = [
        { name: 'google.com', visits: 86.6, kind: 'private' },
        { name: 'youtube.com', visits: 30.4, kind: 'private' },
        { name: 'facebook.com', visits: 11.5, kind: 'private' },
        { name: 'instagram.com', visits: 7.6, kind: 'private' },
        { name: 'chatgpt.com', visits: 5.6, kind: 'private' },
        { name: 'x.com', visits: 4.6, kind: 'private' },
        { name: 'reddit.com', visits: 4.2, kind: 'private' },
        { name: 'bing.com', visits: 3.8, kind: 'private' },
        { name: 'tiktok.com', visits: 3.8, kind: 'private' },
        { name: 'whatsapp.com', visits: 3.7, kind: 'private' },
        { name: 'wikipedia.org', visits: 3.5, kind: 'public' },
        { name: 'yahoo.co.jp', visits: 2.9, kind: 'private' },
        { name: 'amazon.com', visits: 2.8, kind: 'private' },
        { name: 'yahoo.com', visits: 2.7, kind: 'private' },
        { name: 'yandex.ru', visits: 2.7, kind: 'private' }
    ];
    const total = sites.reduce((a, s) => a + s.visits, 0);
    const privateSites = sites.filter(s => s.kind === 'private');
    const key = (x, y) => x + ',' + y;
    const hash = (a, b, c = 0) => { let n = Math.imul(a + 141, 374761393) ^ Math.imul(b + 317, 668265263) ^ Math.imul(c + 19, 2246822519); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296 };
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    function spline(t) {
        // Ein einziger gewundener Weg quer durch die privaten Flächen.
        const anchors = [[.13, .65], [.24, .61], [.34, .57], [.44, .47], [.54, .48], [.64, .43], [.74, .38], [.83, .39]];
        const scaled = t * (anchors.length - 1), i = Math.min(anchors.length - 2, Math.floor(scaled)), u = scaled - i;
        const p0 = anchors[Math.max(0, i - 1)], p1 = anchors[i], p2 = anchors[i + 1], p3 = anchors[Math.min(anchors.length - 1, i + 2)];
        const cat = (k) => .5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
        return [clamp(cat(0), 0, 1), clamp(cat(1), 0, 1)];
    }
    function quotas(n) {
        const exact = sites.map(s => n * s.visits / total), base = exact.map(Math.floor), left = n - base.reduce((a, b) => a + b, 0);
        exact.map((v, i) => ({ i, fraction: v - base[i] })).sort((a, b) => b.fraction - a.fraction).slice(0, left).forEach(o => base[o.i]++);
        return base;
    }
    function allocate(cells, items, depth) {
        if (items.length === 1) { for (const c of cells) c.owner = items[0]; return; }
        const sum = items.reduce((a, i) => a + sites[i].visits, 0), half = sum / 2;
        let running = 0, cut = 1;
        while (cut < items.length - 1 && running + sites[items[cut - 1]].visits < half) { running += sites[items[cut - 1]].visits; cut++ }
        const first = items.slice(0, cut), second = items.slice(cut), ratio = first.reduce((a, i) => a + sites[i].visits, 0) / sum;
        // Wechselnde schräge Achsen und sanfte Wellen lassen die Gebiete ineinandergreifen.
        const angles = [.18, 1.44, -.66, 2.08, .72, -1.10, 2.62];
        const angle = angles[depth % angles.length], cos = Math.cos(angle), sin = Math.sin(angle);
        cells.sort((a, b) => {
            const score = c => {
                const x = c.gx, y = c.gy * 1.35;
                const u = x * cos + y * sin, v = -x * sin + y * cos;
                return u + 3.7 * Math.sin(v * .105 + depth * 1.3) + 1.05 * Math.sin(v * .255 - depth * .7)
            };
            return score(a) - score(b)
        });
        const n = clamp(Math.round(cells.length * ratio), 1, cells.length - 1);
        allocate(cells.slice(0, n), first, depth + 1); allocate(cells.slice(n), second, depth + 1);
    }
    function makeRoad(cells, nx, ny) {
        const byKey = new Map(cells.map(c => [key(c.gx, c.gy), c]));
        function trace(anchors) {
            const ordered = [], seen = new Set();
            for (let k = 0; k <= 2500; k++) {
                const scaled = k / 2500 * (anchors.length - 1), i = Math.min(anchors.length - 2, Math.floor(scaled)), t = scaled - i;
                const p0 = anchors[Math.max(0, i - 1)], p1 = anchors[i], p2 = anchors[i + 1], p3 = anchors[Math.min(anchors.length - 1, i + 2)];
                const axis = a => .5 * ((2 * p1[a]) + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t * t + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t * t * t);
                const x = axis(0), y = axis(1), gx = clamp(Math.round(x * (nx - 1)), 0, nx - 1), gy = clamp(Math.round(y * (ny - 1)), 0, ny - 1), id = key(gx, gy);
                if (!seen.has(id)) { seen.add(id); ordered.push(byKey.get(id)) }
            }
            return ordered.filter(Boolean);
        }
        const joint = [.46, .50];
        return [
            trace([joint, [.37, .51], [.23, .58], [.06, .64]]),
            trace([joint, [.47, .37], [.53, .20], [.60, .03]]),
            trace([joint, [.58, .53], [.71, .63], [.92, .70]])
        ];
    }
    function evenPick(array, n) {
        if (n >= array.length) return array.slice();
        const picked = []; for (let i = 0; i < n; i++)picked.push(array[Math.floor((i + .5) * array.length / n)]); return picked;
    }

    const circle = document.querySelector('.circle');
    const canvas = document.getElementById('map-canvas');
    const locationIcon = document.querySelector('.location-icon');
    const infoLocation = document.querySelector('.info-location');
    const infoVisitors = document.querySelector('.info-visitors');
    const infoType = document.querySelector('.info-type');
    const infoAddress = document.querySelector('.info-adress');
    const mapImage = document.createElement('canvas');
    const IMAGE_SCALE = 3;
    mapImage.width = MAP_WIDTH * IMAGE_SCALE;
    mapImage.height = MAP_HEIGHT * IMAGE_SCALE;
    const w = MAP_WIDTH, h = MAP_HEIGHT;
    const ctx = mapImage.getContext('2d');
    ctx.scale(IMAGE_SCALE, IMAGE_SCALE);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    let geometry, lookup;
    function createMap() {
        const spacing = clamp(w / 96, 10.5, 18), nx = Math.max(18, Math.floor((w - 38) / spacing)), ny = Math.max(16, Math.floor((h - 38) / spacing));
        const left = (w - (nx - 1) * spacing) / 2, top = (h - (ny - 1) * spacing) / 2;
        const cells = []; for (let gy = 0; gy < ny; gy++)for (let gx = 0; gx < nx; gx++)cells.push({ gx, gy, owner: -1 });
        const road = makeRoad(cells, nx, ny);
        const grayFraction = .29;
        const whiteTarget = Math.round(cells.length * (1 - grayFraction) * sites[10].visits / total);
        const budgets = [Math.round((whiteTarget + 2) * .38), Math.round((whiteTarget + 2) * .29)];
        budgets.push(whiteTarget + 2 - budgets[0] - budgets[1]);
        const roadSegments = road.map((arm, i) => arm.slice(0, budgets[i]));
        const whiteCandidates = [...new Map(roadSegments.flat().map(c => [key(c.gx, c.gy), c])).values()];
        const orientedRoad = roadSegments.flatMap(arm => arm.map((point, i) => {
            const before = arm[Math.max(0, i - 1)], after = arm[Math.min(arm.length - 1, i + 1)];
            return { x: point.gx, y: point.gy, dx: after.gx - before.gx, dy: after.gy - before.gy };
        }));
        const whiteSet = new Set(whiteCandidates.map(c => key(c.gx, c.gy)));
        const privateCells = cells.filter(c => !whiteSet.has(key(c.gx, c.gy)));
        allocate(privateCells, privateSites.map(s => sites.indexOf(s)), 0);
        const owners = new Map(privateCells.map(c => [key(c.gx, c.gy), c.owner]));
        // Abstand zu den Plattformübergängen. Graue Bereiche bilden zusammenhängende
        // Buchten und Korridore, ergänzt durch mehrere weiche Einbuchtungen am Kartenrand.
        const byKey = new Map(privateCells.map(c => [key(c.gx, c.gy), c])), queue = [];
        for (const c of privateCells) {
            c.distance = Infinity;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const neighbour = byKey.get(key(c.gx + dx, c.gy + dy));
                if (neighbour && neighbour.owner !== c.owner) { c.distance = 0; queue.push(c); break }
            }
        }
        for (let q = 0; q < queue.length; q++) {
            const c = queue[q];
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const neighbour = byKey.get(key(c.gx + dx, c.gy + dy));
                if (neighbour && neighbour.owner === c.owner && neighbour.distance > c.distance + 1) {
                    neighbour.distance = c.distance + 1; queue.push(neighbour)
                }
            }
        }
        const hollows = [
            [.18, .18, .11, .10, 1.07], [.29, .84, .16, .11, 1.03],
            [.51, .20, .13, .15, 1.01], [.83, .68, .15, .16, 1.08],
            [.94, .08, .12, .12, .91]
        ];
        const grayScore = c => {
            const x = c.gx / (nx - 1), y = c.gy / (ny - 1);
            const boundary = 1.13 * Math.exp(-c.distance / 1.7) * (1 + .14 * Math.sin(c.gy * .19 + c.gx * .11));
            const hollow = Math.max(...hollows.map(([bx, by, sx, sy, weight]) => weight * Math.exp(-.5 * (((x - bx) / sx) ** 2 + ((y - by) / sy) ** 2))));
            const channelY = .24 + .065 * Math.sin(x * 8.4) + .035 * Math.sin(x * 17.2 + 1.1);
            const channel = .99 * Math.exp(-.5 * ((y - channelY) / .036) ** 2) * (1 - .32 * x);
            let nearest = Infinity, side = 0;
            for (const p of orientedRoad) {
                const dx = c.gx - p.x, dy = c.gy - p.y, distance = dx * dx + dy * dy;
                if (distance < nearest) { nearest = distance; side = (p.dx * dy - p.dy * dx) / (Math.hypot(p.dx, p.dy) || 1) }
            }
            // Auf einer Seite des weißen Wegs öffnet sich grauer Raum, auf der anderen bleibt das Gebiet blau.
            const besideRoad = side > 0 ? 1.25 * Math.exp(-.5 * ((Math.sqrt(nearest) - 2.8) / 2.6) ** 2) : 0;
            const edge = Math.min(c.gx, nx - 1 - c.gx, c.gy, ny - 1 - c.gy);
            const rim = .36 * Math.exp(-edge / 3.5) * (1 + .35 * Math.sin(c.gx * .16 - c.gy * .12));
            return Math.max(boundary, hollow, channel, besideRoad) + rim;
        };
        const grayCount = Math.round(cells.length * grayFraction);
        const graySet = new Set(privateCells.slice().sort((a, b) => grayScore(b) - grayScore(a)).slice(0, grayCount).map(c => key(c.gx, c.gy)));
        const blue = privateCells.filter(c => !graySet.has(key(c.gx, c.gy)));
        allocate(blue, privateSites.map(s => sites.indexOf(s)), 0);
        const final = [...blue.map(c => ({ ...c })), ...whiteCandidates.map(c => ({ ...c, owner: 10 }))];
        const radius = Math.max(4.2, clamp(w / 79, 13, 22) * .265);
        for (const c of final) {
            const x = c.gx, y = c.gy;
            c.x = left + x * spacing + spacing * (.28 * Math.sin(y * .11 + x * .04) + .09 * Math.sin(x * .23 - y * .075) + .06 * (hash(x, y, 1) - .5));
            c.y = top + y * spacing + spacing * (.25 * Math.sin(x * .10 - y * .035) + .09 * Math.sin(y * .22 + x * .055) + .06 * (hash(x, y, 2) - .5));
        }
        // Blaue Flächen zuerst, der weiße Weg liegt klar darüber.
        for (const kind of ['private', 'public']) {
            ctx.fillStyle = kind === 'private' ? '#0b3df5' : '#ffffff'; ctx.beginPath();
            for (const c of final) if (sites[c.owner].kind === kind) { ctx.moveTo(c.x + radius, c.y); ctx.arc(c.x, c.y, radius, 0, Math.PI * 2) }
            ctx.fill();
        }
        lookup = new Map(final.map(c => [key(c.gx, c.gy), c]));
        geometry = { left, top, spacing, nx, ny, radius };
    }
    createMap();
    window.publicPointCount = [...lookup.values()].filter(point => sites[point.owner].kind === 'public').length;
    window.isPrivateMapPosition = (x, y) => {
        const gx = Math.round((x - geometry.left) / geometry.spacing);
        const gy = Math.round((y - geometry.top) / geometry.spacing);
        const point = lookup.get(key(gx, gy));
        return Boolean(point && sites[point.owner].kind === 'private');
    };

    // Zeigerkoordinaten im Fenster werden auf den Kartenausschnitt bezogen.
    // An jedem Bildpunkt gilt: mapX/mapY liegt exakt unter dem festen Icon.
    let mapX = MAP_WIDTH / 2, mapY = MAP_HEIGHT / 2;
    let frame = 0;
    function paint() {
        frame = 0;
        const rect = circle.getBoundingClientRect();
        const size = rect.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pixels = Math.round(size * dpr);
        if (canvas.width !== pixels || canvas.height !== pixels) { canvas.width = pixels; canvas.height = pixels; }
        const view = canvas.getContext('2d');
        view.setTransform(dpr, 0, 0, dpr, 0, 0);
        view.fillStyle = BACKGROUND;
        view.fillRect(0, 0, size, size);
        const iconSize = locationIcon.getBoundingClientRect().width;
        const zoom = iconSize / (2 * geometry.radius);
        view.drawImage(mapImage, size / 2 - mapX * zoom, size / 2 - mapY * zoom, MAP_WIDTH * zoom, MAP_HEIGHT * zoom);
    }
    function schedulePaint() { if (!frame) frame = requestAnimationFrame(paint); }
    function describePoint() {
        infoLocation.textContent = `${Math.round(mapX)} × ${Math.round(mapY)}`;
        const { left, top, spacing, nx, ny } = geometry;
        const gx = Math.round((mapX - left) / spacing), gy = Math.round((mapY - top) / spacing);
        const point = (gx >= 0 && gx < nx && gy >= 0 && gy < ny) ? lookup.get(key(gx, gy)) : null;
        const active = point;
        if (active) {
            const site = sites[point.owner];
            infoVisitors.textContent = `${site.visits.toFixed(1)}b`;
            infoType.textContent = site.kind;
            infoAddress.textContent = site.name;
        } else {
            infoVisitors.textContent = '—';
            infoType.textContent = 'public ground';
            infoAddress.textContent = '';
        }
        document.dispatchEvent(new CustomEvent('territorychange', {
            detail: {
                site: active ? sites[active.owner] : null,
                gx: active?.gx, gy: active?.gy,
                x: mapX / MAP_WIDTH, y: mapY / MAP_HEIGHT,
                mapX, mapY,
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
    window.addEventListener('pointermove', event => moveTo(event.clientX, event.clientY), { passive: true });
    window.addEventListener('resize', schedulePaint);
    describePoint();
    schedulePaint();
})();
