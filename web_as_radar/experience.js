// Interaction layer: map position is exposed by main.js through the experience event.
(() => {
    const circle = document.querySelector('.circle');
    const wiki = document.querySelector('.wiki-panel');
    const frame = wiki.querySelector('.wiki-frame');
    const loading = wiki.querySelector('.wiki-loading');
    const link = wiki.querySelector('.wiki-original');
    const layer = document.querySelector('.private-layer');
    const reveal = document.querySelector('.private-reveal');
    const locationIcon = document.querySelector('.location-icon');
    let revealAnimation = null;
    const articleByPoint = new Map();
    const documentByPoint = new Map();
    const articleQueue = [];
    let refillPromise = null;
    const shuffle = items => {
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
                action: 'query', list: 'random', rnnamespace: '0',
                rnlimit: String(Math.min(batchSize, amount - index * batchSize)),
                format: 'json', origin: '*'
            });
            const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
            if (!response.ok) throw new Error(`Wikipedia API: ${response.status}`);
            const data = await response.json();
            return data.query?.random ?? [];
        });
        const pages = (await Promise.all(requests)).flat();
        return shuffle([...new Map(pages.map(page => [page.id, page])).values()]);
    }
    // Ein Pool für die weißen Punkte: keine neuen Zufallstreffer bei jedem Frame.
    let poolPromise = fetchRandomWikipediaArticles(window.publicPointCount || 100)
        .then(pages => { articleQueue.push(...pages); })
        .catch(() => { });
    async function pageForPoint(id) {
        if (articleByPoint.has(id)) return articleByPoint.get(id);
        await poolPromise;
        if (!articleQueue.length) {
            if (!refillPromise) refillPromise = fetchRandomWikipediaArticles(50)
                .then(pages => { articleQueue.push(...pages); })
                .finally(() => { refillPromise = null; });
            await refillPromise;
        }
        const page = articleQueue.pop();
        if (!page) throw new Error('No random article available');
        articleByPoint.set(id, page);
        return page;
    }
    // Die Pop-ups haben Weltkoordinaten. Ihre Bildschirmposition folgt derselben
    // Projektion wie die Karte: Kreiszentrum + (Anker - Standort) * Zoom.
    const colors = ['#ee645b', '#ffc247', '#8bd9c4', '#8b94ef', '#f39bd2', '#a7df60', '#62b9ee'];
    const manifestPromise = fetch('assets/content-manifest.json', { cache: 'no-store' })
        .then(response => { if (!response.ok) throw new Error('Manifest missing'); return response.json(); })
        .catch(() => ({}));
    const imageURL = path => path.split('/').map(encodeURIComponent).join('/');
    let popupCount = 0;
    let mode = '', pointId = '', requestId = 0;
    let popupTimer = null, lastPopupAt = 0, lastSpawnX = 0, lastSpawnY = 0;
    let position = { mapX: 720, mapY: 450, zoom: 1, siteName: '' };
    const pick = n => Math.floor(Math.random() * n);
    function placePopups() {
        const size = circle.getBoundingClientRect().width;
        for (const popup of layer.children) {
            const x = Number(popup.dataset.mapX);
            const y = Number(popup.dataset.mapY);
            popup.style.left = `${size / 2 + (x - position.mapX) * position.zoom}px`;
            popup.style.top = `${size / 2 + (y - position.mapY) * position.zoom}px`;
        }
    }
    function addPopup() {
        const size = circle.getBoundingClientRect().width;
        // Der Anker liegt knapp am Rand des Sichtfelds, bleibt aber im privaten Gebiet.
        let anchor = { x: position.mapX, y: position.mapY };
        for (let attempt = 0; attempt < 36; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = size * (.35 + Math.random() * .12) / position.zoom;
            const candidate = {
                x: position.mapX + Math.cos(angle) * distance,
                y: position.mapY + Math.sin(angle) * distance
            };
            if (window.isPrivateMapPosition(candidate.x, candidate.y)) {
                anchor = candidate;
                break;
            }
        }
        const popup = document.createElement('div');
        popup.className = 'territory-popup';
        popup.setAttribute('aria-hidden', 'true');
        popup.dataset.mapX = String(anchor.x);
        popup.dataset.mapY = String(anchor.y);
        popup.style.backgroundColor = colors[pick(colors.length)];
        // Alle Inhalte verwenden die bisherige, größere Anzeigenfläche.
        popup.style.setProperty('--popup-width', `${76 + pick(13)}%`);
        popup.style.setProperty('--popup-height', `${78 + pick(13)}%`);
        const siteName = position.siteName;
        const popupNumber = ++popupCount;
        manifestPromise.then(manifest => {
            if (!popup.isConnected || mode !== 'private') return;
            const siteImages = manifest[siteName] || [];
            const adImages = manifest.ads || [];
            const useAd = popupNumber > 1 && adImages.length > 0 && Math.random() < .22;
            const images = useAd ? adImages : siteImages;
            if (!images.length) return; // Farbe zeigt einen noch leeren Ordner an.
            const img = document.createElement('img');
            img.alt = useAd ? 'Advertisement' : `${siteName} content`;
            img.src = imageURL(images[pick(images.length)]);
            img.onerror = () => { img.remove(); popup.classList.remove('has-image'); };
            popup.append(img);
            popup.classList.add('has-image');
        });
        popup.style.zIndex = String(layer.childElementCount + 1);
        layer.append(popup);
        lastPopupAt = performance.now();
        lastSpawnX = position.mapX;
        lastSpawnY = position.mapY;
        placePopups();
        requestAnimationFrame(() => popup.classList.add('visible'));
    }
    function startPopups() {
        addPopup();
        popupTimer = window.setInterval(() => {
            if (mode === 'private') addPopup();
        }, 2000);
    }
    function stopPopups() {
        window.clearInterval(popupTimer);
        popupTimer = null;
        layer.replaceChildren();
    }
    function animatePrivateBoundary(entering) {
        const circleSize = circle.getBoundingClientRect().width;
        const small = locationIcon.getBoundingClientRect().width / circleSize;
        const wasAnimating = reveal.classList.contains('is-active');
        const from = wasAnimating ? reveal.getBoundingClientRect().width / circleSize
            : entering ? small : 1;
        revealAnimation?.cancel();
        circle.style.setProperty('--reveal-start', String(small));
        circle.classList.remove('private-ready');
        reveal.classList.add('is-active');
        const to = entering ? 1 : small;
        const animation = reveal.animate(
            [{ transform: `scale(${from})` }, { transform: `scale(${to})` }],
            {
                duration: Math.max(150, 800 * Math.abs(to - from) / (1 - small)),
                easing: 'cubic-bezier(.22, .65, .22, 1)',
                fill: 'forwards'
            }
        );
        revealAnimation = animation;
        animation.onfinish = () => {
            if (revealAnimation !== animation) return;
            if (entering && mode === 'private') circle.classList.add('private-ready');
            reveal.classList.remove('is-active');
            animation.cancel();
            revealAnimation = null;
        };
    }
    const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    function cleanArticleHTML(html) {
        const article = new DOMParser().parseFromString(html, 'text/html');
        article.querySelectorAll('script, iframe, object, embed').forEach(node => node.remove());
        for (const element of article.body.querySelectorAll('*')) {
            for (const attribute of [...element.attributes]) {
                if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
            }
        }
        return article.body.innerHTML;
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
    function documentForPoint(id) {
        if (!documentByPoint.has(id)) {
            const request = (async () => {
                const page = await pageForPoint(id);
                const params = new URLSearchParams({
                    action: 'parse', format: 'json', formatversion: '2', origin: '*',
                    pageid: String(page.id), prop: 'text', redirects: '1', disableeditsection: '1'
                });
                const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
                if (!response.ok) throw new Error(`Wikipedia API: ${response.status}`);
                const data = await response.json();
                const html = data.parse?.text;
                if (typeof html !== 'string') throw new Error('No parsed article HTML');
                const title = data.parse.title || page.title;
                return {
                    srcdoc: articleDocument(title, cleanArticleHTML(html)),
                    url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title)
                };
            })();
            documentByPoint.set(id, request);
            request.catch(() => { if (documentByPoint.get(id) === request) documentByPoint.delete(id); });
        }
        return documentByPoint.get(id);
    }
    // Alle weißen Punkte werden nach dem Start im Hintergrund vorbereitet.
    // Ein gerade betretenes Feld kann seinen eigenen Request sofort starten.
    async function preloadArticles() {
        const ids = shuffle([...(window.publicPointIds || [])]);
        let nextIndex = 0;
        await Promise.all(Array.from({ length: 6 }, async () => {
            while (nextIndex < ids.length) {
                const id = ids[nextIndex++];
                try { await documentForPoint(id); } catch (error) { /* Beim Betreten erneut versuchen. */ }
            }
        }));
    }
    async function article(id) {
        if (pointId === id) return;
        pointId = id;
        const token = ++requestId;
        frame.removeAttribute('srcdoc');
        loading.textContent = 'Loading Wikipedia article …'; loading.hidden = false;
        link.removeAttribute('href'); wiki.hidden = false;
        try {
            const prepared = await documentForPoint(id);
            if (token !== requestId) return;
            frame.srcdoc = prepared.srcdoc;
            link.href = prepared.url;
            // Nicht auf Bilder und Audio im iFrame warten: HTML sofort zeigen.
            requestAnimationFrame(() => { if (token === requestId) loading.hidden = true; });
        } catch (error) {
            if (token === requestId) loading.textContent = 'The article could not be loaded. Try another point.';
        }
    }
    function hideArticle() { if (!pointId) return; pointId = ''; ++requestId; frame.onload = null; frame.removeAttribute('srcdoc'); wiki.hidden = true; }
    document.addEventListener('territorychange', ({ detail }) => {
        const { site, gx, gy, mapX, mapY, zoom } = detail;
        position = { mapX, mapY, zoom, siteName: site?.name || '' };
        const next = site?.kind === 'private' ? 'private' : 'public';
        if (next !== mode) {
            const previous = mode;
            mode = next;
            if (mode === 'private') animatePrivateBoundary(true);
            else if (previous === 'private') animatePrivateBoundary(false);
            circle.dataset.mode = mode;
            if (mode === 'private') { hideArticle(); startPopups(); }
            else stopPopups();
        }
        if (mode === 'public' && site?.kind === 'public') article(gx + ',' + gy);
        else hideArticle();
        if (mode === 'private') {
            placePopups();
            const traveled = Math.hypot(mapX - lastSpawnX, mapY - lastSpawnY);
            if (traveled > 90 && performance.now() - lastPopupAt > 950) addPopup();
        }
    });
    const gpioButtons = { up: false, down: false };
    const keyboardButtons = { up: false, down: false };
    async function pollButtons() {
        try {
            const response = await fetch('buttons', { cache: 'no-store' });
            if (!response.ok) throw new Error(`Button server: ${response.status}`);
            const state = await response.json();
            gpioButtons.up = state.up === true;
            gpioButtons.down = state.down === true;
        } catch (error) {
            gpioButtons.up = false;
            gpioButtons.down = false;
        } finally {
            window.setTimeout(pollButtons, 50);
        }
    }
    for (const [eventName, pressed] of [['keydown', true], ['keyup', false]]) {
        window.addEventListener(eventName, event => {
            const direction = event.key === 'ArrowUp' ? 'up'
                : event.key === 'ArrowDown' ? 'down' : null;
            if (!direction) return;
            keyboardButtons[direction] = pressed;
            event.preventDefault();
        });
    }
    window.addEventListener('blur', () => {
        keyboardButtons.up = keyboardButtons.down = false;
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            keyboardButtons.up = keyboardButtons.down = false;
            gpioButtons.up = gpioButtons.down = false;
        }
    });
    let lastScrollFrame = 0;
    function scroll(time) {
        const elapsed = Math.min(0.05, (time - (lastScrollFrame || time)) / 1000);
        lastScrollFrame = time;
        if (mode === 'public' && pointId && loading.hidden) {
            const up = gpioButtons.up || keyboardButtons.up;
            const down = gpioButtons.down || keyboardButtons.down;
            const direction = Number(down) - Number(up);
            if (direction) {
                try { frame.contentWindow.scrollBy(0, direction * 220 * elapsed); }
                catch (error) { /* iFrame ist noch nicht geladen. */ }
            }
        }
        requestAnimationFrame(scroll);
    }
    requestAnimationFrame(scroll);
    void pollButtons();
    void preloadArticles();
    // main.js zeichnet vor dem Registrieren dieses Listeners das erste Bild.
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth / 2, clientY: innerHeight / 2 }));
})();
