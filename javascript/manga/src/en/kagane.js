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

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.source = mangayomiSources[0];
  }

  get apiUrl() {
    return this.source.apiUrl || "https://yuzuki.kagane.org/api/v2/";
  }

  getHeaders(url) {
    return {
      Referer: `${this.source.baseUrl}/`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  buildUrl(path, params = {}) {
    let url = `${this.apiUrl}${path}`;
    const pairs = [];
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(item)}`);
        }
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

  statusCode(status) {
    return (
      {
        releasing: 0,
        finished: 1,
        on_hiatus: 2,
        discontinued: 3,
      }[status] ?? 5
    );
  }

  posterUrl(poster, quality = "large") {
    if (!poster) return null;
    if (typeof poster === "string") return poster;
    if (poster.large) return poster.large;
    if (poster.medium) return poster.medium;
    if (poster.small) return poster.small;
    return null;
  }

  fancyScore(ratedAvg) {
    if (!ratedAvg || ratedAvg === 0) return "";
    const stars = Math.round(ratedAvg / 2);
    const starStr = "★".repeat(stars) + "☆".repeat(5 - stars);
    return `${starStr} ${ratedAvg}`;
  }

  mangaFromItem(item) {
    if (!item) return null;
    const slug = (item.title || item.name || "")
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    
    return {
      name: item.title || item.name || "",
      imageUrl: this.posterUrl(item.poster || item.cover),
      link: `/title/${item.hash_id || item.id}-${slug}`,
    };
  }

  // ── Preferences ────────────────────────────────────────────────────────

  getPreference(key, defaultValue) {
    const val = new SharedPreferences().get(key);
    return val !== null && val !== undefined && val !== "" ? val : defaultValue;
  }

  getSourcePreferences() {
    return [
      {
        key: "quality_pref",
        listPreference: {
          title: "Image Quality",
          summary: "Select preferred image quality",
          valueIndex: 0,
          entries: ["Large", "Medium", "Small"],
          entryValues: ["large", "medium", "small"],
        },
      },
    ];
  }

  // ── Popular ────────────────────────────────────────────────────────────

  async getPopular(page) {
    return this._searchWithSort("order[views_30d]", page);
  }

  // ── Latest Updates ─────────────────────────────────────────────────────

   async getLatestUpdates(page) {
    return this._searchWithSort("order[chapter_updated_at]", page);
  }

  async _searchWithSort(sortParam, page) {
    const params = {
      [sortParam]: "desc",
      limit: 50,
      page,
    };
    if (this.getPreference("nsfw_pref", "show") === "hide") {
      params["exclude_genres[]"] = NSFW_GENRE_IDS;
    }
    const url = this.buildUrl("manga", params);
    return this._searchFromUrl(url);
  }

  // ── Search ─────────────────────────────────────────────────────────────

  async search(query, page, filters) {
    const params = {
      limit: 50,
      page: page || 1,
    };

    let sortParam = "order[views_30d]";
    let sortValue = "desc";

    // Process filters
    if (filters && filters.length > 0) {
      for (const filter of filters) {
        if (filter.type_name === "SelectFilter" && filter.name === "Sort") {
          const opt = filter.values[filter.state];
          if (opt) {
            sortParam = opt.param || "order[views_30d]";
            sortValue = opt.value || "desc";
          }
        } else if (
          filter.type_name === "GroupFilter" &&
          filter.name === "Status"
        ) {
          const vals = filter.state
            .filter((f) => f.state)
            .map((f) => f.value);
          if (vals.length) params["statuses[]"] = vals;
        } else if (filter.type_name === "GroupFilter" && filter.name === "Type") {
          const vals = filter.state
            .filter((f) => f.state)
            .map((f) => f.value);
          if (vals.length) params["types[]"] = vals;
        } else if (
          filter.type_name === "GroupFilter" &&
          filter.name === "Genres"
        ) {
          const included = [];
          const excluded = [];
          for (const f of filter.state) {
            if (f.state === 1) included.push(f.value);
            else if (f.state === 2) excluded.push(f.value);
          }
          if (included.length) params["genres[]"] = included;
          if (excluded.length) params["exclude_genres[]"] = excluded;
        }
      }
    }

    if (query && query.trim() !== "") {
      params.keyword = query.trim();
      sortParam = "order[relevance]";
      sortValue = "desc";
    }

    params[sortParam] = sortValue;

    const url = this.buildUrl("manga", params);
    return this._searchFromUrl(url);
  }

  async _searchFromUrl(url) {
    try {
      const data = await this.fetchJson(url);
      const items = data?.result?.items || data?.data || [];
      const pagination = data?.result?.pagination || {};
      
      const list = items
        .map((item) => this.mangaFromItem(item))
        .filter((item) => item !== null);

      return {
        list,
        hasNextPage: pagination.has_next_page || pagination.last_page > pagination.current_page || false,
      };
    } catch (error) {
      console.error("Search error:", error);
      return {
        list: [],
        hasNextPage: false,
      };
    }
  }

  // ── Manga Details ──────────────────────────────────────────────────────

  async getDetail(url) {
    try {
      const id = url.split("-").pop();
      const detailUrl = this.buildUrl(`manga/${id}`);
      const data = await this.fetchJson(detailUrl);
      const item = data?.result || data?.data || {};

      return {
        name: item.title || item.name || "",
        imageUrl: this.posterUrl(item.poster || item.cover),
        author: item.author || "",
        artist: item.artist || "",
        description: item.description || item.synopsis || "",
        genres: item.genres || item.tags || [],
        status: this.statusCode(item.status || "releasing"),
        rating: this.fancyScore(item.rating || 0),
      };
    } catch (error) {
      console.error("Detail error:", error);
      return {};
    }
  }

  // ── Chapters ───────────────────────────────────────────────────────────

  async getChapters(mangaUrl) {
    try {
      const id = mangaUrl.split("-").pop();
      const chaptersUrl = this.buildUrl(`manga/${id}/chapters`, {
        limit: 500,
        order: "desc",
      });
      
      const data = await this.fetchJson(chaptersUrl);
      const chapters = data?.result?.items || data?.data || [];

      return chapters.map((chapter, index) => ({
        name: chapter.title || `Chapter ${chapter.number || index + 1}`,
        url: `/title/${id}/chapter/${chapter.number || chapter.id}`,
        dateUpload: chapter.date_upload || chapter.published_at || 0,
        scanlator: chapter.scanlator || "",
      }));
    } catch (error) {
      console.error("Chapters error:", error);
      return [];
    }
  }

  // ── Pages ──────────────────────────────────────────────────────────────

  async getPages(chapterUrl) {
    try {
      // Parse chapter URL to get manga ID and chapter number
      const parts = chapterUrl.split("/");
      const mangaId = parts[2];
      const chapterNum = parts[4];

      const pagesUrl = this.buildUrl(
        `manga/${mangaId}/chapter/${chapterNum}`
      );

      const data = await this.fetchJson(pagesUrl);
      const pages = data?.result?.pages || data?.data?.pages || [];

      return pages.map((page, index) => ({
        url: page.image || page.url || "",
        index: index,
      }));
    } catch (error) {
      console.error("Pages error:", error);
      return [];
    }
  }

  // ── Filters ────────────────────────────────────────────────────────────

  async getFilters() {
    return [
      {
        type_name: "SelectFilter",
        name: "Sort",
        state: 0,
        values: [
          { name: "Popular (30 days)", param: "order[views_30d]", value: "desc" },
          { name: "Popular (all time)", param: "order[views]", value: "desc" },
          { name: "Latest Updated", param: "order[chapter_updated_at]", value: "desc" },
          { name: "Highest Rated", param: "order[rating]", value: "desc" },
          { name: "Newest", param: "order[created_at]", value: "desc" },
        ],
      },
      {
        type_name: "GroupFilter",
        name: "Status",
        state: [],
        groups: [
          {
            type_name: "CheckFilter",
            name: "Releasing",
            value: "releasing",
            state: false,
          },
          {
            type_name: "CheckFilter",
            name: "Finished",
            value: "finished",
            state: false,
          },
          {
            type_name: "CheckFilter",
            name: "On Hiatus",
            value: "on_hiatus",
            state: false,
          },
          {
            type_name: "CheckFilter",
            name: "Discontinued",
            value: "discontinued",
            state: false,
          },
        ],
      },
      {
        type_name: "GroupFilter",
        name: "Type",
        state: [],
        groups: [
          {
            type_name: "CheckFilter",
            name: "Manga",
            value: "manga",
            state: false,
          },
          {
            type_name: "CheckFilter",
            name: "Manhwa",
            value: "manhwa",
            state: false,
          },
          {
            type_name: "CheckFilter",
            name: "Manhua",
            value: "manhua",
            state: false,
          },
          {
            type_name: "CheckFilter",
            name: "One Shot",
            value: "one_shot",
            state: false,
          },
        ],
      },
      {
        type_name: "GroupFilter",
        name: "Genres",
        state: [],
        groups: [
          {
            type_name: "CheckFilter",
            name: "Action",
            value: "action",
            state: 0,
          },
          {
            type_name: "CheckFilter",
            name: "Adventure",
            value: "adventure",
            state: 0,
          },
          {
            type_name: "CheckFilter",
            name: "Comedy",
            value: "comedy",
            state: 0,
          },
          {
            type_name: "CheckFilter",
            name: "Drama",
            value: "drama",
            state: 0,
          },
          {
            type_name: "CheckFilter",
            name: "Fantasy",
            value: "fantasy",
            state: 0,
          },
          {
            type_name: "CheckFilter",
            name: "Horror",
            value: "horror",
            state: 0,
          },
          {
            type_name: "CheckFilter",
            name: "Romance",
            value: "romance",
            state: 0,
          },
          {
            type_name: "CheckFilter",
            name: "Sci-Fi",
            value: "sci_fi",
            state: 0,
          },
          {
            type_name: "CheckFilter",
            name: "Slice of Life",
            value: "slice_of_life",
            state: 0,
          },
          {
            type_name: "CheckFilter",
            name: "Supernatural",
            value: "supernatural",
            state: 0,
          },
        ],
      },
    ];
  }
}
