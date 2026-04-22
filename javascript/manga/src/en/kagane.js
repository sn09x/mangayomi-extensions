const mangayomiSources = [{
    "id": 987654321,
    "name": "Kagane",
    "lang": "en",
    "baseUrl": "https://kagane.org",
    "apiUrl": "https://yuzuki.kagane.org/api/v2/",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.2.1",
    "pkgPath": "manga/src/en/kagane.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    getHeaders(url) {
        return {
            "Referer": "https://kagane.org/",
            "Origin": "https://kagane.org",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        };
    }

    // New helper for POST requests (Required for Kagane v2 Search)
    async postJson(url, body) {
        const res = await this.client.post(url, this.getHeaders(url), JSON.stringify(body));
        if (!res.body || res.body.includes("<!DOCTYPE html>")) {
            throw new Error("Kagane blocked the request (Cloudflare/Integrity Error).");
        }
        return JSON.parse(res.body);
    }

    async fetchJson(url) {
        const res = await this.client.get(url, this.getHeaders(url));
        if (!res.body || res.body.includes("<!DOCTYPE html>")) {
            throw new Error("Invalid API response. The endpoint may have moved.");
        }
        return JSON.parse(res.body);
    }

    // ── Navigation ──────────────────────────────────────────────────────────

    async getPopular(page) {
        // V2 uses 'series' endpoint for listing
        const url = `${this.source.apiUrl}search/series?page=${page}&limit=24`;
        const body = { "sort": "views", "order": "desc" };
        const data = await this.postJson(url, body);
        return this._parseMangaList(data);
    }

    async getLatestUpdates(page) {
        const url = `${this.source.apiUrl}search/series?page=${page}&limit=24`;
        const body = { "sort": "updated_at", "order": "desc" };
        const data = await this.postJson(url, body);
        return this._parseMangaList(data);
    }

    async search(query, page, filters) {
        const url = `${this.source.apiUrl}search/series?page=${page}&limit=24`;
        const body = { "title": query }; 
        const data = await this.postJson(url, body);
        return this._parseMangaList(data);
    }

    _parseMangaList(data) {
        const items = data?.result?.items || [];
        const list = items.map(item => ({
            name: item.title,
            // V2 uses a separate image endpoint: /api/v2/image/<id>
            imageUrl: `https://yuzuki.kagane.org/api/v2/image/${item.cover_image}`,
            link: item.id // Now a UUIDv7
        }));
        const hasNextPage = (data?.result?.pagination?.page || 1) < (data?.result?.pagination?.last_page || 1);
        return { list, hasNextPage };
    }

    // ── Details & Chapters ──────────────────────────────────────────────────

    async getDetail(id) {
        const url = `${this.source.apiUrl}series/${id}`;
        const data = await this.fetchJson(url);
        const manga = data?.result;

        // Fetching chapters (Kagane v2 now uses a separate 'books' or 'feed' endpoint)
        const chapterUrl = `${this.source.apiUrl}series/${id}/chapters?limit=500`;
        const chapterData = await this.fetchJson(chapterUrl);
        const chapters = (chapterData?.result?.items || []).map(ch => ({
            name: ch.name ? `Ch. ${ch.number}: ${ch.name}` : `Chapter ${ch.number}`,
            url: ch.id,
            dateUpload: ch.created_at ? String(new Date(ch.created_at).getTime()) : null
        }));

        return {
            name: manga.title,
            description: manga.synopsis,
            imageUrl: `https://yuzuki.kagane.org/api/v2/image/${manga.cover_image}`,
            author: manga.authors?.map(a => a.name).join(", "),
            genre: manga.tags?.map(t => t.name), // V2 uses 'tags' instead of 'genres'
            status: manga.status === "ongoing" ? 0 : 1,
            chapters: chapters
        };
    }

    async getPageList(chapterId) {
        // WARNING: Kagane v2 often requires an x-integrity-token for this call
        const url = `${this.source.apiUrl}chapters/${chapterId}`;
        const data = await this.fetchJson(url);
        const images = data?.result?.images || [];

        return images.map(img => ({
            url: img.url,
            headers: this.getHeaders(img.url)
        }));
    }

    getFilterList() { return []; }
}

const extension = new DefaultExtension();