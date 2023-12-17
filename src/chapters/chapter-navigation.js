import { story } from "../main.js";
import {
  createCustomRadiusShader,
  performFlyTo,
  removeCustomRadiusShader,
} from "../utils/cesium.js";
import { setSelectedMarker } from "../utils/create-markers.js";
import { getParams, setParams } from "../utils/params.js";
import { loadSvg } from "../utils/svg.js";
import { setTextContent } from "../utils/ui.js";
import { getYouTubeVideoId } from "../sidebar/sidebar.js";

/**
 * The time in milliseconds between each chapter progression
 * @readonly
 */
const TIME_PER_CHAPTER = 3000;

// SVG icons
/**
 * Icon shown to pause the autoplay
 */
const PAUSE_ICON = await loadSvg("round-pause-button");
/**
 * Icon shown to pause the autoplay
 */
const PLAY_ICON = await loadSvg("round-play-button");

// Html elements
/** The nav element shown on the intro details overlay
 * @type {HTMLNavElement}
 */
const introNavigation = document.querySelector(".intro-navigation");
/** The nav element shown on the story details overlay
 * @type {HTMLNavElement}
 */
const detailNavigation = document.querySelector(".detail-navigation");
/** The button to start the story / leave the intro overlay with
 * @type {HTMLButtonElement}
 */
const startButton = introNavigation.querySelector("#start-story");
/** The button to play the story chapter by chapter
 * @type {HTMLButtonElement}
 */
const autoplayButton = detailNavigation.querySelector("#autoplay-story");
/** The button to progress the story backward with
 * @type {HTMLButtonElement}
 */
const backButton = detailNavigation.querySelector("#chapter-backward");
/** The button to progress the story forward with
 * @type {HTMLButtonElement}
 */
const forwardButton = detailNavigation.querySelector("#chapter-forward");

/**
 * The id used to identify the timeout instance for the story progression
 * @type {number | null}
 */
let intervalId = null;

/**
 * Initializes and manages chapter navigation for a story.
 * This function sets up navigation elements for the introduction and chapters of a story.
 * It determines the current chapter based on URL parameters and updates the UI accordingly.
 */
export function initChapterNavigation() {
  // Set up event listeners
  startButton.addEventListener("click", () => {
    activateNavigationElement("details");
    updateChapter(0);
  });

  forwardButton.addEventListener("click", () => {
    setNextChapter();
    stopAutoplay();
  });

  backButton.addEventListener("click", () => {
    setPreviousChapter();
    stopAutoplay();
  });

  autoplayButton.addEventListener("click", autoplayClickHandler);

  // Get the current chapter based on URL parameters
  const params = getParams();
  const chapterId = params.get("chapterId");

  // Initialize chapter content based on URL parameters
  if (chapterId !== null) {
    const chapterIndex = story.chapters.findIndex(
      (chapter) => Number(chapter.id) === Number(chapterId)
    );
    updateChapter(chapterIndex);
  } else {
    resetToIntro();
  }
}

/**
 * Stops the autoplay chapter progression of the story.
 */
function stopAutoplay() {
  autoplayButton.innerHTML = PLAY_ICON;
  clearTimeout(intervalId);
  intervalId = null;
}

/**
 * Progresses to the next chapter and stops progression if the current chapter is the last one.
 * @param {type} paramName - description of parameter
 */
function setNextAutoplayStep() {
  setNextChapter();
  if (getCurrentChapterIndex() === story.chapters.length - 1) {
    stopAutoplay();
  }
}

/**
 * Starts the autoplay chapter progression.
 */
function autoplayClickHandler() {
  // If the interval is already active, stop it
  if (intervalId) {
    stopAutoplay();
  } else {
    // If the interval is not active, start it
    intervalId = setInterval(setNextAutoplayStep, TIME_PER_CHAPTER);
    autoplayButton.innerHTML = PAUSE_ICON;
  }
}

/**
 * Sets the previous chapter as the current chapter.
 */
const setPreviousChapter = () => {
  const newChapterIndex = getCurrentChapterIndex() - 1;

  // If the new chapter index is positive, update the current chapter
  if (newChapterIndex >= 0) {
    updateChapter(newChapterIndex);
    // when going back further in the chapters, go back to teh intro
  } else {
    resetToIntro();
  }
};

/**
 * Continues to the next chapter in the story.
 */
const setNextChapter = () => {
  const newChapterIndex = getCurrentChapterIndex() + 1;

  // If the new chapter index is less than the total number of chapters, update the current chapter
  // (Then did not reach end of chapters)
  if (newChapterIndex < story.chapters.length) {
    updateChapter(newChapterIndex);
  }
};

/**
 * Resets the application to the introductory state.
 */
export function resetToIntro() {
  const { cameraOptions } = story.properties;
  const { position, pitch, heading, roll } = cameraOptions;

  setParams("chapterId", null); // Clear the chapter parameter
  setSelectedMarker(null); // "Deselect" current marker
  updateChapterContent(story.properties); // Update the chapter details content
  activateNavigationElement("intro"); // Activate the introduction navigation
  removeCustomRadiusShader(); // Remove the custom radius shader
  // Fly back to the starting position
  performFlyTo({
    position,
    orientation: {
      roll,
      pitch,
      heading,
    },
    duration: 1,
  });
}

/**
 * Updates the current chapter of the story based on the given chapter index.
 * @param {number} chapterIndex - The index of the chapter to be updated.
 */
export function updateChapter(chapterIndex) {
  const { cameraOptions, coords } = story.chapters[chapterIndex];
  const { position, pitch, heading, roll } = cameraOptions;

  setSelectedMarker(chapterIndex); // Set the selected marker
  setParams("chapterId", story.chapters[chapterIndex].id); // Set the chapter parameter
  updateChapterContent(story.chapters[chapterIndex], false); // Update the chapter details content
  activateNavigationElement("details"); // Activate the details navigation

  // Check if the current chapter has a focus and create or remove the custom radius shader accordingly
  const hasFocus = story.chapters[chapterIndex].focusOptions.showFocus;

  if (hasFocus) {
    const radius = story.chapters[chapterIndex].focusOptions.focusRadius;

    createCustomRadiusShader(coords, radius); // Create the custom radius shader
  } else {
    removeCustomRadiusShader(); // Remove the custom radius shader
  }

  // Fly to the new chapter location
  performFlyTo({
    position,
    orientation: {
      roll,
      pitch,
      heading,
    },
    duration: 2,
  });
}

/**
 * Sets the active classname on the navigation elements based on chapter presence.
 * @param {'intro' | 'details'} chapterParam - The navigation element to be toggled.
 */
export function activateNavigationElement(navName) {
  introNavigation.classList.toggle("active", navName === "intro");
  detailNavigation.classList.toggle("active", navName === "details");
}

/**
 * Returns the index of the current chapter.
 * @returns {number} - The index of the current chapter.
 */
export const getCurrentChapterIndex = () => {
  const params = getParams();
  const chapterId = params.get("chapterId");

  // Get the index of the current chapter
  const chapterIndex = story.chapters.findIndex(
    (chapter) => Number(chapter.id) === Number(chapterId)
  );

  return chapterIndex;
};

/**
 * Updates the details navigation. This includes the chapter index and
 * the forward button (if the current chapter is the last).
 */
export function updateDetailsNavigation() {
  // Update chapter index
  const chapterIndex = getCurrentChapterIndex() + 1;
  // Displays the current chapter index
  detailNavigation.querySelector(
    "#chapter-index"
  ).textContent = `${chapterIndex} / ${story.chapters.length}`;

  // If the last chapter is reached, disable the forward button
  // Check if the current chapter is the last chapter
  if (chapterIndex === story.chapters.length) {
    // Disable the forward button
    forwardButton.disabled = true;
  } else {
    // Enable the forward button
    forwardButton.disabled = false;
  }
}

/**
 * Updates the content of the chapter detail section.
 * @param {Chapter} chapter - The data object containing chapter details
 * @param {boolean} [isIntro=true] - Flag indicating if the current view is the introduction.
 */
export function updateChapterContent(chapter, isIntro = true) {
  const { media, ...chapterData } = chapter;
  console.log(
    "🚀 ~ file: chapter-navigation.js:274 ~ updateChapterContent ~ media:",
    media
  );

  updateDetailsNavigation();

  setTextContent(".story-title", isIntro ? "" : story.properties.title);
  setTextContent("h2", isIntro ? story.properties.title : chapterData.title);
  setTextContent(
    ".description",
    isIntro ? story.properties.description : chapterData.content
  );

  setTextContent(".date", isIntro ? "" : chapterData.dateTime);
  setTextContent(".place", chapterData.address);

  // Update media content
  media && setMediaContent(media);

  // Update image credit
  const mediaCredit = media?.mediaCredit
    ? `Image credit: ${media?.mediaCredit}`
    : "";

  setTextContent(".story-intro-attribution", isIntro ? mediaCredit : "");
  setTextContent(".attribution", isIntro ? "" : mediaCredit);

  // Update author and date in intro
  setTextContent(
    ".story-intro-author",
    isIntro && story.properties.createdBy
      ? `by: ${story.properties.createdBy}`
      : ""
  );

  setTextContent(".story-intro-date", isIntro ? story.properties.date : "");

  // Update chapter index and forward button state
  updateChapterIndexAndNavigation();
}

/**
 * Updates the chapter index display and the state of the forward navigation button.
 */
function updateChapterIndexAndNavigation() {
  const chapterIndex = getCurrentChapterIndex();
  const chapterIndexDisplay = `${chapterIndex + 1} / ${story.chapters.length}`;
  setTextContent("#chapter-index", chapterIndexDisplay);

  // Update forward button state
  forwardButton.disabled = chapterIndex + 1 === story.chapters.length;
}

// Load the IFrame Player API code asynchronously.
let tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
let firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;

function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    events: {
      onStateChange: onPlayerStateChange,
    },
  });
}

function onPlayerStateChange(event) {
  if (event.data == YT.PlayerState.ENDED) {
    // Todo: go to next chapter
  }
}

function setMediaContent(mediaData) {
  const mediaContainer = document.getElementById("media-container");

  const mediaUrl = mediaData.url;

  // Clear previous content
  mediaContainer.innerHTML = "";

  if (mediaData.type === "image") {
    const imgElement = document.createElement("img");
    imgElement.src = mediaUrl;
    mediaContainer.appendChild(imgElement);
  } else if (mediaData.type === "video") {
    const iframeElement = document.createElement("div");
    iframeElement.id = "player";
    mediaContainer.appendChild(iframeElement);

    player = new YT.Player("player", {
      height: "150",
      width: "300",
      videoId: getYouTubeVideoId(mediaUrl),
      events: {
        onReady: function (event) {
          // Todo: pause interactive mode
          // event.target.playVideo();
        },
        onStateChange: onPlayerStateChange,
      },
    });
  } else {
    mediaContainer.innerHTML = "No media available or invalid media type";
  }
}
