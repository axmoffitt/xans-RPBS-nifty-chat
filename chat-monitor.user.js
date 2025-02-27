// ==UserScript==
// @name           Nifty Chat Monitor, Rustproof Bee Shed Edition
// @namespace      https://roadhog123.co.uk/
// @description    reformats twitch chat for display on a chat monitor
// @match          https://www.twitch.tv/popout/*/chat?display*
// @match          https://www.twitch.tv/*?display*
// @version        0.307-RPBS01-VS01
// @require        https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require        https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant          GM_getResourceText
// @grant          GM_addStyle
// @require        https://raw.githubusercontent.com/sizzlemctwizzle/GM_config/master/gm_config.js
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_log
// @resource style https://raw.githubusercontent.com/axmoffitt/xans-RPBS-nifty-chat/master/chat_monitor.css
// @resource material-icons https://fonts.googleapis.com/icon?family=Material+Icons
// ==/UserScript==

let getQS = str => {
  let a,
    q = {},
    r = /([^?=&\r\n]+)(?:=([^&\r\n]*))?/g;
  while ((a = r.exec(str)) !== null) {
    q[a[1]] = a[2] || "";
  }
  return q;
};

var qs = getQS(location.search);

var inlineImages = false;

//Create config page fields
//Fields appear in the order written below.
//Maybe in the future this could be loaded from a JSON file? It would be easier to maintain.
var configFields = {
  font: {
    label: "Font", // Appears next to field
    type: "select", // Makes this setting a dropdown
    options: ["Twitch Default", "Open Sans Condensed"], // Possible choices
    default: "Open Sans Condensed" // Default value if user doesn't change it
  },
  HideChatInput: {
    //Id for field in html
    label: "Hide Chat Input Area", //Label that appears on the config
    type: "checkbox",
    default: true
  },
  ReverseDirection: {
    label: "New messages appear on top",
    type: "checkbox",
    default: true
  },
  InlineImages: {
    label: "Display images that are linked",
    type: "checkbox",
    default: true
  },
  SmoothScroll: {
    label: "Make new messages slide in smoothly (only works when messages appear on top)",
    type: "checkbox",
    default: true
  },
  SmoothScrollSpeed: {
    label: "Time needed for a new message to slide in (seconds)",
    type: "float",
    default: "1"
  },
  UsernamesToHighlight: {
    label: "Username(s)",
    section: ["Username Highlighting", "Change the color of any of the usernames listed below. Separate with commas"],
    type: "text",
    title: "seperate usernames with commas, case sensitive",
    //These as defaults as I can't imagine Paul will mind, and I know I don't mind.
    default: "ThingsOnMyStream, cheetoJack"
  },
  UsernameHighlightingColor: {
    label: "Highlight Color",
    type: "text",
    default: "#ff6696" //Its pink. Its a good color bront.
  },
  KeywordsToHighlight: {
    label: "Keyword(s)",
    section: ["Keyword Highlighting", "Change the background color of any messages that use the keywords listed below. Separate with commas"],
    type: "text",
    title: "seperate keywords with commas, case sensitive",
    default: ""
  },
  KeywordHighlightingBackgroundColor: {
    label: "Highlight Background Color",
    type: "text",
    default: "#560b33" //Its also pink.
  },
  CustomHighlighting: {
    label: "",
    section: ["CSS User Highlighting"],
    type: "textarea",
    //Keeping CSS in from chat-monitor-highlight.css as an example of what you can do
    default:
      ".chat-line__message[data-badges*='Moderator'] .chat-author__display-name {\n" +
      "\tcolor: #8383f9 !important;\n" +
      "}\n" +
      ".chat-line__message[data-badges*='Broadcaster'] {\n" +
      "\tbackground-color: #000090 !important;\n" +
      "}\n" +
      ".chat-line__message[data-badges*='Broadcaster'] .chat-author__display-name {\n" +
      "\tcolor: #00b5e0 !important;\n" +
      "}\n" +
      ".chat-line__message[data-user='LRRbot'] .chat-author__display-name {\n" +
      "\tcolor:purple !important;\n" +
      "}\n" +
      ".chat-line__message[data-user='LRRbot'][data-message*='thanks for']{\n" +
      "\tbackground-color:purple !important;\n" +
      "}\n" +
      ".chat-line__message[data-user='LRRbot'][data-message*='thanks for'] .chat-author__display-name{\n" +
      "\tcolor:black !important;\n" +
      "}\n" +
      ".chat-line__message[data-message*='loadingreadyrun'] {\n" +
      "\tbackground-color: #00005d !important;\n" +
      "}"
  },
  RefreshReminder: {
    label: "",
    section: ["After saving, be sure to refresh the page to have your new settings apply!"],
    type: "hidden"
  }
};
var scrollDistance = 0,
  scrollReference = +new Date();

initConfig();
var MESSAGE_CONTAINER = ".chat-scrollable-area__message-container";
waitForKeyElements(MESSAGE_CONTAINER, onChatLoad);
var twitterScript = document.createElement("script");
twitterScript.type = "text/javascript";
twitterScript.src = "https://platform.twitter.com/widgets.js";
document.body.appendChild(twitterScript);

function onChatLoad() {
  loadSettings();
  actionFunction();
}

//Creates , inits the config handler
//See https://github.com/sizzlemctwizzle/GM_config/wiki for details
function initConfig() {
  GM_config.init({
    id: "chat-config",
    title: "Nifty Chat Monitor Settings",
    fields: configFields,
    // I need a better way of settings this css attribute. I'm thinking of converting
    // it to a variable, because I could use new lines in that and keep it somewhere
    // out of sight, but thats for later-Jack
    css:
      "#chat-config .field_label { font-size: 32px !important; line-height: 35px !important; font-family: 'Open Sans Condensed', sans-serif !important; font-weight: normal !important; } .config_var input[type=checkbox] {  transform: scale(2.0); } #chat-config_field_CustomHighlighting { width: 90%; height: 500px; }" //adds CSS to the config page
  });
}

//Checks all config options and loads them appropriately
function loadSettings() {
  //Add settings wheel to page
  $(".chat-room").append('<div id="settings-wheel"> <i class="material-icons">settings</i> </div>');
  $("#settings-wheel").click(function() {
    GM_config.open();
  });

  //Reverse messages
  if (typeof qs.reverse !== "undefined" || GM_config.get("ReverseDirection")) {
    document.querySelector(MESSAGE_CONTAINER).classList.add("reverse");
  }

  //Hide chat interface
  if (GM_config.get("HideChatInput")) {
    document.querySelector(".chat-input").classList.add("tw-hide");
  }

  //Check if we should be adding inline images or not
  if (typeof qs.img !== "undefined" || GM_config.get("InlineImages")) {
    inlineImages = true;
  }

  //Handles UsernamesToHighlight, UsernameHighlightingColor, CustomHighlighting config fields
  addCssFromConfig(generateCss());
}

//Adds the CSS from the config fields
//generatedCss will be added to the CSS on the page.
function addCssFromConfig(generatedCss) {
  //Add CSS from text area
  var customHighlighting = GM_config.get("CustomHighlighting");
  var head = document.getElementsByTagName("head")[0];
  var newCss = document.createElement("style");
  newCss.type = "text/css";
  newCss.innerHTML = generatedCss + "\n" + customHighlighting;
  head.appendChild(newCss);
}

//Creates CSS from config fields
function generateCss() {
  //Stores CSS generated by various options
  var generatedCss = "";
  generatedCss += generateFontCss();
  generatedCss += generateUsernameHighlightingCss();
  generatedCss += generateKeywordHighlightingCss();
  return generatedCss;
}

//Handles UsernamesToHighlight section, returns CSS as a string
function generateUsernameHighlightingCss() {
  var generatedCss = "";
  //Load config options, Check if contains data
  var usernamesToHighlight = GM_config.get("UsernamesToHighlight")
  var usernameHighlightColor = GM_config.get("UsernameHighlightingColor");
  if (usernamesToHighlight && usernameHighlightColor) {
    //Split into array on commas
    var usernameList = usernamesToHighlight.split(",");
    //Adds rule for each username. This could just add one rule, and save a bit of space, but I think this works just as well.
    for (var i = 0; i < usernameList.length; i++) {
      //Add css to variable
      generatedCss +=
        '.chat-line__message[data-user="' +
        usernameList[i].trim() +
        '"] .chat-author__display-name {\n\tcolor: ' +
        usernameHighlightColor +
        " !important;\n }\n";
    }
  }
  return generatedCss;
}

//Handles KeywordsToHighlight section, returns CSS as a string
function generateKeywordHighlightingCss() {
  var generatedCss = "";
  //Load config options, Requires either Text or Background color, but not both
  //data-message attribute makes everything lowercase, so we do the same to our keywords.
  var keywordsToHighlight = GM_config.get("KeywordsToHighlight").toLowerCase();
  var keywordHighlightBackgroundColor = GM_config.get("KeywordHighlightingBackgroundColor");
  if (keywordsToHighlight && keywordHighlightBackgroundColor) {
    //Split into array on commas
    var keywordList = keywordsToHighlight.split(",");
    //Adds rule for each username. This could just add one rule, and save a bit of space, but I think this works just as well.
    for (var i = 0; i < keywordList.length; i++) {
      //Add css to variable
      generatedCss += '.chat-line__message[data-message*="' + keywordList[i] + '"] {';
      generatedCss += "\n\tbackground-color: " + keywordHighlightBackgroundColor + " !important;\n";
      generatedCss += "}\n";
    }
  }
  return generatedCss;
}
//Handles chat font override, returns CSS as a string
function generateFontCss() {
  generatedCss = "";
  if (GM_config.get("font") == "Open Sans Condensed") {
    generatedCss += "@import url(https://fonts.googleapis.com/css?family=Open+Sans+Condensed:300,300italic,700);\n";
    generatedCss += "html body {\n";
    generatedCss += "font-family: 'Open Sans Condensed', sans-serif !important;\n";
    generatedCss += "}\n";
  }
  return generatedCss;
}

function actionFunction() {
  //add keyboard command and element to hide chat
  $("body").keydown(e => {
    if ((e.key == "H" || e.key == "h") && e.shiftKey && e.ctrlKey) {
      e.preventDefault();
      $("#hide").toggle();
    }
  });
  $('<div id="hide" />')
    .html("Chat Hidden<br/><br/><br/>Ctrl-Shift-H to Show")
    .hide()
    .appendTo("body");
  // The node to be monitored
  var target = document.querySelector(MESSAGE_CONTAINER);

  // The div containing the scrollable area
  var chatContentDiv = target.parentNode.parentNode;
  // Create an observer instance
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      var newNodes = mutation.addedNodes; // DOM NodeList
      if (newNodes !== null) {
        // If there are new nodes added
        newNodes.forEach(function(newNode) {
          if (newNode.nodeType == Node.ELEMENT_NODE) {
            // Add the newly added node's height to the scroll distance and reset the reference distance
            newNode.dataset.height = newNode.scrollHeight;
            scrollReference = scrollDistance += newNode.scrollHeight;

            if (!(newNode.classList.contains("chat-line__message") || newNode.classList.contains("user-notice-line"))) {
              // Only treat chat messages
              return;
            }

            //add data-user=<username> for user-based highlighting
            newNode.dataset.user = newNode.querySelector(".chat-author__display-name").textContent;

            //add data-badges=<badges> for badge-based highlighting
            var badges = [];
            newNode.querySelectorAll("img.chat-badge").forEach(function(badge) {
              badges.push(badge.alt);
            });
            newNode.dataset.badges = badges.join(",");

            //add data-message=<message> for keyword-based highlighting
            var message = newNode.querySelector("span[data-a-target='chat-message-text']");
            if (message) {
              newNode.dataset.message = message.textContent
                .replace(/(\r|\s{2,})/gm, " ")
                .trim()
                .toLowerCase();
            } else if (newNode.querySelector(".chat-image")) {
              newNode.dataset.message = "Emote: " + newNode.querySelector(".chat-image").alt;
            }

            //add inline images
            if (inlineImages) {
              newNode.querySelectorAll(".chat-line__message a.link-fragment")
                .forEach(function(link) {
                  let imageLink = getImageLink(link.href);
                  if (imageLink) {
                    linkImage(link.parentNode, imageLink);
                    return;
                  }
                  let videoLink = getVideoLink(link.href);
                  if (videoLink) {
                    linkVideo(link.parentNode, videoLink);
                    return;
                  }
                  let giphyLink = getGiphyLink(link.href);
                  if (giphyLink) {
                    linkImage(link.parentNode, giphyLink);
                    return;
                  }
                  let thumbnailLink = getYouTubeLink(link.href);
                  if (thumbnailLink) {
                    linkImage(link.parentNode, thumbnailLink);
                    return;
                  }
                  let twitterID = getTweetID(link.href);
                  if (twitterID) {
                    linkTwitter(link.parentNode, twitterID);
                    return;
                  }
                }
              );
            }

            if (!newNode.previousElementSibling.classList.contains("odd")) {
              newNode.classList.add("odd");
            }
          }
        });
      }
    });
  });

  // Pass in the target node, as well as the observer options
  observer.observe(target, {childList: true});

  // Continually scroll up, in a way to make the comments readable
  var lastFrame = +new Date();
  function scrollUp(now) {
    if (GM_config.get("ReverseDirection")) {
      if (scrollDistance > 0 && GM_config.get("SmoothScroll")) {
        // estimate how far along we are in scrolling in the current scroll reference
        var currentStep = (parseFloat(GM_config.get("SmoothScrollSpeed")) * 1000) / (now - lastFrame);
        scrollDistance -= scrollReference / currentStep;
        scrollDistance = Math.max(Math.floor(scrollDistance), 0);
        chatContentDiv.scrollTop = scrollDistance;
      } else {
        chatContentDiv.scrollTop = 0;
      }
    }
    lastFrame = now;
    window.requestAnimationFrame(scrollUp);
  }
  window.requestAnimationFrame(scrollUp);
  chatContentDiv.scrollTop = 0;

  // Disable Twitch autoscroll with a little trick for performance reasons
  if (GM_config.get("ReverseDirection")) {
    setTimeout(function() {
      chatContentDiv.scrollBy(0, -200);
      chatContentDiv.dispatchEvent(new WheelEvent("wheel", {deltaY: -200}));
      chatContentDiv.scrollBy(0, 200);
    }, 5000);
  }
}

//inject custom stylessheet
var style = GM_getResourceText("style");
GM_addStyle(style);
var materialIcons = GM_getResourceText("material-icons");
GM_addStyle(materialIcons);

function getImageLink(url) {
  let match = /.*\.(?:jpg|jpeg|png|gif)(?:\?.*)?$/gim.exec(url);
  return ((match) ? match[0] : "").replace("media.giphy.com", "media1.giphy.com");
}

function getVideoLink(url) {
  let match = /.*\.(?:mp4)(?:\?.*)?$/gim.exec(url);
  return ((match) ? match[0] : "");
}

function getGiphyLink(url) {
  let match = /^https?:\/\/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/gm.exec(url);
  return ((match) ? "https://media1.giphy.com/media/" + match[1] + "/giphy.gif" : "");
}

function getYouTubeLink(url) {
  let match = /^https?:\/\/(?:www\.)?(?:youtu\.be\/|youtube\.com\/watch\?v=)([^&?]+).*$/gm.exec(url);
  return ((match) ? "https://img.youtube.com/vi/" + match[1] + "/mqdefault.jpg" : "");
}

function getTweetID(url) {
  let match = /^https?:\/\/(?:www\.)?twitter\.com.+\/([0-9]+)(?:\?.*)?$/gm.exec(url);
  return ((match) ? match[1] : "");
}

function linkImage(node, imageURL) {
  var image = document.createElement("img");
  node.appendChild(image);
  image.style.display = "none";
  image.src = imageURL;
  image.addEventListener("load",
    function() {
      image.style.display = "block";
      scrollReference = scrollDistance += image.scrollHeight;
    }
  );
}

function linkVideo(node, videoURL) {
  var video = document.createElement("video");
  node.appendChild(video);
  video.style.display = "none";
  video.src = videoURL;
  video.autoplay = video.loop = video.muted = true;
  function videoloadfunc() {
    video.style.display = "block";
    scrollReference = scrollDistance += video.scrollHeight;
    video.removeEventListener("canplay", videoloadfunc);
  }
  video.addEventListener("canplay", videoloadfunc);
}

function linkTwitter(node, tweetID) {
  twttr.widgets
    .createTweet(tweetID, node, {align: "center", cards: "hidden", conversation: "none", theme: "dark"})
    .catch(e => console.log(e));
    scrollReference = scrollDistance += node.scrollHeight;
}
