const mangayomiSources = [
  {
    "id": 1234567891,
    "name": "Kagane",
    "lang": "en",
    "baseUrl": "https://kagane.org",
    "apiUrl": "https://yuzuki.kagane.org/api/v2/",
    "iconUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-LtpILLImUWhnfZz1KnRQTRGSiVYTetGYOg&s",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.1.0",
    "pkgPath": "manga/src/en/kagane.js"
  }
];

class KaganeExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.baseUrl = "https://kagane.org";
    this.apiUrl = "https://yuzuki.kagane.org/api/v2/";
  }

  headers() {
    return {
      Referer: this.baseUrl + "/",
    };
  }

  async request(url) {
    const res = await this.client.get(url, this.headers());
    return JSON.parse(res.body);
  }

  buildUrl(path, params = {}) {
    const url = new URL(this.apiUrl + path);
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.forEach(val => url.searchParams.append(k, val));
      } else if (v !== undefined && v !== "") {
        url.searchParams.append(k, v);
      }
    });
    return url.toString();
  }

  mangaFromItem(item) {
    return {
      name: item.title || "",
      imageUrl: item.poster?.large || "",
      link: `/manga/${item.id}`,
    };
  }

  async parseList(url) {
    const data = await this.request(url);
    const items = data?.result?.items || [];

    return {
      list: items.map(i => this.mangaFromItem(i)),
      hasNextPage: items.length > 0,
    };
  }

  async getPopular(page) {
    return this.parseList(
      this.buildUrl("manga", {
        limit: 30,
        page: page || 1,
        "order[views_30d]": "desc",
      })
    );
  }

  async getLatestUpdates(page) {
    return this.parseList(
      this.buildUrl("manga", {
        limit: 30,
        page: page || 1,
        "order[chapter_updated_at]": "desc",
      })
    );
  }

  async search(query, page) {
    return this.parseList(
      this.buildUrl("manga", {
        limit: 30,
        page: page || 1,
        keyword: query || "",
      })
    );
  }

  async getDetail(url) {
    const id = url.split("/").pop();
    const data = await this.request(this.apiUrl + "manga/" + id);
    const m = data?.result;

    return {
      name: m.title,
      imageUrl: m.poster?.large || "",
      author: m.author || "",
      artist: m.artist || "",
      description: m.description || "",
      genres: m.genres || [],
      status: 0,
    };
  }

  async getChapters(url) {
    const id = url.split("/").pop();

    const data = await this.request(
      this.buildUrl(`manga/${id}/chapters`, {
        limit: 500,
        order: "desc",
      })
    );

    const chapters = data?.result?.items || [];

    return chapters.map(ch => ({
      name: ch.title || `Chapter ${ch.number}`,
      url: `/manga/${id}/${ch.number}`,
      dateUpload: new Date(ch.published_at).getTime() || 0,
    }));
  }

  async getPages(url) {
    const parts = url.split("/");
    const id = parts[2];
    const chapter = parts[3];

    const data = await this.request(
      this.apiUrl + `manga/${id}/chapter/${chapter}`
    );

    const pages = data?.result?.pages || [];

    return pages.map((p, i) => ({
      url: p.image,
      index: i,
    }));
  }
}

/* 🔥 THIS PART IS CRITICAL (matches repo format) */
module.exports = {
  extension: new KaganeExtension(),
};