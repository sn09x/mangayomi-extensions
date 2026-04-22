const mangayomiSources = [{
    "id": 987654321, // Ensure this is unique
    "name": "Kagane",
    "lang": "en",
    "baseUrl": "https://kagane.org",
    "apiUrl": "https://api.kagane.org/api/v2/", // Verify if it's /v1 or /v2
    "iconUrl": "https://kagane.org/favicon.ico",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.1.0",
    "pkgPath": "manga/src/en/kagane.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    get apiUrl() {
        return this.source.apiUrl || "https://api.kagane.org/api/v2/";
    }

    getHeaders(url) {
        return {
            "Referer": `${this.source.baseUrl}/`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        };
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    buildUrl(path, params = {}) {
        let url = `${this.apiUrl}${path}`;
        const pairs = [];
        for (const [k, v] of Object.entries(params)) {
            if (Array.isArray(v)) {
                v.forEach(item => pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(item)}`));
            } else if (v !== null && v !== undefined && v !== "") {
                pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
            }
        }
        if (pairs.length) url += "?" + pairs.join("&");
        return url;
    }

    async fetchJson(url) {
        const res = await this.client.get(url, this.getHeaders(url));
        return JSON.parse(res.body);
    }

    mangaFromItem(item) {
        // Kagane typically uses slugs or hash_ids
        const id = item.hash_id || item.id;
        const slug = item.slug || item.title.toLowerCase().replace(/\s+/g, '-');
        return {
            name: item.title,
            imageUrl: item.poster?.large || item.poster?.medium || "",
            link: `/manga/${id}-${slug}`
        };
    }

    // ── Popular & Latest ─────────────────────────────────────────────────────

    async getPopular(page) {
        return this._fetchMangaList("order[views]", page);
    }

    async getLatestUpdates(page) {
        return this._fetchMangaList("order[updated_at]", page);
    }

    async _fetchMangaList(sort, page) {
        const params = {
            [sort]: "desc",
            limit: 24,
            page: page
        };
        const url = this.buildUrl("manga", params);
        const data = await this.fetchJson(url);
        
        const list = (data?.result?.items || []).map(i => this.mangaFromItem(i));
        const hasNextPage = (data?.result?.pagination?.page || 1) < (data?.result?.pagination?.last_page || 1);
        
        return { list, hasNextPage };
    }

    // ── Search ───────────────────────────────────────────────────────────────

    async search(query, page, filters) {
        const params = {
            keyword: query,
            limit: 24,
            page: page
        };
        
        // Add Filter Logic here if needed
        const url = this.buildUrl("manga", params);
        const data = await this.fetchJson(url);
        
        const list = (data?.result?.items || []).map(i => this.mangaFromItem(i));
        const hasNextPage = (data?.result?.pagination?.page || 1) < (data?.result?.pagination?.last_page || 1);
        
        return { list, hasNextPage };
    }

    // ── Details ──────────────────────────────────────────────────────────────

    async getDetail(url) {
        // Extract ID from /manga/123-title
        const hashId = url.split('/').pop().split('-')[0];
        
        const apiUrl = this.buildUrl(`manga/${hashId}`, {
            "includes[]": ["genre", "author", "artist"]
        });
        
        const data = await this.fetchJson(apiUrl);
        const manga = data?.result;

        if (!manga) throw new Error("Manga not found");

        const chapters = await this._fetchAllChapters(hashId);

        return {
            name: manga.title,
            description: manga.synopsis || "",
            imageUrl: manga.poster?.large || "",
            author: manga.author?.map(a => a.title).join(", ") || "Unknown",
            genre: manga.genre?.map(g => g.title) || [],
            status: manga.status === "releasing" ? 0 : 1, // 0: Ongoing, 1: Completed
            chapters: chapters
        };
    }

    async _fetchAllChapters(hashId) {
        const url = this.buildUrl(`manga/${hashId}/chapters`, { limit: 500 });
        const data = await this.fetchJson(url);
        const items = data?.result?.items || [];

        return items.map(ch => ({
            name: ch.name ? `Ch. ${ch.number}: ${ch.name}` : `Chapter ${ch.number}`,
            url: ch.chapter_id || ch.id,
            dateUpload: ch.created_at ? String(new Date(ch.created_at).getTime()) : null
        }));
    }

    // ── Pages ────────────────────────────────────────────────────────────────

    async getPageList(chapterId) {
        const url = this.buildUrl(`chapters/${chapterId}`);
        const data = await this.fetchJson(url);
        const images = data?.result?.images || [];

        return images.map(img => ({
            url: img.url,
            headers: this.getHeaders(img.url)
        }));
    }

    getFilterList() {
        return []; // You can add the Filter objects here later
    }
}

// Final Step: Instantiate the class
const extension = new DefaultExtension();