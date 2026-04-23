const mangayomiSources = [{
    "id": 693275080,
    "name": "Weeb Central",
    "lang": "en",
    "baseUrl": "https://weebcentral.com",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=128&domain=https://weebcentral.com",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.1.5",
    "pkgPath": "manga/src/en/weebcentral.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // ── DYNAMIC HEADERS ──────────────────────────────────────────────────────
    // This allows the code to work on iOS, Android, and PC by adapting
   getHeaders(url) {
    const isImage = url.includes("compsci88.com") || url.includes(".webp");
    
    // This pulls the EXACT string your app is currently using in Settings
    const appUserAgent = this.client.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    return {
        "Referer": "https://weebcentral.com/",
        "User-Agent": appUserAgent,
        "Accept": isImage ? "image/avif,image/webp,*/*" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": isImage ? "image" : "document",
        "Sec-Fetch-Mode": isImage ? "no-cors" : "navigate",
        "Sec-Fetch-Site": isImage ? "cross-site" : "same-origin"
    };
}

    async request(slug, isData = false) {
        const url = `${this.source.baseUrl}${slug}`;
        const headers = {
            "Referer": "https://weebcentral.com/",
            "User-Agent": this.client.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": isData ? "application/json, text/plain, */*" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "X-Requested-With": "XMLHttpRequest", // Forces bypass on some CF configs
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin"
        };

        const res = await this.client.get(url, headers);
        
        if (res.statusCode === 403) {
            throw new Error("Cloudflare Level 2 Block: Please Login in WebView to sync account cookies.");
        }
        return new Document(res.body);
    }

    async getDetail(url) {
        // Use the 'isData' flag for the chapter list call
        const slug = url.includes("weebcentral.com") ? url.split("weebcentral.com")[1] : url;
        const doc = await this.request(slug, false); // Get HTML
        
        // When fetching the chapter list, it's a data call
        const chapSlug = `${slug}/full-chapter-list`;
        const chapDoc = await this.request(chapSlug, true); 
        
        // ... rest of your parsing logic
    }
    // ── NAVIGATION ───────────────────────────────────────────────────────────

    async getPopular(page) {
        const filters = this.getFilterList();
        filters[0].state = 2; // Popularity
        return await this.search("", page, filters);
    }

    async getLatestUpdates(page) {
        const filters = this.getFilterList();
        filters[0].state = 5; // Latest
        return await this.search("", page, filters);
    }

    getImageUrl(id) { 
        return `https://temp.compsci88.com/cover/normal/${id}.webp`; 
    }

    async search(query, page, filters) {
        if (!filters || !filters[0]) filters = this.getFilterList();

        const offset = 32 * (parseInt(page) - 1);
        const sort = filters[0].values[filters[0].state].value;
        const order = filters[1].values[filters[1].state].value;
        const official = filters[2].values[filters[2].state].value;

        // Build the query string manually to ensure accuracy
        const slug = `/search/data?limit=32&offset=${offset}&author=&text=${encodeURIComponent(query)}&sort=${sort}&order=${order}&official=${official}&display_mode=Full%20Display`;
        
        const doc = await this.request(slug);
        const list = [];
        const mangaElements = doc.select("article:has(section)");
        
        for (const manga of mangaElements) {
            const img = manga.selectFirst("img");
            const details = manga.selectFirst("section > a");
            const titleElement = manga.selectFirst("article > div > div > div");
            
            if (details && titleElement) {
                list.push({
                    name: titleElement.text.trim(),
                    imageUrl: img ? img.getSrc : "",
                    link: details.getHref
                });
            }
        }

        const hasNextPage = doc.select("button").length > 0;
        return { list, hasNextPage };
    }

    // ── DETAILS & CHAPTERS ───────────────────────────────────────────────────

    async getDetail(url) {
        const slug = url.includes("weebcentral.com") ? url.split("weebcentral.com")[1] : url;
        const doc = await this.request(slug);
        
        const description = doc.selectFirst("p.whitespace-pre-wrap.break-words")?.text || "";
        const id = slug.split('/').filter(Boolean).pop();
        const imageUrl = this.getImageUrl(id);

        const genres = [];
        let author = "Unknown";
        let status = 5;

        const infoItems = doc.select("ul.flex.flex-col.gap-4 > li");
        for (const li of infoItems) {
            const text = li.text;
            if (text.includes("Author(s):")) author = li.selectFirst("a")?.text || author;
            if (text.includes("Tags(s):")) li.select("a").forEach(a => genres.push(a.text));
            if (text.includes("Status:")) status = this.statusCode(li.selectFirst("a")?.text);
        }

        const chapDoc = await this.request(`${slug}/full-chapter-list`);
        const chapters = chapDoc.select("div.flex.items-center").map(chap => {
            const name = chap.selectFirst("span.grow.flex.items-center.gap-2")?.selectFirst("span")?.text || "Unknown Chapter";
            const dateStr = chap.selectFirst("time.text-datetime")?.text;
            const chUrl = chap.selectFirst("input")?.attr("value");
            
            return {
                name: name,
                url: chUrl,
                dateUpload: dateStr ? String(new Date(dateStr).getTime()) : null
            };
        });

        return { description, imageUrl, author, genre: genres, status, chapters };
    }

   async getPageList(id) {
        const slug = `/chapters/${id}/images?current_page=1&reading_style=long_strip`;
        const doc = await this.request(slug);
        const images = doc.select("section > img");

        return images.map(img => {
            const src = img.attr("src");
            // Extract the domain (e.g., temp.compsci88.com)
            const host = src.split('//')[1].split('/')[0];

            return {
                url: src,
                headers: {
                    "Referer": `${this.source.baseUrl}/`,
                    "User-Agent": this.client.userAgent,
                    "Host": host, // CRITICAL: Must match the image URL domain
                    "Accept": "image/avif,image/webp,*/*",
                    "Sec-Fetch-Dest": "image",
                    "Sec-Fetch-Mode": "no-cors",
                    "Sec-Fetch-Site": "cross-site"
                }
            };
        });
    

        return images.map(img => {
            const src = img.attr("src");
            return {
                url: src,
                headers: {
                    "Referer": "https://weebcentral.com/",
                    "User-Agent": this.client.userAgent,
                    "Accept": "image/avif,image/webp,image/apng,*/*;q=0.8"
                }
            };
        });
    }

    statusCode(status) {
        return { "Ongoing": 0, "Complete": 1, "Hiatus": 2, "Canceled": 3 }[status] ?? 5;
    }

    getFilterList() {
        // ... (Keep your existing filter list here)
        return [
            {
                type_name: "SelectFilter",
                name: "Sort",
                state: 0,
                values: [
                    { type_name: 'SelectOption', name: "Best Match", value: "Best Match" },
                    { type_name: 'SelectOption', name: "Popularity", value: "Popularity" },
                    { type_name: 'SelectOption', name: "Latest Updates", value: "Latest Updates" }
                ]
            },
            {
                type_name: "SelectFilter",
                name: "Order",
                state: 1,
                values: [
                    { type_name: 'SelectOption', name: "Ascending", value: "Ascending" },
                    { type_name: 'SelectOption', name: "Descending", value: "Descending" }
                ]
            },
            {
                type_name: "SelectFilter",
                name: "Official Translation",
                state: 0,
                values: [
                    { type_name: 'SelectOption', name: "Any", value: "Any" },
                    { type_name: 'SelectOption', name: "True", value: "True" },
                    { type_name: 'SelectOption', name: "False", value: "False" }
                ]
            }
            // (Shortened for brevity, keep your full lists for Status, Type, and Tags)
        ];
    }
}

const extension = new DefaultExtension();