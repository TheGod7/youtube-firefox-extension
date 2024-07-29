let ShowingConvertedOption = false;

browser.tabs.onUpdated.addListener(async (tabId, tabInfo) => {
  if (tabInfo.url && tabInfo.url.includes("youtube.com/watch")) {
    const queryParameters = tabInfo.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);
    let IsSelected = false;

    const tabSelected = await getActiveTabURL();

    if (tabSelected.id == tabId) IsSelected = true;

    browser.tabs.sendMessage(tabId, {
      action: "NewVideo",
      video: urlParameters.get("v"),
      active: IsSelected,
    });
  } else {
    const currentTab = await getActiveTabURL();

    console.log(currentTab);
    if (currentTab.url.includes("youtube.com/watch")) return;

    if (!ShowingConvertedOption) browser.contextMenus.removeAll();
    ShowingConvertedOption = false;
  }
});

browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId, (tab) => {
    if (!ShowingConvertedOption) browser.contextMenus.removeAll();
    ShowingConvertedOption = false;

    if (tab.url && tab.url.includes("youtube.com/watch")) {
      browser.tabs.sendMessage(tab.id, { action: "showConvertedOptions" });
    } else {
      console.log("no video url");
    }
  });
});

browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action == "ShowConvertedOptions") {
    browser.contextMenus.removeAll();

    browser.contextMenus.create({
      id: "mp4",
      title: "Convert to MP4",
      contexts: ["page"],
    });

    browser.contextMenus.create({
      id: "mp3",
      title: "Convert to MP3",
      contexts: ["page"],
    });

    for (const mp3Format of message.mp3) {
      browser.contextMenus.create({
        id: mp3Format,
        parentId: "mp3",
        title: mp3Format,
        contexts: ["page"],
      });
    }

    for (const mp4Format of message.mp4) {
      browser.contextMenus.create({
        id: mp4Format,
        parentId: "mp4",
        title: mp4Format,
        contexts: ["page"],
      });
    }
  }

  if (message.action == "DownloadVideo") {
    const videoId = message.videoId;
    console.log(message.format);
    downloadVideo(videoId, message.format);
  }
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  browser.tabs.sendMessage(tab.id, {
    action: "GetInfoOfDownload",
    format: info.menuItemId,
  });
});

async function getActiveTabURL() {
  const tabs = await browser.tabs.query({
    currentWindow: true,
    active: true,
  });

  return tabs[0];
}

async function downloadVideo(videoId, { format, resolution }) {
  if (format == "mp3") {
    const body = {
      bitrate: resolution,
    };

    const videoDownload = await fetch(
      `http://localhost:3000/api/${videoId}/youtube/download?audioOnly=true`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const blob = await videoDownload.blob();
    const urlObject = URL.createObjectURL(blob);
    const contentDisposition = videoDownload.headers.get("Content-Disposition");
    const filename = extractFilename(contentDisposition).replace(
      /["?~<>*|]/g,
      " "
    );

    console.log(filename);
    browser.downloads.download({
      url: urlObject,
      filename: filename,
    });
  }

  if (format == "mp4") {
    const body = {
      quality: resolution,
    };

    const videoDownload = await fetch(
      `http://localhost:3000/api/${videoId}/youtube/download`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const blob = await videoDownload.blob();
    const urlObject = URL.createObjectURL(blob);
    const contentDisposition = videoDownload.headers.get("Content-Disposition");
    const filename = extractFilename(contentDisposition).replace(
      /["?~<>*|]/g,
      " "
    );

    browser.downloads.download({
      url: urlObject,
      filename: filename,
    });
  }
}

function extractFilename(contentDisposition) {
  let filename = "";

  if (contentDisposition && contentDisposition.includes("attachment")) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  return filename;
}
