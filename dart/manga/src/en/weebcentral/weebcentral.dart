import 'package:mangayomi/bridge_lib.dart';
import 'dart:convert';

class WeebCentral extends MProvider {
  WeebCentral({required this.source});

  MSource source;

  final Client client = Client(source);

  @override
  Future<MPages> getPopular(int page) async {
    final res = (await client.get(
      Uri.parse("${source.baseUrl}/popular?page=$page"),
      headers: getHeader(source.baseUrl),
    )).body;
    return parseMangaList(res);
  }

  @override
  Future<MPages> getLatestUpdates(int page) async {
    final res = (await client.get(
      Uri.parse("${source.baseUrl}/latest?page=$page"),
      headers: getHeader(source.baseUrl),
    )).body;
    return parseMangaList(res);
  }

  // Common parser for manga list pages
  MPages parseMangaList(String html) {
    List<MManga> mangaList = [];
    final mangas = parseHtml(html).select("div.manga-list > div.manga-item");
    for (final item in mangas) {
      final nameEl = item.selectFirst("a.manga-title");
      final imageEl = item.selectFirst("img.manga-cover");
      final urlEl = item.selectFirst("a.manga-link");
      if (nameEl == null || urlEl == null) continue;
      MManga manga = MManga();
      manga.name = nameEl.text.trim();
      manga.imageUrl = imageEl?.attr("src") ?? "";
      manga.link = urlEl.attr("href");
      if (!manga.link!.startsWith("http")) {
        manga.link = "${source.baseUrl}${manga.link}";
      }
      mangaList.add(manga);
    }
    // Pagination: check if next page exists (simple heuristic)
    bool hasNextPage = parseHtml(html).selectFirst("a.next-page") != null;
    return MPages(mangaList, hasNextPage);
  }

  @override
  Future<MPages> search(String query, int page, FilterList filterList) async {
    final filters = filterList.filters;
    String url = "${source.baseUrl}/search?q=${Uri.encodeComponent(query)}&page=$page";

    // Apply filters to query string
    for (var filter in filters) {
      if (filter.type == "GenreFilter") {
        for (var item in filter.state) {
          if (item.state == 1) {
            url += "&genres=${Uri.encodeComponent(item.value)}";
          } else if (item.state == 2) {
            url += "&exclude_genres=${Uri.encodeComponent(item.value)}";
          }
        }
      } else if (filter.type == "StatusFilter") {
        url += "&status=${filter.values[filter.state].value}";
      } else if (filter.type == "SortFilter") {
        url += "&sort=${filter.values[filter.state].value}";
      } else if (filter.type == "TypeFilter") {
        url += "&type=${filter.values[filter.state].value}";
      }
    }

    final res = (await client.get(
      Uri.parse(url),
      headers: getHeader(source.baseUrl),
    )).body;
    return parseMangaList(res);
  }

  @override
  Future<MManga> getDetail(String url) async {
    final statusList = [
      {"Ongoing": 0, "Completed": 1, "Hiatus": 2, "Cancelled": 3}
    ];
    final res = (await client.get(
      Uri.parse(url),
      headers: getHeader(source.baseUrl),
    )).body;
    final doc = parseHtml(res);

    MManga manga = MManga();
    manga.author = doc.selectFirst("span.author")?.text ?? "Unknown";
    manga.description = doc.selectFirst("div.description")?.text ?? "";
    final status = doc.selectFirst("span.status")?.text ?? "Unknown";
    manga.status = parseStatus(status, statusList);
    manga.genre = doc.select("a.genre").map((e) => e.text.trim()).toList();

    // Chapter list
    List<MChapter> chapters = [];
    final chapterItems = doc.select("ul.chapter-list > li");
    for (final item in chapterItems) {
      MChapter chapter = MChapter();
      final link = item.selectFirst("a");
      final dateEl = item.selectFirst("span.chapter-date");
      if (link == null) continue;
      chapter.name = link.text.trim();
      chapter.url = link.attr("href");
      if (!chapter.url!.startsWith("http")) {
        chapter.url = "${source.baseUrl}${chapter.url}";
      }
      chapter.dateUpload = dateEl?.attr("data-time") ?? dateEl?.text;
      chapter.scanlator = item.selectFirst("span.scanlator")?.text ?? "";
      chapters.add(chapter);
    }
    manga.chapters = chapters;
    return manga;
  }

  @override
  Future<List<String>> getPageList(String url) async {
    final res = (await client.get(
      Uri.parse(url),
      headers: {
        "Referer": source.baseUrl,
        "Cookie": "adult=true",
      },
    )).body;
    final doc = parseHtml(res);
    // Extract image URLs from the reader
    final images = doc.select("div.reader-container img");
    if (images.isNotEmpty) {
      return images.map((img) => img.attr("src")).where((s) => s.isNotEmpty).toList();
    }
    // Fallback: look for a script containing image array
    final script = doc.select("script").firstWhere(
      (s) => s.text.contains("var images ="),
      orElse: () => null as MElement?,
    );
    if (script != null) {
      final text = script.text;
      final start = text.indexOf("var images = [") + 13;
      final end = text.indexOf("];", start);
      if (start != -1 && end != -1) {
        final jsonStr = "[${text.substring(start, end)}]";
        final List<dynamic> urls = jsonDecode(jsonStr);
        return urls.map((u) => u.toString()).toList();
      }
    }
    return [];
  }

  @override
  List<dynamic> getFilterList() {
    return [
      TextFilter("SearchFilter", "Search..."), // not used but placeholder
      SelectFilter("SortFilter", "Sort By", 0, [
        SelectFilterOption("Latest Update", "latest"),
        SelectFilterOption("Popular", "popular"),
        SelectFilterOption("Title A-Z", "title_asc"),
        SelectFilterOption("Title Z-A", "title_desc"),
      ]),
      SelectFilter("StatusFilter", "Status", 0, [
        SelectFilterOption("All", ""),
        SelectFilterOption("Ongoing", "ongoing"),
        SelectFilterOption("Completed", "completed"),
        SelectFilterOption("Hiatus", "hiatus"),
        SelectFilterOption("Cancelled", "cancelled"),
      ]),
      SelectFilter("TypeFilter", "Type", 0, [
        SelectFilterOption("All", ""),
        SelectFilterOption("Manga", "manga"),
        SelectFilterOption("Manhwa", "manhwa"),
        SelectFilterOption("Manhua", "manhua"),
        SelectFilterOption("Comic", "comic"),
      ]),
      GroupFilter("GenreFilter", "Genres", [
        TriStateFilter("Action", "action"),
        TriStateFilter("Adventure", "adventure"),
        TriStateFilter("Comedy", "comedy"),
        TriStateFilter("Drama", "drama"),
        TriStateFilter("Fantasy", "fantasy"),
        TriStateFilter("Horror", "horror"),
        TriStateFilter("Romance", "romance"),
        TriStateFilter("Sci-Fi", "sci-fi"),
        TriStateFilter("Slice of Life", "slice_of_life"),
        TriStateFilter("Supernatural", "supernatural"),
        TriStateFilter("Mystery", "mystery"),
        TriStateFilter("Psychological", "psychological"),
        TriStateFilter("Tragedy", "tragedy"),
        TriStateFilter("Isekai", "isekai"),
        TriStateFilter("Martial Arts", "martial_arts"),
        TriStateFilter("Harem", "harem"),
        TriStateFilter("Ecchi", "ecchi"),
        TriStateFilter("Mature", "mature"),
        TriStateFilter("Shounen", "shounen"),
        TriStateFilter("Shoujo", "shoujo"),
        TriStateFilter("Seinen", "seinen"),
        TriStateFilter("Josei", "josei"),
      ]),
    ];
  }
}

Map<String, String> getHeader(String url) {
  return {
    "Referer": "$url/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  };
}

WeebCentral main(MSource source) {
  return WeebCentral(source: source);
}