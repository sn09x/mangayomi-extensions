import '../../../../../../../model/source.dart';

Source get tatakaescanSource => _tatakaescanSource;

Source _tatakaescanSource = Source(
  name: "Tatakae Scan",
  baseUrl: "https://tatakaescan.com",
  lang: "pt-BR",

  typeSource: "madara",
  iconUrl:
      "https://raw.githubusercontent.com/sn09x/mangayomi-extensions/$branchName/dart/manga/multisrc/madara/src/pt/tatakaescan/icon.png",
  dateFormat: "dd 'de' MMMMM 'de' yyyy",
  dateFormatLocale: "pt-br",
);

