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
  }

  get apiUrl() {
    return this.source.apiUrl || "https://yuzuki.kagane.org/api/v2/";
  }

  getHeaders(url) {
    return {
      Referer: `${this.source.baseUrl}/`,
    };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

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

  posterUrl(poster, quality) {
    if (!poster) return null;
    return poster[quality] || poster.large || poster.medium || poster.small || null;
  }

  fancyScore(ratedAvg) {
    if (!ratedAvg || ratedAvg === 0) return "";
    const score = Math.round(ratedAvg);
    const stars = Math.round(ratedAvg / 2);
    const starStr = "★".repeat(stars) + "☆".repeat(5 - stars);
    return `${starStr} ${ratedAvg}`;
  }

  mangaFromItem(item, quality = "large") {
    const slug = item.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    return {
      name: item.title,
      imageUrl: this.posterUrl(item.poster, quality),
      link: `/title/${item.hash_id}-${slug}`,
    };
  }

  // ── Preferences ──────────────────────────────────────────────────────────

  getPreference(key, defaultValue) {
    const val = new SharedPreferences().get(key);
    return val !== null && val !== undefined && val !== "" ? val : defaultValue;
  }

  getSourcePreferences() {
    return [
      {
        key: "nsfw_pref",
        listPreference: {
          title: "Hide NSFW content",
          summary: "Hides NSFW content from popular, latest, and search results",
          valueIndex: 0,
          entries: ["Show all", "Hide NSFW"],
          entryValues: ["show", "hide"],
        },
      },
    ];
  }

  // ── Popular ───────────────────────────────────────────────────────────────

  async getPopular(page) {
    return this._searchWithSort("order[views_30d]", page);
  }

  // ── Latest Updates ────────────────────────────────────────────────────────

  async getLatestUpdates(page) {
    return this._searchWithSort("order[chapter_updated_at]", page);
  }

  async _searchWithSort(sortParam, page) {
    const params = {
      [sortParam]: "desc",
      limit: 50,
      page,
    };
    const url = this.buildUrl("manga", params);
    return this._searchFromUrl(url);
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async search(query, page, filters) {
    const params = { limit: 50, page };

    // Sort order (default: views_30d desc)
    let sortParam = "order[views_30d]";
    let sortValue = "desc";

    // Process filters
    for (const filter of filters || []) {
      if (filter.type_name === "SelectFilter" && filter.name === "Sort") {
        const opt = filter.values[filter.state];
        if (opt) {
          sortParam = opt.param;
          sortValue = opt.value;
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

    if (query && query.trim() !== "") {
      params.keyword = query.trim();
      // Override sort to relevance when querying
      sortParam = "order[relevance]";
      sortValue = "desc";
    }

    params[sortParam] = sortValue;

    const url = this.buildUrl("manga", params);
    return this._searchFromUrl(url);
  }

  async _searchFromUrl(url) {
    const data = await this.fetchJson(url);
    const items = data?.result?.items || [];
    const pagination = data?.result?.pagination || {};
    const list = items.map((item) => this.mangaFromItem(item));
    const hasNextPage =
      (pagination.page || 1) < (pagination.last_page || 1);
    return { list, hasNextPage };
  }

  // ── Manga Detail ──────────────────────────────────────────────────────────

  async getDetail(url) {
    // url is like "/title/r1234-manga-title" (the path stored in link)
    const parts = url.replace(/^\/+/, "").split("/");
    const hashPart = parts[parts.length - 1]; // "r1234-manga-title"
    const hashId = hashPart.split("-")[0]; // "r1234"

    const params = {
      "includes[]": [
        "demographic",
        "genre",
        "theme",
        "author",
        "artist",
        "publisher",
      ],
    };
    const apiUrl = this.buildUrl(`manga/${hashId}`, params);
    const data = await this.fetchJson(apiUrl);
    const manga = data?.result;

    if (!manga) throw new Error("Manga not found");

    // Build description
    let description = "";
    const score = this.fancyScore(manga.rated_avg);
    if (score) description += score + "\n\n";
    if (manga.synopsis) description += manga.synopsis;

    // Build genres list
    const genres = [];
    const mangaType = manga.type;
    if (mangaType === "manhwa") genres.push("Manhwa");
    else if (mangaType === "manhua") genres.push("Manhua");
    else if (mangaType === "manga") genres.push("Manga");
    else if (mangaType) genres.push("Other");

    for (const arr of [manga.genre, manga.theme, manga.demographic]) {
      if (arr && arr.length) arr.forEach((t) => genres.push(t.title));
    }
    if (manga.is_nsfw) genres.push("NSFW");

    const status = this.statusCode(manga.status);

    const author = manga.author?.map((a) => a.title).join(", ") || "";
    const artist = manga.artist?.map((a) => a.title).join(", ") || "";

    const imageUrl = this.posterUrl(manga.poster, "large");

    // Fetch chapters
    const chapters = await this._fetchAllChapters(hashId);

    return {
      name: manga.title,
      description,
      imageUrl,
      author,
      artist,
      genre: genres,
      status,
      chapters,
    };
  }

  async _fetchAllChapters(hashId) {
    const seen = new Map(); // chapter number -> raw API item
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = this.buildUrl(`manga/${hashId}/chapters`, {
        "order[number]": "desc",
        limit: 100,
        page,
      });
      const data = await this.fetchJson(url);
      const items = data?.result?.items || [];
      const pagination = data?.result?.pagination || {};

      for (const ch of items) {
        const key = ch.number;
        const existing = seen.get(key);
        if (!existing) {
          seen.set(key, ch);
        } else {
          const newIsOfficial = ch.scanlation_group_id === 9275 || ch.is_official === 1;
          const curIsOfficial = existing.scanlation_group_id === 9275 || existing.is_official === 1;
          const better =
            (newIsOfficial && !curIsOfficial) ? true :
              (!newIsOfficial && curIsOfficial) ? false :
                ch.votes !== existing.votes ? ch.votes > existing.votes :
                  ch.updated_at > existing.updated_at;
          if (better) seen.set(key, ch);
        }
      }

      hasMore =
        (pagination.current_page || pagination.page || 1) <
        (pagination.last_page || 1);
      page++;
    }

    return Array.from(seen.values()).map((ch) => {
      let name = `Chapter ${String(ch.number).replace(/\.0$/, "")}`;
      if (ch.name && ch.name.trim() !== "") name += `: ${ch.name}`;

      let scanlator = "Unknown";
      if (ch.scanlation_group?.name) {
        scanlator = ch.scanlation_group.name;
      } else if (ch.is_official === 1 || ch.is_official === true) {
        scanlator = "Official";
      }

      return {
        name,
        url: `title/${hashId}/${ch.chapter_id}`,
        dateUpload: String((ch.updated_at || 0) * 1000),
        scanlator,
      };
    });
  }

  // ── Page List ─────────────────────────────────────────────────────────────

  async getPageList(url) {
    // url is "title/<hashId>/<chapterId>"
    const parts = url.split("/");
    const chapterId = parts[parts.length - 1];

    const apiUrl = `${this.apiUrl}chapters/${chapterId}`;
    const data = await this.fetchJson(apiUrl);
    const result = data?.result;

    if (!result) throw new Error("Chapter not found");
    if (!result.images || result.images.length === 0) {
      throw new Error(`No images found for chapter ${chapterId}`);
    }

    return result.images.map((img) => ({
      url: img.url,
      headers: {
        Referer: `${this.source.baseUrl}/`,
      },
    }));
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  getFilterList() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= 1990; y--) {
      years.push({ type_name: "SelectOption", name: String(y), value: String(y) });
    }
    const yearsWithOlder = [
      ...years,
      { type_name: "SelectOption", name: "Older", value: "older" },
    ];

    return [
      {
        type_name: "SelectFilter",
        name: "Sort",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "Popular (Month)", param: "order[views_30d]", value: "desc" },
          { type_name: "SelectOption", name: "Popular (Week)", param: "order[views_7d]", value: "desc" },
          { type_name: "SelectOption", name: "Popular (All Time)", param: "order[views]", value: "desc" },
          { type_name: "SelectOption", name: "Latest Updated", param: "order[chapter_updated_at]", value: "desc" },
          { type_name: "SelectOption", name: "Newest", param: "order[created_at]", value: "desc" },
          { type_name: "SelectOption", name: "Oldest", param: "order[created_at]", value: "asc" },
          { type_name: "SelectOption", name: "Title A-Z", param: "order[title]", value: "asc" },
          { type_name: "SelectOption", name: "Title Z-A", param: "order[title]", value: "desc" },
          { type_name: "SelectOption", name: "Rating", param: "order[rated_avg]", value: "desc" },
        ],
      },
      {
        type_name: "GroupFilter",
        name: "Status",
        state: [
          { type_name: "CheckBox", name: "Finished", value: "finished" },
          { type_name: "CheckBox", name: "Releasing", value: "releasing" },
          { type_name: "CheckBox", name: "On Hiatus", value: "on_hiatus" },
          { type_name: "CheckBox", name: "Discontinued", value: "discontinued" },
          { type_name: "CheckBox", name: "Not Yet Released", value: "not_yet_released" },
        ],
      },
      {
        type_name: "GroupFilter",
        name: "Type",
        state: [
          { type_name: "CheckBox", name: "Manga", value: "manga" },
          { type_name: "CheckBox", name: "Manhwa", value: "manhwa" },
          { type_name: "CheckBox", name: "Manhua", value: "manhua" },
          { type_name: "CheckBox", name: "Other", value: "other" },
        ],
      },
      {
        type_name: "TextFilter",
        name: "Min Chapters",
        state: "",
      },
      {
        type_name: "SelectFilter",
        name: "Year From",
        state: yearsWithOlder.length - 1, // default: "Older"
        values: yearsWithOlder,
      },
      {
        type_name: "SelectFilter",
        name: "Year To",
        state: 0,
        values: years,
      },
    ];
  }
}

