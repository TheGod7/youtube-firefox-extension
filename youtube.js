let mp4FormatOptions = [];
let mp3FormatOptions = [];
let CurrentVideoId;

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action == "NewVideo") {
    await FetchingFormats(message.video);
    CurrentVideoId = message.video;
    if (!message.active) return;

    browser.runtime.sendMessage({
      action: "ShowConvertedOptions",
      mp3: mp3FormatOptions,
      mp4: mp4FormatOptions,
    });
  }

  if (message.action == "showConvertedOptions") {
    if (!CurrentVideoId) {
      const url = window.location.href;
      const videoId = getYouTubeVideoID(url);

      CurrentVideoId = videoId;
    }

    if (mp3FormatOptions.length <= 0 || mp4FormatOptions.length <= 0)
      await FetchingFormats(CurrentVideoId);

    browser.runtime.sendMessage({
      action: "ShowConvertedOptions",
      mp3: mp3FormatOptions,
      mp4: mp4FormatOptions,
    });
  }

  if (message.action == "GetInfoOfDownload") {
    const format = parseMediaString(message.format);

    browser.runtime.sendMessage({
      action: "DownloadVideo",
      videoId: CurrentVideoId,
      format,
    });
  }
});

async function FetchingFormats(video) {
  if (!video) return;

  const mp4FormatsFetch = await fetch(
    `http://localhost:3000/api/${video}/youtube/info`
  );

  const mp4FormatResults = await mp4FormatsFetch.json();

  const mp4Formats = [...new Set(mp4FormatResults)].sort((a, b) => {
    const resolutionA = parseInt(a.match(/(\d+)p/)[1], 10);
    const resolutionB = parseInt(b.match(/(\d+)p/)[1], 10);

    return resolutionA - resolutionB;
  });

  mp4FormatOptions = mp4Formats;

  const mp3FormatsFetch = await fetch(
    `http://localhost:3000/api/${video}/youtube/info?audioOnly=true`
  );

  const mp3FormatResults = await mp3FormatsFetch.json();

  const mp3Formats = [...new Set(mp3FormatResults)].sort((a, b) => {
    const qualityA = parseInt(a.match(/(\d+)/)[1], 10);
    const qualityB = parseInt(b.match(/(\d+)/)[1], 10);
    return qualityA - qualityB;
  });

  mp3FormatOptions = mp3Formats;
}

function getYouTubeVideoID(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|v\/|e\/|user\/\w+\/|embed\/|watch\?v=|watch\?.+&v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function parseMediaString(input) {
  const regex = /(\w+)\s*-\s*(\w+\d*)/;
  const match = input.match(regex);

  if (match) {
    const format = match[1];
    const resolution = match[2];
    return { format, resolution };
  } else {
    throw new Error("The format is invalid");
  }
}
