import 'package:mangayomi/bridge_lib.dart';
import 'dart:convert';

class WeebCentralSource extends MProvider {
  WeebCentralSource() {
    name = "WeebCentral";
    baseUrl = "https://weebcentral.com";
    lang = "en";
    requiresWebView = true; // critical for Cloudflare bypass
  }

  @override
  Future<List<Manga>> searchManga(String query) async {
    final res = await client.get("$baseUrl/search/data?query=$query");
    final document = parseHtml(res.body);

    return document.querySelectorAll("a[href*='/series/']").map((el) {
      final title = el.querySelector("h3")?.text ?? "";
      final cover = el.querySelector("img")?.attributes["src"] ?? "";
      final url = el.attributes["href"] ?? "";
      return Manga(title: title, cover: cover, url: url);
    }).toList();
  }

  @override
  Future<MangaDetail> getDetail(String url) async {
    final res = await client.get(url);
    final document = parseHtml(res.body);

    final title = document.querySelector("h1")?.text ?? "";
    final description = document.querySelector("p.whitespace-pre-wrap")?.text ?? "";
    final author = document.querySelector("li:contains('Author')")?.text.replaceAll("Author:", "").trim() ?? "";

    // Try full chapter list first
    List<Chapter> chapters = [];
    try {
      final resCh = await client.get("$url/full-chapter-list");
      final docCh = parseHtml(resCh.body);
      chapters = docCh.querySelectorAll("a[href*='/chapter/']").map((el) {
        final name = el.text.trim();
        final chUrl = el.attributes["href"] ?? "";
        return Chapter(name: name, url: chUrl);
      }).toList();
    } catch (_) {
      // Fallback: scrape from main page
      chapters = document.querySelectorAll("a[href*='/chapter/']").map((el) {
        final name = el.text.trim();
        final chUrl = el.attributes["href"] ?? "";
        return Chapter(name: name, url: chUrl);
      }).toList();
    }

    return MangaDetail(
      title: title,
      description: description,
      author: author,
      chapters: chapters,
    );
  }

  @override
  Future<List<Page>> getPageList(String chapterUrl) async {
    final res = await client.get(chapterUrl);
    final document = parseHtml(res.body);

    return document.querySelectorAll("img[src*='compsci88']").map((el) {
      final imgUrl = el.attributes["src"] ?? "";
      return Page(url: imgUrl);
    }).toList();
  }
}
