const svg = document.querySelector('#internet-map');
const stage = document.querySelector('.map-stage');
const preview = document.querySelector('#wiki-preview');
const previewFrame = document.querySelector('#wiki-frame');
const previewTitle = document.querySelector('#preview-title');
const hitRoutes = [...svg.querySelectorAll('.route-hit')];

const ARTICLE_SPACING = 48; // smaller = more articles along the paths
const RANDOM_ARTICLE_COUNT = 200;
const PREVIEW_DELAY = 120;

let pointsByRoute = new Map();
let activePoint = null;
let previewTimer = null;

const fallbackTitles = [
    'Internet', 'Wikipedia', 'Allmende', 'Hypertext', 'World Wide Web',
    'Open Access', 'Commons', 'Netzwerk', 'Cyberspace', 'Öffentlicher Raum',
    'Digitale Medien', 'Information', 'Wissen', 'Bibliothek', 'Enzyklopädie',
    'Freie Software', 'Open Source', 'Creative Commons', 'Kommunikation',
    'Infrastruktur', 'Medientheorie', 'Interface', 'Interaktion', 'Navigation',
    'Kartografie', 'Raum', 'Eigentum', 'Gemeingut', 'Gesellschaft', 'Technik'
];

function articleFromTitle(title, id = title) {
    const slug = encodeURIComponent(title.replace(/ /g, '_'));
    return {
        id,
        title,
        url: `https://de.wikipedia.org/wiki/${slug}`,
        previewUrl: `https://de.wikipedia.org/wiki/${slug}?useskin=minerva`
    };
}

function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

async function fetchRandomWikipediaArticles(amount) {
    const batchSize = 50;
    const batches = Math.ceil(amount / batchSize);

    const requests = Array.from({ length: batches }, async () => {
        const params = new URLSearchParams({
            action: 'query',
            list: 'random',
            rnnamespace: '0',
            rnlimit: String(batchSize),
            format: 'json',
            origin: '*'
        });

        const response = await fetch(`https://de.wikipedia.org/w/api.php?${params}`);
        if (!response.ok) throw new Error(`Wikipedia API: ${response.status}`);
        const data = await response.json();
        return data.query?.random ?? [];
    });

    const pages = (await Promise.all(requests)).flat();
    const unique = new Map();

    pages.forEach(page => {
        if (!unique.has(page.id)) {
            unique.set(page.id, articleFromTitle(page.title, page.id));
        }
    });

    return shuffle([...unique.values()]).slice(0, amount);
}

function distributeArticles(articles) {
    const shuffled = shuffle(articles);
    let articleIndex = 0;
    const nextMap = new Map();

    hitRoutes.forEach(hitRoute => {
        const routeId = hitRoute.dataset.route;
        const geometry = svg.querySelector(`#${routeId}`);
        const length = geometry.getTotalLength();
        const count = Math.max(4, Math.round(length / ARTICLE_SPACING));
        const routePoints = [];

        for (let i = 0; i < count; i++) {
            // Even distribution + random jitter = dense, but not visibly regular.
            const base = ((i + 0.5) / count) * length;
            const jitter = (Math.random() - 0.5) * (length / count) * 0.65;
            const distance = Math.max(0, Math.min(length, base + jitter));
            const position = geometry.getPointAtLength(distance);
            const article = shuffled[articleIndex % shuffled.length];

            routePoints.push({
                x: position.x,
                y: position.y,
                distance,
                article
            });

            articleIndex++;
        }

        nextMap.set(routeId, routePoints);
    });

    pointsByRoute = nextMap;
}

function clientToSvgPoint(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
}

function nearestArticlePoint(routeId, cursor) {
    const points = pointsByRoute.get(routeId) ?? [];
    let nearest = null;
    let bestDistanceSquared = Infinity;

    for (const point of points) {
        const dx = point.x - cursor.x;
        const dy = point.y - cursor.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < bestDistanceSquared) {
            bestDistanceSquared = distanceSquared;
            nearest = point;
        }
    }

    return nearest;
}

function positionPreview(event) {
    const stageRect = stage.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const gap = 28;
    const padding = 10;

    let x = event.clientX - stageRect.left + gap;
    let y = event.clientY - stageRect.top - previewRect.height * 0.55;

    // If there is no room on the right, place the bubble to the left.
    if (x + previewRect.width > stageRect.width - padding) {
        x = event.clientX - stageRect.left - previewRect.width - gap;
        preview.classList.add('preview-left');
    } else {
        preview.classList.remove('preview-left');
    }

    x = Math.max(padding, Math.min(x, stageRect.width - previewRect.width - padding));
    y = Math.max(padding, Math.min(y, stageRect.height - previewRect.height - padding));

    preview.style.left = `${x}px`;
    preview.style.top = `${y}px`;
}

function hidePreview() {
    clearTimeout(previewTimer);
    preview.classList.remove('is-visible');
    activePoint = null;
}

function showArticle(point) {
    if (!point) return;

    preview.classList.add('is-visible');

    if (activePoint?.article.id === point.article.id) return;

    activePoint = point;
    previewTitle.textContent = point.article.title;

    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
        previewFrame.src = point.article.previewUrl;
    }, PREVIEW_DELAY);
}

svg.addEventListener('pointermove', event => {
    const hitRoute = event.target.closest?.('.route-hit');

    // The mouse is on private property: nothing is shown.
    if (!hitRoute) {
        hidePreview();
        return;
    }

    positionPreview(event);

    const cursor = clientToSvgPoint(event);
    const point = nearestArticlePoint(hitRoute.dataset.route, cursor);
    showArticle(point);
});

svg.addEventListener('pointerleave', hidePreview);

// Optional: click the public path to open the currently previewed article.
svg.addEventListener('click', event => {
    const hitRoute = event.target.closest?.('.route-hit');
    if (!hitRoute || !activePoint) return;
    window.open(activePoint.article.url, '_blank', 'noopener,noreferrer');
});

// Make the prototype usable immediately, even before the API responds.
distributeArticles(fallbackTitles.map(articleFromTitle));

fetchRandomWikipediaArticles(RANDOM_ARTICLE_COUNT)
    .then(distributeArticles)
    .catch(error => {
        console.warn('Random Wikipedia articles could not be loaded. Using fallback list.', error);
    });
