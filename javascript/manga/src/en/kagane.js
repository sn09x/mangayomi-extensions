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
    Object.keys(params).forEach(key => {
      if (Array.isArray(params[key])) {
        params[key].forEach(v => url.searchParams.append(key, v));
      } else if (params[key] !== undefined && params[key] !== "") {
        url.searchParams.append(key, params[key]);
      }
    });
    return url.toString();
  }

  mangaFromItem(item) {
    if (!item) return null;

    return {
      name: item.title || "",
      imageUrl: item.poster?.large || item.poster || "",
      link: `/manga/${item.id}`,
    };
  }

  // ── Popular ──
  async getPopular(page) {
    const url = this.buildUrl("manga", {
      limit: 30,
      page: page || 1,
      "order[views_30d]": "desc",
    });

    return this.parseList(url);
  }

  // ── Latest ──
  async getLatestUpdates(page) {
    const url = this.buildUrl("manga", {
      limit: 30,
      page: page || 1,
      "order[chapter_updated_at]": "desc",
    });

    return this.parseList(url);
  }

  // ── Search ──
  async search(query, page) {
    const params = {
      limit: 30,
      page: page || 1,
    };

    if (query) {
      params.keyword = query;
      params["order[relevance]"] = "desc";
    }

    const url = this.buildUrl("manga", params);
    return this.parseList(url);
  }

  async parseList(url) {
    try {
      const data = await this.request(url);
      const items = data?.result?.items || [];

      return {
        list: items.map(i => this.mangaFromItem(i)).filter(Boolean),
        hasNextPage: items.length > 0,
      };
    } catch (e) {
      console.error(e);
      return { list: [], hasNextPage: false };
    }
  }

  // ── Details ──
  async getDetail(url) {
    try {
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
    } catch (e) {
      console.error(e);
      return {};
    }
  }

  // ── Chapters ──
  async getChapters(url) {
    try {
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
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  // ── Pages ──
  async getPages(url) {
    try {
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
    } catch (e) {
      console.error(e);
      return [];
    }
  }
}

// IMPORTANT: global scope (fix loader issues)
var extension = new KaganeExtension();
var extention = extension;