import '../../../../../model/source.dart';

Source get weebCentralSource => _weebCentralSource;
const _weebCentralVersion = "0.0.1";
const _weebCentralSourceCodeUrl =
    "https://raw.githubusercontent.com/yourrepo/mangayomi-extensions/$branchName/dart/manga/src/en/weebcentral/weebcentral.dart";

Source _weebCentralSource = Source(
  name: "WeebCentral",
  baseUrl: "https://weebcentral.com",
  lang: "en",
  typeSource: "single",
  iconUrl:
      "https://raw.githubusercontent.com/yourrepo/mangayomi-extensions/$branchName/dart/manga/src/en/weebcentral/icon.png",
  sourceCodeUrl: _weebCentralSourceCodeUrl,
  itemType: ItemType.manga,
  version: _weebCentralVersion,
  hasCloudflare: true,
  sourceCodeLanguage: 1, // Dart
  notes: "Requires WebView bypass; chapters fallback implemented.",
);
