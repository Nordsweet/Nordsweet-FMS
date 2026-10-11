window.ATIS_DB_CONFIG = {
  readUrl: "",
  writeUrl: "",
  token: "",
  sourceTag: "ENR",
  atisGuruRoot: "https://atis.guru",
  atisGuruProxyUrl: "https://api.codetabs.com/v1/proxy?quest=",
  // Deploy the Czech IBS proxy, then set its public URL here.
  // It receives ?airport=LKPR&anode=atis_atis_lkpr and returns JSON or raw D-ATIS.
  czechIbsProxyUrl: "",
  czechIbsAnodes: {
    LKPR: "atis_atis_lkpr"
  }
};
