/* =========================================================
   FLICKORA YT - SUPABASE / RENDER FRONTEND
========================================================= */

const API_BASE = "";

let currentUser = null;
let currentProfile = null;
let currentChannel = null;
let currentVideo = null;
let currentVideos = [];
let currentVideoIndex = -1;


/* =========================================================
   AUTH STORAGE
========================================================= */

function getToken() {
  return localStorage.getItem("flickora_token") || "";
}

function saveSession(data) {

  if (data && data.session && data.session.access_token) {
    localStorage.setItem(
      "flickora_token",
      data.session.access_token
    );
  }

  if (data && data.user) {
    localStorage.setItem(
      "flickora_user",
      JSON.stringify(data.user)
    );
  }

  if (data && data.profile) {
    localStorage.setItem(
      "flickora_profile",
      JSON.stringify(data.profile)
    );
  }

  if (data && data.channel) {
    localStorage.setItem(
      "flickora_channel",
      JSON.stringify(data.channel)
    );
  }

  currentUser = data.user || null;
  currentProfile = data.profile || null;
  currentChannel = data.channel || null;
}


function clearSession() {

  localStorage.removeItem("flickora_token");
  localStorage.removeItem("flickora_user");
  localStorage.removeItem("flickora_profile");
  localStorage.removeItem("flickora_channel");

  currentUser = null;
  currentProfile = null;
  currentChannel = null;
}


function loadStoredSession() {

  try {

    currentUser =
      JSON.parse(
        localStorage.getItem("flickora_user") || "null"
      );

    currentProfile =
      JSON.parse(
        localStorage.getItem("flickora_profile") || "null"
      );

    currentChannel =
      JSON.parse(
        localStorage.getItem("flickora_channel") || "null"
      );

  }
  catch (error) {

    clearSession();

  }
}


/* =========================================================
   API HELPER
========================================================= */

async function apiFetch(url, options = {}) {

  const headers = {
    ...(options.headers || {})
  };

  const token = getToken();

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const response =
    await fetch(API_BASE + url, {
      ...options,
      headers
    });

  let data = null;

  try {
    data = await response.json();
  }
  catch (error) {
    data = {
      success: false,
      message: "Server returned an invalid response"
    };
  }

  if (!response.ok) {

    const message =
      data && data.message
        ? data.message
        : "Request failed";

    throw new Error(message);

  }

  return data;
}


/* =========================================================
   INITIAL LOAD
========================================================= */

document.addEventListener("DOMContentLoaded", async function () {

  loadStoredSession();

  createAccountButton();
  createAuthOverlay();

  updateAccountUI();

  await restoreAccount();

  await loadVideos();

});


/* =========================================================
   ACCOUNT
========================================================= */

async function restoreAccount() {

  const token = getToken();

  if (!token) {
    return;
  }

  try {

    const data =
      await apiFetch("/api/me");

    if (data.success) {

      currentUser = data.user || null;
      currentProfile = data.profile || null;
      currentChannel = data.channel || null;

      localStorage.setItem(
        "flickora_user",
        JSON.stringify(currentUser)
      );

      localStorage.setItem(
        "flickora_profile",
        JSON.stringify(currentProfile)
      );

      localStorage.setItem(
        "flickora_channel",
        JSON.stringify(currentChannel)
      );

    }

  }
  catch (error) {

    console.log("Session restore:", error.message);

    clearSession();

  }

  updateAccountUI();

}


/* =========================================================
   ACCOUNT BUTTON
========================================================= */

function createAccountButton() {

  const header = document.querySelector(".header");

  if (!header) return;

  if (document.getElementById("accountButton")) {
    return;
  }

  const button =
    document.createElement("button");

  button.id = "accountButton";
  button.className = "headerIcon";
  button.type = "button";

  button.innerHTML = `
    <span id="accountLetter"
      style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:32px;
        height:32px;
        border-radius:50%;
        background:#6d28d9;
        color:white;
        font-weight:700;
      ">F</span>
  `;

  button.addEventListener(
    "click",
    openAccount
  );

  header.appendChild(button);

}


function updateAccountUI() {

  const letter =
    document.getElementById("accountLetter");

  if (!letter) return;

  if (currentProfile && currentProfile.username) {

    letter.textContent =
      currentProfile.username
        .charAt(0)
        .toUpperCase();

  }
  else {

    letter.textContent = "F";

  }

  const bottomAvatar =
    document.getElementById("bottomAvatar");

  if (
    bottomAvatar &&
    currentProfile &&
    currentProfile.username
  ) {

    bottomAvatar.textContent =
      currentProfile.username
        .charAt(0)
        .toUpperCase();

  }

}


/* =========================================================
   AUTH OVERLAY
========================================================= */

function createAuthOverlay() {

  if (document.getElementById("authOverlay")) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.id = "authOverlay";

  overlay.style.cssText = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.72);
    display:none;
    align-items:center;
    justify-content:center;
    z-index:99999;
    padding:20px;
  `;

  overlay.innerHTML = `

    <div style="
      width:min(420px,100%);
      background:#111827;
      color:white;
      border-radius:18px;
      padding:24px;
      box-sizing:border-box;
      position:relative;
      box-shadow:0 20px 60px rgba(0,0,0,.5);
    ">

      <button
        id="authClose"
        type="button"
        style="
          position:absolute;
          right:14px;
          top:10px;
          background:none;
          border:0;
          color:white;
          font-size:30px;
          cursor:pointer;
        ">×</button>

      <h2 id="authTitle"
        style="margin:0 0 18px">
        Login to Flickora
      </h2>

      <input
        id="authUsername"
        placeholder="Username"
        style="
          display:none;
          width:100%;
          box-sizing:border-box;
          padding:13px;
          margin-bottom:12px;
          border-radius:10px;
          border:1px solid #374151;
          background:#1f2937;
          color:white;
        ">

      <input
        id="authEmail"
        type="email"
        placeholder="Email"
        style="
          width:100%;
          box-sizing:border-box;
          padding:13px;
          margin-bottom:12px;
          border-radius:10px;
          border:1px solid #374151;
          background:#1f2937;
          color:white;
        ">

      <input
        id="authPassword"
        type="password"
        placeholder="Password"
        style="
          width:100%;
          box-sizing:border-box;
          padding:13px;
          margin-bottom:12px;
          border-radius:10px;
          border:1px solid #374151;
          background:#1f2937;
          color:white;
        ">

      <button
        id="authSubmit"
        type="button"
        style="
          width:100%;
          padding:13px;
          border:0;
          border-radius:10px;
          background:#7c3aed;
          color:white;
          font-weight:700;
          cursor:pointer;
        ">
        Login
      </button>

      <p id="authStatus"
        style="
          min-height:20px;
          font-size:14px;
          margin:12px 0;
        "></p>

      <button
        id="authSwitch"
        type="button"
        style="
          width:100%;
          border:0;
          background:none;
          color:#a78bfa;
          cursor:pointer;
        ">
        Create new account
      </button>

    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById("authClose")
    .addEventListener(
      "click",
      closeAccount
    );

  document
    .getElementById("authSubmit")
    .addEventListener(
      "click",
      submitAuth
    );

  document
    .getElementById("authSwitch")
    .addEventListener(
      "click",
      switchAuthMode
    );

}


let authMode = "login";


function openAccount() {

  createAuthOverlay();

  if (currentUser) {

    showAccountMenu();

    return;

  }

  authMode = "login";

  updateAuthMode();

  document.getElementById("authOverlay")
    .style.display = "flex";

}


function closeAccount() {

  const overlay =
    document.getElementById("authOverlay");

  if (overlay) {
    overlay.style.display = "none";
  }

}


function switchAuthMode() {

  authMode =
    authMode === "login"
      ? "register"
      : "login";

  updateAuthMode();

}


function updateAuthMode() {

  const title =
    document.getElementById("authTitle");

  const username =
    document.getElementById("authUsername");

  const submit =
    document.getElementById("authSubmit");

  const switchButton =
    document.getElementById("authSwitch");

  if (!title) return;

  if (authMode === "register") {

    title.textContent =
      "Create your Flickora account";

    username.style.display = "block";

    submit.textContent =
      "Create Account";

    switchButton.textContent =
      "Already have an account? Login";

  }
  else {

    title.textContent =
      "Login to Flickora";

    username.style.display = "none";

    submit.textContent =
      "Login";

    switchButton.textContent =
      "Create new account";

  }

}


async function submitAuth() {

  const email =
    document.getElementById("authEmail")
      .value.trim();

  const password =
    document.getElementById("authPassword")
      .value;

  const username =
    document.getElementById("authUsername")
      .value.trim();

  const status =
    document.getElementById("authStatus");

  if (!email || !password) {

    status.textContent =
      "Email आणि password भरा.";

    return;

  }

  if (
    authMode === "register" &&
    username.length < 3
  ) {

    status.textContent =
      "Username किमान 3 characters असावा.";

    return;

  }

  status.textContent =
    "Please wait...";

  try {

    let data;

    if (authMode === "register") {

      data =
        await apiFetch(
          "/api/auth/register",
          {
            method:"POST",
            body:JSON.stringify({
              email,
              password,
              username
            })
          }
        );

    }
    else {

      data =
        await apiFetch(
          "/api/auth/login",
          {
            method:"POST",
            body:JSON.stringify({
              email,
              password
            })
          }
        );

    }

    if (!data.success) {
      throw new Error(
        data.message || "Authentication failed"
      );
    }

    saveSession(data);

    status.textContent =
      "✓ Success";

    updateAccountUI();

    await loadVideos();

    setTimeout(function(){

      closeAccount();

      if (currentChannel) {
        openChannel();
      }

    },500);

  }
  catch (error) {

    console.error(error);

    status.textContent =
      error.message || "Something went wrong.";

  }

}


/* =========================================================
   ACCOUNT MENU
========================================================= */

function showAccountMenu() {

  const old =
    document.getElementById("accountMenu");

  if (old) old.remove();

  const menu =
    document.createElement("div");

  menu.id = "accountMenu";

  menu.style.cssText = `
    position:fixed;
    right:12px;
    top:70px;
    width:260px;
    background:#111827;
    color:white;
    z-index:99998;
    border-radius:16px;
    padding:18px;
    box-shadow:0 15px 50px rgba(0,0,0,.45);
  `;

  const username =
    currentProfile?.username ||
    "Flickora User";

  const email =
    currentUser?.email ||
    "";

  menu.innerHTML = `
    <strong style="font-size:18px">
      ${escapeHTML(username)}
    </strong>

    <div style="
      color:#9ca3af;
      font-size:13px;
      margin:6px 0 18px;
      word-break:break-all;
    ">
      ${escapeHTML(email)}
    </div>

    <button id="myChannelButton"
      style="
        width:100%;
        padding:11px;
        margin-bottom:8px;
        border:0;
        border-radius:9px;
        background:#374151;
        color:white;
      ">
      My Channel
    </button>

    <button id="logoutButton"
      style="
        width:100%;
        padding:11px;
        border:0;
        border-radius:9px;
        background:#dc2626;
        color:white;
      ">
      Logout
    </button>
  `;

  document.body.appendChild(menu);

  document
    .getElementById("myChannelButton")
    .addEventListener(
      "click",
      function(){
        menu.remove();
        openChannel();
      }
    );

  document
    .getElementById("logoutButton")
    .addEventListener(
      "click",
      function(){

        clearSession();
        menu.remove();
        updateAccountUI();
        loadVideos();

      }
    );

}


/* =========================================================
   HOME
========================================================= */

function showHome() {

  const home =
    document.getElementById("homePage");

  const shorts =
    document.getElementById("shortsPage");

  if (home) {
    home.classList.add("active");
  }

  if (shorts) {
    shorts.classList.remove("active");
  }

  setActiveNav(0);

  window.scrollTo(0,0);

}


function showShorts() {

  const home =
    document.getElementById("homePage");

  const shorts =
    document.getElementById("shortsPage");

  if (home) {
    home.classList.remove("active");
  }

  if (shorts) {
    shorts.classList.add("active");
  }

  setActiveNav(1);

  window.scrollTo(0,0);

}


function showSubscriptions() {

  if (!currentUser) {

    openAccount();

    return;

  }

  alert(
    "Subscriptions page पुढच्या version मध्ये."
  );

}


function setActiveNav(index) {

  document
    .querySelectorAll(".navItem")
    .forEach(function(item,i){

      item.classList.toggle(
        "active",
        i === index
      );

    });

}


/* =========================================================
   UPLOAD
========================================================= */

function openUpload() {

  if (!currentUser || !getToken()) {

    openAccount();

    return;

  }

  const overlay =
    document.getElementById("uploadOverlay");

  if (overlay) {
    overlay.classList.add("show");
  }

}


function closeUpload() {

  const overlay =
    document.getElementById("uploadOverlay");

  if (overlay) {
    overlay.classList.remove("show");
  }

}


function chooseType(type) {

  if (type === "live") {

    alert(
      "Live feature पुढच्या version मध्ये जोडू."
    );

    return;

  }

  if (type === "post") {

    alert(
      "Post feature पुढच्या version मध्ये जोडू."
    );

    return;

  }

  const typeInput =
    document.getElementById("type");

  if (typeInput) {
    typeInput.value = type;
  }

  const form =
    document.getElementById("uploadForm");

  if (form) {
    form.classList.add("show");
  }

}


/* =========================================================
   UPLOAD TO SERVER
========================================================= */

const uploadForm =
  document.getElementById("uploadForm");

if (uploadForm) {

  uploadForm.addEventListener(
    "submit",
    async function(e){

      e.preventDefault();

      const status =
        document.getElementById("status");

      const title =
        document.getElementById("title")
          .value.trim();

      const description =
        document.getElementById("description")
          .value.trim();

      const hashtags =
        document.getElementById("hashtags")
          .value.trim();

      const type =
        document.getElementById("type")
          .value;

      const videoFile =
        document.getElementById("videoFile")
          .files[0];

      const thumbnailFile =
        document.getElementById("thumbnailFile")
          .files[0];

      if (!getToken()) {

        status.textContent =
          "पहिले Login कर.";

        return;

      }

      if (!title) {

        status.textContent =
          "Title टाक.";

        return;

      }

      if (!videoFile) {

        status.textContent =
          "Video select कर.";

        return;

      }

      if (!type) {

        status.textContent =
          "Video किंवा Short select कर.";

        return;

      }

      const formData =
        new FormData();

      formData.append(
        "title",
        title
      );

      formData.append(
        "description",
        description
      );

      formData.append(
        "hashtags",
        hashtags
      );

      formData.append(
        "type",
        type
      );

      formData.append(
        "video",
        videoFile
      );

      if (thumbnailFile) {

        formData.append(
          "thumbnail",
          thumbnailFile
        );

      }

      status.textContent =
        "Uploading to Flickora...";

      try {

        const data =
          await apiFetch(
            "/api/videos/upload",
            {
              method:"POST",
              body:formData
            }
          );

        if (!data.success) {
          throw new Error(
            data.message || "Upload failed"
          );
        }

        status.textContent =
          "✓ Video uploaded successfully";

        document
          .getElementById("uploadForm")
          .reset();

        document
          .getElementById("type")
          .value = "";

        await loadVideos();

        setTimeout(function(){

          closeUpload();

          const form =
            document.getElementById("uploadForm");

          if (form) {
            form.classList.remove("show");
          }

          if (type === "short") {
            showShorts();
          }
          else {
            showHome();
          }

        },700);

      }
      catch(error) {

        console.error(
          "UPLOAD ERROR:",
          error
        );

        status.textContent =
          "Upload failed: " +
          error.message;

      }

    }
  );

}


/* =========================================================
   LOAD VIDEOS FROM SERVER
========================================================= */

async function loadVideos() {

  try {

    const data =
      await apiFetch(
        "/api/videos"
      );

    if (!data.success) {
      throw new Error(
        data.message || "Could not load videos"
      );
    }

    currentVideos =
      Array.isArray(data.videos)
        ? data.videos
        : [];

    renderVideos(currentVideos);
    renderShorts(currentVideos);

    setTimeout(function(){

      openSharedVideoFromUrl();

    }, 300);

  }
  catch(error) {

    console.error(
      "LOAD VIDEOS:",
      error
    );

    renderVideos([]);
    renderShorts([]);

  }

}


/* =========================================================
   VIDEO THUMBNAIL
========================================================= */

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";

  seconds = Math.floor(seconds);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return hours + ":" +
      String(minutes).padStart(2, "0") + ":" +
      String(secs).padStart(2, "0");
  }

  return minutes + ":" +
    String(secs).padStart(2, "0");
}


function getThumbnail(video) {

  if (
    video &&
    video.thumbnail_url
  ) {
    return video.thumbnail_url;
  }

  return "";

}


/* =========================================================
   RENDER HOME
========================================================= */

function renderVideos(videos) {

  const list =
    document.getElementById("videoList");

  if (!list) return;

  list.innerHTML = "";

  const normal =
    videos.filter(function(video){

      return video.type !== "short";

    });

  if (!normal.length) {

    list.innerHTML = `
      <div class="empty">
        <h2>Welcome to Flickora</h2>
        <p>
          ${currentUser
            ? "Tap + to upload your first video."
            : "Login करून + वरून video upload करा."}
        </p>
      </div>
    `;

    return;

  }

  normal.forEach(function(video){

    list.appendChild(
      createVideoCard(video)
    );

  });

}


/* =========================================================
   RENDER SHORTS
========================================================= */

function renderShorts(videos) {

  const list =
    document.getElementById("shortList");

  if (!list) return;

  list.innerHTML = "";

  const shorts =
    videos.filter(function(video){

      return video.type === "short";

    });

  if (!shorts.length) {

    list.innerHTML = `
      <div class="empty">
        <h2>Shorts</h2>
        <p>
          ${currentUser
            ? "Tap + → Short to upload one."
            : "Login करून Short upload करा."}
        </p>
      </div>
    `;

    return;

  }

  shorts.forEach(function(video){

    list.appendChild(
      createVideoCard(
        video,
        true
      )
    );

  });

}


/* =========================================================
   VIDEO CARD
========================================================= */

function createVideoCard(video, isShort = false) {

  const card =
    document.createElement("article");

  card.className =
    isShort
      ? "videoCard shortCard"
      : "videoCard";

  const thumbnail =
    getThumbnail(video);

  const channel =
    video.channels || {};

  const channelName =
    channel.name ||
    "Flickora Creator";

  const views =
    formatViews(video.views || 0);

  const date =
    formatDate(video.created_at);

  if (thumbnail) {

    card.innerHTML = `
      <div class="thumbWrap" style="position:relative; aspect-ratio:16/9; overflow:hidden;">
        <img
          class="thumbnail"
          style="width:100%; height:100%; object-fit:cover; display:block;"
          src="${escapeAttr(thumbnail)}"
          alt="${escapeAttr(video.title || "Video")}"
          loading="lazy">

        <div class="playOverlay">▶</div>

        <div
          class="videoDuration"
          style="
            position:absolute;
            right:8px;
            bottom:8px;
            background:rgba(0,0,0,.85);
            color:white;
            padding:3px 6px;
            border-radius:4px;
            font-size:12px;
            font-weight:700;
            line-height:1.2;
            z-index:5;
            pointer-events:none;
          ">
        </div>
      </div>

      <div class="cardInfo">

        <div class="avatar">
          ${escapeHTML(
            channelName.charAt(0).toUpperCase()
          )}
        </div>

        <div class="cardText">

          <h3>
            ${escapeHTML(video.title || "Untitled")}
          </h3>

          <p>
            ${escapeHTML(channelName)}
          </p>

          <small>
            ${views} views • ${date}
          </small>

        </div>

      </div>
    `;

  }
  else {

    card.innerHTML = `
      <div class="thumbWrap"
        style="
          background:#111827;
          display:flex;
          align-items:center;
          justify-content:center;
          aspect-ratio:${isShort ? "9/16" : "16/9"};
        ">

        <span style="
          font-size:42px;
          color:#a78bfa;
        ">▶</span>

      </div>

      <div class="cardInfo">

        <div class="avatar">
          ${escapeHTML(
            channelName.charAt(0).toUpperCase()
          )}
        </div>

        <div class="cardText">

          <h3>
            ${escapeHTML(video.title || "Untitled")}
          </h3>

          <p>
            ${escapeHTML(channelName)}
          </p>

          <small>
            ${views} views • ${date}
          </small>

        </div>

      </div>
    `;

  }

  const durationBadge =
    card.querySelector(".videoDuration");

  if (durationBadge && video.video_url) {

    const durationVideo =
      document.createElement("video");

    durationVideo.preload = "metadata";
    durationVideo.src = video.video_url;

    durationVideo.addEventListener(
      "loadedmetadata",
      function() {
        durationBadge.textContent =
          formatDuration(durationVideo.duration);

        durationVideo.remove();
      },
      { once:true }
    );

    durationVideo.addEventListener(
      "error",
      function() {
        durationVideo.remove();
      },
      { once:true }
    );
  }


  card.addEventListener(
    "click",
    function(){

      openPlayer(video);

    }
  );

  return card;

}


/* =========================================================
   PLAYER
========================================================= */

function openPlayer(video) {

  if (!video || !video.video_url) {
    return;
  }

  currentVideo = video;

  currentVideoIndex =
    currentVideos.findIndex(function(item){

      return item.id === video.id;

    });

  const overlay =
    document.getElementById("playerOverlay");

  const player =
    document.getElementById("playerVideo");

  if (!overlay || !player) {
    return;
  }

  player.src =
    video.video_url;

  player.load();

  overlay.classList.add("show");

  updatePlayerInfo(video);

  updateRecommended(video);

  registerView(video);

  player.play()
    .catch(function(){});

  // Video सुरू झाल्यावर लगेच floating mini-player
}



async function shareCurrentVideo() {

  if (!currentVideo || !currentVideo.id) {
    alert("Video open नाही.");
    return;
  }

  const shareUrl =
    window.location.origin +
    "/watch/" +
    encodeURIComponent(currentVideo.id);

  const title =
    currentVideo.title ||
    "Flickora Video";

  const shareData = {
    title: title,
    text: "Watch this video on Flickora",
    url: shareUrl
  };

  try {

    if (navigator.share) {

      await navigator.share(shareData);

      return;
    }

    if (
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {

      await navigator.clipboard.writeText(
        shareUrl
      );

      alert("Video link copied!");

      return;
    }

    prompt(
      "Copy this video link:",
      shareUrl
    );

  }
  catch(error) {

    if (
      error &&
      error.name === "AbortError"
    ) {
      return;
    }

    try {

      if (
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {

        await navigator.clipboard.writeText(
          shareUrl
        );

        alert("Video link copied!");

      }

    }
    catch(copyError) {

      prompt(
        "Copy this video link:",
        shareUrl
      );

    }

  }

}


function openSharedVideoFromUrl() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  const videoId =
    params.get("v");

  if (!videoId || !currentVideos.length) {
    return;
  }

  const video =
    currentVideos.find(function(item){

      return String(item.id) ===
        String(videoId);

    });

  if (video) {

    openPlayer(video);

  }

}


function updatePlayerInfo(video) {

  const channel =
    video.channels || {};

  const channelName =
    channel.name ||
    "Flickora Creator";

  const title =
    document.getElementById("playerTitle");

  const meta =
    document.getElementById("playerMeta");

  const avatar =
    document.getElementById("playerAvatar");

  const channelElement =
    document.getElementById("playerChannelName");

  const subscribe =
    document.getElementById("subscribeButton");

  if (title) {

    title.textContent =
      video.title || "Video";

  }

  if (meta) {

    meta.textContent =
      channelName +
      " • " +
      formatViews(video.views || 0) +
      " views";

  }

  if (avatar) {

    avatar.textContent =
      channelName
        .charAt(0)
        .toUpperCase();

  }

  if (channelElement) {

    channelElement.textContent =
      channelName;

    channelElement.onclick =
      function(){
        openChannel(
          channel.id
        );
      };

  }

  if (subscribe) {

    subscribe.textContent =
      "Subscribe";

    subscribe.dataset.channelId =
      channel.id || "";

    loadSubscribeState(
      channel.id
    );

  }

}


async function registerView(video) {

  if (!video || !video.id) {
    return;
  }

  try {

    const data =
      await apiFetch(
        "/api/videos/" +
        encodeURIComponent(video.id) +
        "/view",
        {
          method:"POST"
        }
      );

    if (
      data &&
      data.success
    ) {

      video.views =
        data.views;

      updatePlayerInfo(video);

      const index =
        currentVideos.findIndex(function(item){

          return item.id === video.id;

        });

      if (index >= 0) {
        currentVideos[index].views =
          data.views;
      }

    }

  }
  catch(error) {

    console.log(
      "View update:",
      error.message
    );

  }

}


/* =========================================================
   RECOMMENDED
========================================================= */

function updateRecommended(video) {

  const list =
    document.getElementById(
      "recommendedList"
    );

  if (!list) return;

  list.innerHTML = "";

  currentVideos
    .filter(function(item){

      return (
        item.id !== video.id &&
        item.type === video.type
      );

    })
    .slice(0,10)
    .forEach(function(item){

      list.appendChild(
        createVideoCard(item)
      );

    });

}


/* =========================================================
   MINI PLAYER
========================================================= */

function minimizePlayer() {

  const overlay =
    document.getElementById(
      "playerOverlay"
    );

  if (!overlay) return;

  overlay.classList.add("miniMode");

}


function restorePlayer() {

  const overlay =
    document.getElementById(
      "playerOverlay"
    );

  if (!overlay) return;

  overlay.classList.remove("miniMode");

}


function closePlayer() {

  const overlay =
    document.getElementById(
      "playerOverlay"
    );

  const player =
    document.getElementById(
      "playerVideo"
    );

  if (player) {

    player.pause();

    player.removeAttribute("src");

    player.load();

  }

  if (overlay) {

    overlay.classList.remove("show");

  }

  currentVideo = null;

}


window.minimizePlayer =
  minimizePlayer;

window.restorePlayer =
  restorePlayer;

window.closePlayer =
  closePlayer;


/* =========================================================
   NEXT / PREVIOUS PLAYER
========================================================= */

function playNext() {

  if (!currentVideos.length) {
    return;
  }

  let next =
    currentVideoIndex + 1;

  if (next >= currentVideos.length) {
    next = 0;
  }

  openPlayer(
    currentVideos[next]
  );

}


function playPrevious() {

  if (!currentVideos.length) {
    return;
  }

  let previous =
    currentVideoIndex - 1;

  if (previous < 0) {
    previous =
      currentVideos.length - 1;
  }

  openPlayer(
    currentVideos[previous]
  );

}


/* =========================================================
   CHANNEL
========================================================= */

async function openChannel(channelId) {

  if (!currentUser) {

    openAccount();

    return;

  }

  if (!channelId) {

    if (currentChannel) {
      channelId =
        currentChannel.id;
    }

  }

  if (!channelId) {

    alert(
      "Channel अजून तयार झालेला नाही."
    );

    return;

  }

  try {

    const data =
      await apiFetch(
        "/api/channels/" +
        encodeURIComponent(channelId)
      );

    if (!data.success) {
      throw new Error(
        data.message || "Channel not found"
      );
    }

    showChannelOverlay(data);

  }
  catch(error) {

    alert(
      error.message
    );

  }

}


function showChannelOverlay(data) {

  const overlay =
    document.getElementById(
      "channelOverlay"
    );

  if (!overlay) return;

  const channel =
    data.channel;

  const videos =
    data.videos || [];

  const isMyChannel =
    currentUser &&
    currentChannel &&
    currentChannel.id === channel.id;

  overlay.innerHTML = `

    <div style="
      position:fixed;
      inset:0;
      z-index:9990;
      background:#fff;
      overflow:auto;
      padding-bottom:90px;
    ">

      <div style="
        padding:16px;
        display:flex;
        align-items:center;
        gap:12px;
        border-bottom:1px solid #ddd;
      ">

        <button
          id="closeChannelButton"
          type="button"
          style="
            border:0;
            background:none;
            font-size:28px;
          ">←</button>

        <strong>
          ${escapeHTML(channel.name)}
        </strong>

      </div>

      <div style="
        padding:25px 18px;
        text-align:center;
      ">

        <div style="
          width:70px;
          height:70px;
          border-radius:50%;
          overflow:hidden;
          background:#7c3aed;
          color:white;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:28px;
          font-weight:bold;
          margin:auto;
        ">
          ${
            channel.avatar_url
              ? `<img
                  src="${escapeAttr(channel.avatar_url)}"
                  alt="Channel"
                  style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                    display:block;
                  ">`
              : escapeHTML(
                  channel.name
                    .charAt(0)
                    .toUpperCase()
                )
          }
        </div>

        <h2>
          ${escapeHTML(channel.name)}
        </h2>

        <p>
          ${escapeHTML(
            channel.description || ""
          )}
        </p>

        <strong>
          ${formatViews(
            channel.subscribers_count || 0
          )}
          subscribers
        </strong>

        ${
          isMyChannel
            ? `<p style="
                color:#6b7280;
                margin-top:10px;
              ">
                Your channel
              </p>`
            : `
              <button
                id="channelSubscribeButton"
                type="button"
                style="
                  margin-top:15px;
                  padding:11px 22px;
                  border:0;
                  border-radius:20px;
                  background:#111827;
                  color:white;
                ">
                ${
                  data.subscribed
                    ? "Subscribed"
                    : "Subscribe"
                }
              </button>
            `
        }

      </div>

      <div id="channelVideoList"
        style="padding:0 15px">
      </div>

    </div>
  `;

  overlay.style.display = "block";

  document
    .getElementById("closeChannelButton")
    .addEventListener(
      "click",
      closeChannel
    );

  const subscribe =
    document.getElementById(
      "channelSubscribeButton"
    );

  if (subscribe) {

    subscribe.addEventListener(
      "click",
      async function(){

        const result =
          await toggleChannelSubscription(
            channel.id,
            data.subscribed
          );

        if (result) {

          data.subscribed =
            result.subscribed;

          subscribe.textContent =
            result.subscribed
              ? "Subscribed"
              : "Subscribe";

        }

      }
    );

  }

  const videoList =
    document.getElementById(
      "channelVideoList"
    );

  videos.forEach(function(video){

    videoList.appendChild(
      createChannelVideoCard(
        video,
        isMyChannel
      )
    );

  });

}


/* =========================================================
   MY CHANNEL VIDEO CARD + 3 DOT MENU
========================================================= */

function createChannelVideoCard(
  video,
  isMyChannel
) {

  const card =
    document.createElement("div");

  card.style.cssText = `
    position:relative;
    margin-bottom:18px;
    background:#fff;
    border-radius:12px;
    overflow:hidden;
    border:1px solid #e5e7eb;
  `;

  const thumbnail =
    getThumbnail(video);

  card.innerHTML = `

    <div style="
      position:relative;
      aspect-ratio:16/9;
      background:#111827;
      overflow:hidden;
    ">

      ${
        thumbnail
          ? `<img
              src="${escapeAttr(thumbnail)}"
              alt="${escapeAttr(video.title || "Video")}"
              style="
                width:100%;
                height:100%;
                object-fit:cover;
                display:block;
              ">`
          : `<div style="
              width:100%;
              height:100%;
              display:flex;
              align-items:center;
              justify-content:center;
              color:#a78bfa;
              font-size:42px;
            ">▶</div>`
      }

      <button
        class="channelPlayButton"
        type="button"
        style="
          position:absolute;
          inset:0;
          border:0;
          background:transparent;
          cursor:pointer;
        "
        aria-label="Play video">
      </button>

      ${
        isMyChannel
          ? `<button
              class="channelVideoMenuButton"
              type="button"
              aria-label="Video options"
              style="
                position:absolute;
                right:8px;
                top:8px;
                width:42px;
                height:42px;
                border:0;
                border-radius:50%;
                background:rgba(0,0,0,.72);
                color:#fff;
                font-size:25px;
                z-index:10;
              ">⋮</button>`
          : ""
      }

    </div>

    <div style="
      padding:12px 14px 15px;
    ">

      <div style="
        font-weight:700;
        font-size:16px;
        line-height:1.35;
        padding-right:35px;
      ">
        ${escapeHTML(video.title || "Untitled")}
      </div>

      <small style="
        color:#6b7280;
        display:block;
        margin-top:6px;
      ">
        ${formatViews(video.views || 0)}
        views •
        ${formatDate(video.created_at)}
      </small>

    </div>
  `;

  const playButton =
    card.querySelector(
      ".channelPlayButton"
    );

  if (playButton) {

    playButton.addEventListener(
      "click",
      function(){

        openPlayer(video);

      }
    );

  }

  const menuButton =
    card.querySelector(
      ".channelVideoMenuButton"
    );

  if (menuButton) {

    menuButton.addEventListener(
      "click",
      function(e){

        e.stopPropagation();

        openMyVideoMenu(
          video,
          menuButton
        );

      }
    );

  }

  return card;
}


/* =========================================================
   MY VIDEO 3 DOT MENU
========================================================= */

function openMyVideoMenu(
  video,
  anchor
) {

  const old =
    document.getElementById(
      "myVideoMenu"
    );

  if (old) {
    old.remove();
  }

  const menu =
    document.createElement("div");

  menu.id =
    "myVideoMenu";

  menu.style.cssText = `
    position:fixed;
    right:18px;
    top:120px;
    width:210px;
    background:#111827;
    color:#fff;
    border-radius:14px;
    padding:7px;
    z-index:99999;
    box-shadow:0 15px 45px rgba(0,0,0,.4);
  `;

  menu.innerHTML = `

    <button
      type="button"
      data-action="edit"
      style="
        width:100%;
        padding:13px;
        border:0;
        background:none;
        color:#fff;
        text-align:left;
        border-radius:9px;
      ">
      ✏️ Edit title
    </button>

    <button
      type="button"
      data-action="thumbnail"
      style="
        width:100%;
        padding:13px;
        border:0;
        background:none;
        color:#fff;
        text-align:left;
        border-radius:9px;
      ">
      🖼️ Change thumbnail
    </button>

    <button
      type="button"
      data-action="share"
      style="
        width:100%;
        padding:13px;
        border:0;
        background:none;
        color:#fff;
        text-align:left;
        border-radius:9px;
      ">
      ↗️ Share
    </button>

    <button
      type="button"
      data-action="delete"
      style="
        width:100%;
        padding:13px;
        border:0;
        background:none;
        color:#f87171;
        text-align:left;
        border-radius:9px;
      ">
      🗑️ Delete video
    </button>

  `;

  document.body.appendChild(menu);

  const rect =
    anchor.getBoundingClientRect();

  menu.style.top =
    Math.min(
      window.innerHeight - 230,
      rect.bottom + 6
    ) + "px";

  menu.style.right =
    Math.max(
      8,
      window.innerWidth - rect.right
    ) + "px";

  menu
    .querySelectorAll("button")
    .forEach(function(button){

      button.addEventListener(
        "click",
        async function(){

          const action =
            button.dataset.action;

          menu.remove();

          if (action === "edit") {
            await editMyVideoTitle(video);
          }

          if (action === "thumbnail") {
            changeMyVideoThumbnail(video);
          }

          if (action === "share") {
            shareVideo(video);
          }

          if (action === "delete") {
            await deleteMyVideo(video);
          }

        }
      );

    });

}


/* =========================================================
   EDIT TITLE
========================================================= */

async function editMyVideoTitle(video) {

  const newTitle =
    prompt(
      "Video title change करा:",
      video.title || ""
    );

  if (newTitle === null) {
    return;
  }

  const title =
    newTitle.trim();

  if (!title) {
    alert("Title रिकामा ठेवता येणार नाही.");
    return;
  }

  try {

    const data =
      await apiFetch(
        "/api/videos/" +
        encodeURIComponent(video.id),
        {
          method:"PUT",
          body:JSON.stringify({
            title:title
          })
        }
      );

    if (!data.success) {
      throw new Error(
        data.message || "Edit failed"
      );
    }

    await loadVideos();

    if (currentChannel) {
      openChannel(currentChannel.id);
    }

    alert("✓ Title updated");

  }
  catch(error) {

    alert(
      "Title update failed: " +
      error.message
    );

  }

}


/* =========================================================
   CHANGE THUMBNAIL
========================================================= */

function changeMyVideoThumbnail(video) {

  const input =
    document.createElement("input");

  input.type = "file";
  input.accept = "image/*";

  input.addEventListener(
    "change",
    async function(){

      const file =
        input.files &&
        input.files[0];

      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        alert("फक्त image select करा.");
        return;
      }

      const formData =
        new FormData();

      formData.append(
        "thumbnail",
        file
      );

      try {

        const data =
          await apiFetch(
            "/api/videos/" +
            encodeURIComponent(video.id) +
            "/thumbnail",
            {
              method:"POST",
              body:formData
            }
          );

        if (!data.success) {
          throw new Error(
            data.message || "Thumbnail update failed"
          );
        }

        await loadVideos();

        if (currentChannel) {
          openChannel(currentChannel.id);
        }

        alert("✓ Thumbnail changed");

      }
      catch(error) {

        alert(
          "Thumbnail change failed: " +
          error.message
        );

      }

    }
  );

  input.click();

}


/* =========================================================
   SHARE MY VIDEO
========================================================= */

async function shareVideo(video) {

  if (!video || !video.id) {
    return;
  }

  const shareUrl =
    window.location.origin +
    "/watch/" +
    encodeURIComponent(video.id);

  const shareData = {
    title:
      video.title ||
      "Flickora Video",
    text:
      "Watch this video on Flickora",
    url:shareUrl
  };

  try {

    if (navigator.share) {

      await navigator.share(
        shareData
      );

      return;

    }

    if (
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {

      await navigator.clipboard.writeText(
        shareUrl
      );

      alert("✓ Video link copied");

      return;

    }

    prompt(
      "Copy video link:",
      shareUrl
    );

  }
  catch(error) {

    if (
      error &&
      error.name === "AbortError"
    ) {
      return;
    }

  }

}


/* =========================================================
   DELETE MY VIDEO
========================================================= */

async function deleteMyVideo(video) {

  const ok =
    confirm(
      'Delete "' +
      (video.title || "this video") +
      '"?'
    );

  if (!ok) {
    return;
  }

  try {

    const data =
      await apiFetch(
        "/api/videos/" +
        encodeURIComponent(video.id),
        {
          method:"DELETE"
        }
      );

    if (!data.success) {
      throw new Error(
        data.message || "Delete failed"
      );
    }

    if (
      currentVideo &&
      currentVideo.id === video.id
    ) {
      closePlayer();
    }

    await loadVideos();

    if (currentChannel) {
      openChannel(currentChannel.id);
    }

    alert("✓ Video deleted");

  }
  catch(error) {

    alert(
      "Delete failed: " +
      error.message
    );

  }

}


function closeChannel() {

  const overlay =
    document.getElementById(
      "channelOverlay"
    );

  if (overlay) {

    overlay.innerHTML = "";

    overlay.style.display =
      "none";

  }

}


/* =========================================================
   SUBSCRIBE
========================================================= */

async function loadSubscribeState(channelId) {

  if (!channelId) {
    return;
  }

  const button =
    document.getElementById(
      "subscribeButton"
    );

  if (!button) return;

  if (!currentUser) {

    button.textContent =
      "Subscribe";

    return;

  }

  try {

    const data =
      await apiFetch(
        "/api/channels/" +
        encodeURIComponent(channelId)
      );

    button.textContent =
      data.subscribed
        ? "Subscribed"
        : "Subscribe";

  }
  catch(error) {

    console.log(
      "Subscribe state:",
      error.message
    );

  }

}


async function toggleSubscribe() {

  const button =
    document.getElementById(
      "subscribeButton"
    );

  if (!button) return;

  const channelId =
    button.dataset.channelId;

  if (!channelId) return;

  if (!currentUser) {

    openAccount();

    return;

  }

  const subscribed =
    button.textContent ===
    "Subscribed";

  const result =
    await toggleChannelSubscription(
      channelId,
      subscribed
    );

  if (result) {

    button.textContent =
      result.subscribed
        ? "Subscribed"
        : "Subscribe";

  }

}


async function toggleChannelSubscription(
  channelId,
  subscribed
) {

  try {

    const method =
      subscribed
        ? "DELETE"
        : "POST";

    const data =
      await apiFetch(
        "/api/channels/" +
        encodeURIComponent(channelId) +
        "/subscribe",
        {
          method
        }
      );

    return data;

  }
  catch(error) {

    alert(
      error.message
    );

    return null;

  }

}


/* =========================================================
   UTILITIES
========================================================= */

function formatViews(number) {

  number =
    Number(number || 0);

  if (number >= 1000000) {

    return (
      (number / 1000000)
        .toFixed(1)
        .replace(".0","") +
      "M"
    );

  }

  if (number >= 1000) {

    return (
      (number / 1000)
        .toFixed(1)
        .replace(".0","") +
      "K"
    );

  }

  return String(number);

}


function formatDate(value) {

  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now =
    Date.now();

  const diff =
    Math.max(
      0,
      now - date.getTime()
    );

  const minutes =
    Math.floor(
      diff / 60000
    );

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return minutes + "m ago";
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return hours + "h ago";
  }

  const days =
    Math.floor(
      hours / 24
    );

  if (days < 30) {
    return days + "d ago";
  }

  return date.toLocaleDateString();

}


function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

}


function escapeAttr(value) {

  return escapeHTML(value);

}



const shareButton =
  document.getElementById(
    "shareVideoButton"
  );

if (shareButton) {

  shareButton.addEventListener(
    "click",
    shareCurrentVideo
  );

}


/* =========================================================
   GLOBAL FUNCTIONS FOR HTML onclick
========================================================= */

window.showHome =
  showHome;

window.showShorts =
  showShorts;

window.showSubscriptions =
  showSubscriptions;

window.openUpload =
  openUpload;

window.closeUpload =
  closeUpload;

window.chooseType =
  chooseType;

window.openChannel =
  openChannel;

window.closeChannel =
  closeChannel;

window.toggleSubscribe =
  toggleSubscribe;


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
  "keydown",
  function(e){

    if (e.key === "Escape") {

      closeUpload();
      closeChannel();

      const auth =
        document.getElementById(
          "authOverlay"
        );

      if (auth) {
        auth.style.display =
          "none";
      }

    }

  }
);
