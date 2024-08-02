chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["youtube.js"],
      });
    });
  });
});

let showingConverters = false;

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url.includes("youtube.com/watch")
  ) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["youtube.js"],
    });
    const queryParameters = tab.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);

    let IsSelected = false;

    const currentTab = await getActiveTabURL();

    if (currentTab.id == tabId) IsSelected = true;

    console.log("new video selected: " + IsSelected);
    chrome.tabs.sendMessage(tabId, {
      action: "NewVideo",
      video: urlParameters.get("v"),
      active: IsSelected,
    });
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (!showingConverters) chrome.contextMenus.removeAll();
    showingConverters = false;

    if (tab.url && tab.url.includes("youtube.com/watch")) {
      chrome.tabs.sendMessage(activeInfo.tabId, {
        action: "showConvertedOptions",
      });
    } else {
      console.log("no video url");
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action == "showConvertedOptions") {
    console.log("deleting context menus");
    chrome.contextMenus.removeAll();

    chrome.contextMenus.create({
      id: "mp4",
      title: "Convert to MP4",
      contexts: ["page"],
    });

    chrome.contextMenus.create({
      id: "mp3",
      title: "Convert to MP3",
      contexts: ["page"],
    });
    for (const mp3Format of message.mp3) {
      chrome.contextMenus.create({
        id: mp3Format,
        parentId: "mp3",
        title: mp3Format,
        contexts: ["page"],
      });
    }

    for (const mp4Format of message.mp4) {
      chrome.contextMenus.create({
        id: mp4Format,
        parentId: "mp4",
        title: mp4Format,
        contexts: ["page"],
      });
    }
  }

  if (message.action == "DownloadVideo") {
    const videoId = message.videoId;
    downloadVideo(videoId, message.format);
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.tabs.sendMessage(tab.id, {
    action: "GetInfoOfDownload",
    format: info.menuItemId,
  });
});

async function getActiveTabURL() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(tabs[0]);
    });
  });
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
    const urlObject = await blobToBase64(blob);
    const contentDisposition = videoDownload.headers.get("Content-Disposition");
    const filename = extractFilename(contentDisposition).replace(
      /["?~<>*|]/g,
      " "
    );

    chrome.downloads.download({
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
    const urlObject = await blobToBase64(blob);
    const contentDisposition = videoDownload.headers.get("Content-Disposition");
    const filename = extractFilename(contentDisposition).replace(
      /["?~<>*|]/g,
      " "
    );

    chrome.downloads.download({
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

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
  });
}
