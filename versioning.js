"use strict";

// version and caching control
const version = "1.87.10"; // generator version, update each time

{
  document.title += " v" + version;
  const loadingScreenVersion = document.getElementById("version");
  if (loadingScreenVersion) loadingScreenVersion.innerHTML = version;

  const versionNumber = parseFloat(version);
  const storedVersion = localStorage.getItem("version") ? parseFloat(localStorage.getItem("version")) : 0;

  const isOutdated = storedVersion !== versionNumber;
  if (isOutdated) clearCache();

  const showUpdate = storedVersion < versionNumber;
  if (showUpdate) setTimeout(showUpdateWindow, 6000);

  function showUpdateWindow() {
    const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";
    const reddit = "https://www.reddit.com/r/FantasyMapGenerator";
    const discord = "https://discordapp.com/invite/X7E84HU";
    const patreon = "https://www.patreon.com/azgaar";

    alertMessage.innerHTML = /* html */ `<strong>这是一次假更新，目的是给所有用1.8汉化版本的使用者提个醒，具体内容请到哔哩哔哩搜索BV1pz4y1H7eD或<a href="https://www.bilibili.com/video/BV1pz4y1H7eD/" target="_blank">点击此链接</a>,注：假更新后版本号为1.87.10</strong>
      ${storedVersion ? "<span>Reload the page to fetch fresh code.</span>" : ""}
`;

    const buttons = {
      Ok: function () {
        $(this).dialog("close");
        if (storedVersion) localStorage.clear();
        localStorage.setItem("version", version);
      }
    };

    if (storedVersion) {
      buttons.Reload = () => {
        localStorage.clear();
        localStorage.setItem("version", version);
        location.reload();
      };
    }

    $("#alert").dialog({
      resizable: false,
      title: "所有使用者请注意！",
      width: "28em",
      position: {my: "center center-4em", at: "center", of: "svg"},
      buttons
    });
  }

  async function clearCache() {
    const cacheNames = await caches.keys();
    Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }
}
