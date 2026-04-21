const mangayomiSources = [{
    "id": 693275080,
    "name": "Weeb Central",
    "lang": "en",
    "baseUrl": "https://weebcentral.com",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=128&domain=https://weebcentral.com",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.1.0",
    "pkgPath": "manga/src/en/weebcentral.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    getHeaders(url) {
        return { "Referer": `${this.source.baseUrl}/` };
    }

    async request(slug) {
        var url = `${this.source.baseUrl}${slug}`;
        var res = await this.client.get(url);
        return new Document(res.body);
    }

    async getPopular(page) {
        const filters = this.getFilterList();
        filters[0].state = 2; // Popularity
        return await this.search("", page, filters);
    }

    async getLatestUpdates(page) {
        const filters = this.getFilterList();
        filters[0].state = 5; // Latest Updates
        return await this.search("", page, filters);
    }

    getImageUrl(id) { 
        return `https://temp.compsci88.com/cover/normal/${id}.webp`; 
    }

    async search(query, page, filters) {
        var offset = 32 * (parseInt(page) - 1);
        var sort = filters?.[0]?.values?.[filters?.[0]?.state]?.value ?? "";
        var order = filters?.[1]?.values?.[filters?.[1]?.state]?.value ?? "";
        var translation = filters?.[2]?.values?.[filters?.[2]?.state]?.value ?? "";

        var status = "";
        for (var f3 of (filters?.[3]?.state ?? [])) {
            if (f3?.state === true) status += `&included_status=${f3.value}`;
        }

        var type = "";
        for (var f4 of (filters?.[4]?.state ?? [])) {
            if (f4?.state === true) type += `&included_type=${f4.value}`;
        }

        var tags = "";
        for (var f5 of (filters?.[5]?.state ?? [])) {
            if (f5?.state === true) tags += `&included_tag=${f5.value}`;
        }

        var slug = `/search/data?limit=32&offset=${offset}&author=&text=${query}&sort=${sort}&order=${order}&official=${translation}${status}${type}${tags}&display_mode=Full%20Display`;
        var doc = await this.request(slug);
        var list = [];
        
        var mangaElements = doc.select("article");
        for (var manga of mangaElements) {
            var img = manga.selectFirst("img");
            var details = manga.selectFirst("section > a");
            var titleElem = manga.selectFirst("article > div > div > div");

            if (img && details) {
                list.push({ 
                    name: titleElem ? titleElem.text : "Unknown", 
                    imageUrl: img.getSrc, 
                    link: details.getHref 
                });
            }
        }

        var btn = doc.selectFirst("button");
        var hasNextPage = btn ? btn.text.length > 0 : false;
        return { list, hasNextPage };
    }

    statusCode(status) {
        return {
            "Ongoing": 0,
            "Complete": 1,
            "Hiatus": 2,
            "Canceled": 3,
        }[status] ?? 5;
    }

    async getDetail(url) {
        var urlSplits = url.split("/");
        var link = urlSplits[urlSplits.length - 1]; // Fixed split logic
        var slug = url.includes("http") ? `/series/${link}` : `/series/${url}`;
        
        var doc = await this.request(slug);
        var id = url.split('/').pop();
        var imageUrl = this.getImageUrl(id);
        
        var descElem = doc.selectFirst("p.whitespace-pre-wrap.break-words");
        var description = descElem ? descElem.text : "";

        var chapters = [];
        var ul = doc.select("ul.flex.flex-col.gap-4 > li");
        var author = "";
        var genre = [];
        var status = 5;

        for (var li of ul) {
            var strong = li.selectFirst("strong");
            if (!strong) continue;
            var strongTxt = strong.text;

            if (strongTxt.includes("Author(s):")) {
                author = li.selectFirst("a")?.text ?? "";
            } else if (strongTxt.includes("Tags(s):")) {
                li.select("a").forEach(a => genre.push(a.text));
            } else if (strongTxt.includes("Status:")) {
                status = this.statusCode(li.selectFirst("a")?.text ?? "");
            }
        }

        var chapDoc = await this.request(`${slug}/full-chapter-list`);
        var chapList = chapDoc.select("div.flex.items-center");
        for (var chap of chapList) {
            var nameElem = chap.selectFirst("span.grow.flex.items-center.gap-2 span");
            var timeElem = chap.selectFirst("time.text-datetime");
            var inputElem = chap.selectFirst("input");

            if (nameElem && inputElem) {
                chapters.push({ 
                    name: nameElem.text, 
                    url: inputElem.attr("value"), 
                    dateUpload: timeElem ? new Date(timeElem.text).valueOf().toString() : "" 
                });
            }
        }
        return { description, imageUrl, author, genre, status, chapters };
    }

    async getPageList(url) {
        var slug = `/chapters/${url}/images?current_page=1&reading_style=long_strip`;
        var doc = await this.request(slug);
        var urls = [];

        doc.select("section > img").forEach(page => {
            let src = page.attr("src");
            if (src) urls.push(src);
        });

        return urls.map(x => ({ 
            url: x, 
            headers: { 
                "Referer": `${this.source.baseUrl}/`,
                "Accept": "image/avif,image/webp,*/*"
            } 
        }));
    }

    getFilterList() {
        // ... (The filter list you provided was structurally fine)
        // Ensure you keep the full filter array here from your original code.
    }
}
        return [
            {
                type_name: "SelectFilter",
                name: "Sort",
                state: 0,
                values: [
                    ["Best Match", "Best Match"],
                    ["Alphabet", "Alphabet"],
                    ["Popularity", "Popularity"],
                    ["Subscribers", "Subscribers"],
                    ["Recently Added", "Recently Added"],
                    ["Latest Updates", "Latest Updates"]
                ].map(x => ({ type_name: 'SelectOption', name: x[0], value: x[1] }))
            }, {
                type_name: "SelectFilter",
                name: "Order",
                state: 0,
                values: [
                    ["Ascending", "Ascending"],
                    ["Descending", "Descending"]
                ].map(x => ({ type_name: 'SelectOption', name: x[0], value: x[1] }))
            }, {
                type_name: "SelectFilter",
                name: "Official Translation",
                state: 0,
                values: [
                    ["Any", "Any"],
                    ["True", "True"],
                    ["False", "False"],
                ].map(x => ({ type_name: 'SelectOption', name: x[0], value: x[1] }))
            }, {
                type_name: "GroupFilter",
                name: "Series Status",
                state: [
                    ["Ongoing", "Ongoing"],
                    ["Complete", "Complete"],
                    ["Hiatus", "Hiatus"],
                    ["Canceled", "Canceled"],
                ].map(x => ({ type_name: 'CheckBox', name: x[0], value: x[1] }))
            }, {
                type_name: "GroupFilter",
                name: "Series Type",
                state: [
                    ["Manga", "Manga"],
                    ["Manhwa", "Manhwa"],
                    ["Manhua", "Manhua"],
                    ["OEL", "OEL"],
                ].map(x => ({ type_name: 'CheckBox', name: x[0], value: x[1] }))
            }, {
                type_name: "GroupFilter",
                name: "Tags",
                state: [
                    ["Action", "Action"],
                    ["Adventure", "Adventure"],
                    ["Adult", "Adult"],
                    ["Comedy", "Comedy"],
                    ["Doujinshi", "Doujinshi"],
                    ["Drama", "Drama"],
                    ["Ecchi", "Ecchi"],
                    ["Fantasy", "Fantasy"],
                    ["Gender Bender", "Gender Bender"],
                    ["Harem", "Harem"],
                    ["Hentai", "Hentai"],
                    ["Historical", "Historical"],
                    ["Horror", "Horror"],
                    ["Isekai", "Isekai"],
                    ["Josei", "Josei"],
                    ["Lolicon", "Lolicon"],
                    ["Martial Arts", "Martial Arts"],
                    ["Mature", "Mature"],
                    ["Mecha", "Mecha"],
                    ["Mystery", "Mystery"],
                    ["Psychological", "Psychological"],
                    ["Romance", "Romance"],
                    ["School Life", "School Life"],
                    ["Sci-Fi", "Sci-Fi"],
                    ["Seinen", "Seinen"],
                    ["Shotacon", "Shotacon"],
                    ["Shoujo", "Shoujo"],
                    ["Shoujo Ai", "Shoujo Ai"],
                    ["Shounen", "Shounen"],
                    ["Slice of Life", "Slice of Life"],
                    ["Smut", "Smut"],
                    ["Sports", "Sports"],
                    ["Supernatural", "Supernatural"],
                    ["Tragedy", "Tragedy"],
                    ["Yaoi", "Yaoi"],
                    ["Yuri", "Yuri"],
                    ["Other", "Other"]
                ].map(x => ({ type_name: 'CheckBox', name: x[0], value: x[1] }))
            }
        ]
    


