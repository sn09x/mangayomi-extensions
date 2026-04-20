import '../../../../../../../model/source.dart';

Source get doodmangaSource => _doodmangaSource;

Source _doodmangaSource = Source(
  name: "Doodmanga",
  baseUrl: "https://www.doodmanga.com",
  lang: "th",

  typeSource: "madara",
  iconUrl:
      "https://raw.githubusercontent.com/sn09x/mangayomi-extensions/$branchName/dart/manga/multisrc/madara/src/th/doodmanga/icon.png",
  dateFormat: "dd MMMMM yyyy",
  dateFormatLocale: "th",
);

