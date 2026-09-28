let db = null;

const request = indexedDB.open("FlickoraDB", 1);

request.onupgradeneeded = function(e){

  db = e.target.result;

  if(!db.objectStoreNames.contains("videos")){

    db.createObjectStore("videos",{
      keyPath:"id",
      autoIncrement:true
    });

  }

};

request.onsuccess = function(e){

  db = e.target.result;

  loadVideos();

};

request.onerror = function(e){

  console.error("Database error:",e);

};


/* =====================================================
   DATABASE
===================================================== */

function saveVideo(data){

  return new Promise(function(resolve,reject){

    const tx = db.transaction("videos","readwrite");
    const store = tx.objectStore("videos");

    store.add(data);

    tx.oncomplete = function(){
      resolve();
    };

    tx.onerror = function(){
      reject(tx.error);
    };

  });

}


function updateVideo(data){

  return new Promise(function(resolve,reject){

    if(!db){
      reject(new Error("Database not ready"));
      return;
    }

    const tx = db.transaction("videos","readwrite");
    const store = tx.objectStore("videos");

    const req = store.put(data);

    req.onsuccess = function(){
      resolve();
    };

    req.onerror = function(){
      reject(req.error);
    };

  });

}


function getVideos(){

  return new Promise(function(resolve,reject){

    const tx = db.transaction("videos","readonly");
    const store = tx.objectStore("videos");
    const req = store.getAll();

    req.onsuccess = function(){
      resolve(req.result);
    };

    req.onerror = function(){
      reject(req.error);
    };

  });

}


async function loadVideos(){

  if(!db) return;

  try{

    const videos = await getVideos();

    renderVideos(videos);
    renderShorts(videos);

  }
  catch(error){

    console.error(error);

  }

}


/* =====================================================
   HOME
===================================================== */

function showHome(){

  document.getElementById("homePage")
    .classList.add("active");

  document.getElementById("shortsPage")
    .classList.remove("active");

  setActiveNav(0);

  window.scrollTo(0,0);

}


/* =====================================================
   SHORTS
===================================================== */

function showShorts(){

  document.getElementById("homePage")
    .classList.remove("active");

  document.getElementById("shortsPage")
    .classList.add("active");

  setActiveNav(1);

  window.scrollTo(0,0);

}


/* =====================================================
   NAV
===================================================== */

function setActiveNav(index){

  document.querySelectorAll(".navItem")
    .forEach(function(item,i){

      item.classList.toggle(
        "active",
        i === index
      );

    });

}


/* =====================================================
   UPLOAD
===================================================== */

function openUpload(){

  document.getElementById("uploadOverlay")
    .classList.add("show");

}


function closeUpload(){

  document.getElementById("uploadOverlay")
    .classList.remove("show");

}


function chooseType(type){

  if(type === "live"){

    alert("Live feature पुढच्या version मध्ये जोडू.");

    return;

  }

  if(type === "post"){

    alert("Post feature पुढच्या version मध्ये जोडू.");

    return;

  }

  document.getElementById("type").value = type;

  document.getElementById("uploadForm")
    .classList.add("show");

}


/* =====================================================
   UPLOAD FORM
===================================================== */

document.getElementById("uploadForm")
.addEventListener("submit",async function(e){

  e.preventDefault();

  const title =
    document.getElementById("title").value.trim();

  const description =
    document.getElementById("description").value.trim();

  const hashtags =
    document.getElementById("hashtags").value.trim();

  const type =
    document.getElementById("type").value;

  const videoFile =
    document.getElementById("videoFile").files[0];

  const thumbnailFile =
    document.getElementById("thumbnailFile").files[0];

  const status =
    document.getElementById("status");


  if(!videoFile){

    status.textContent = "Video select कर.";

    return;

  }


  if(!type){

    status.textContent =
      "Video किंवा Short select कर.";

    return;

  }


  const channel = getChannel();


  status.textContent = "Uploading...";


  try{

    await saveVideo({

      title:title,

      description:description,

      hashtags:hashtags,

      type:type,

      videoBlob:videoFile,

      thumbnailBlob:
        thumbnailFile || null,

      createdAt:Date.now(),

      views:0,

      channelName:
        channel
          ? channel.name
          : "Flickora Creator",

      channelUsername:
        channel
          ? channel.username
          : "@FlickoraCreator",

      channelPhoto:
        channel
          ? channel.photo
          : ""

    });


    status.textContent =
      "✓ Uploaded successfully";


    document.getElementById("uploadForm")
      .reset();


    setTimeout(async function(){

      closeUpload();

      document.getElementById("uploadForm")
        .classList.remove("show");

      await loadVideos();

      if(type === "short"){
        showShorts();
      }
      else{
        showHome();
      }

    },700);

  }
  catch(error){

    console.error(error);

    status.textContent =
      "Upload failed.";

  }

});


/* =====================================================
   HOME VIDEOS
===================================================== */

function renderVideos(videos){

  const list =
    document.getElementById("videoList");

  list.innerHTML = "";


  const normal =
    videos.filter(function(v){

      return v.type !== "short";

    });


  if(normal.length === 0){

    list.innerHTML = `
      <div class="empty">
        <h2>Welcome to Flickora</h2>
        <p>Tap + to upload your first video.</p>
      </div>
    `;

    return;

  }


  normal.slice().reverse().forEach(function(video){

    const card =
      document.createElement("div");

    card.className = "videoCard";


    let thumb = "";

    if(video.thumbnailBlob){

      thumb =
        URL.createObjectURL(
          video.thumbnailBlob
        );

    }


    const channelName =
      video.channelName ||
      "Flickora Creator";


    const channelPhoto =
      video.channelPhoto || "";


    card.innerHTML = `

      ${
        thumb
        ?
        `<img class="thumb" src="${thumb}">`
        :
        `
        <div class="thumb"
          style="
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:45px;
          ">
          ▶
        </div>
        `
      }


      <div class="videoInfo">

        <div class="avatar">

          ${
            channelPhoto
            ?
            `<img src="${channelPhoto}">`
            :
            escapeHTML(
              channelName.charAt(0).toUpperCase()
            )
          }

        </div>


        <div class="videoText">

          <div class="videoTitle">
            ${escapeHTML(video.title)}
          </div>

          <div class="meta">

            ${escapeHTML(channelName)}
            •
            ${video.views || 0}
            views •
            ${timeAgo(video.createdAt)}

          </div>

        </div>


        <button class="moreBtn">
          ⋮
        </button>

      </div>
    `;


    card.addEventListener("click",function(){

      playVideo(video);

    });


    list.appendChild(card);

  });

}


/* =====================================================
   SHORTS
===================================================== */

function renderShorts(videos){

  const list =
    document.getElementById("shortList");

  list.innerHTML = "";


  const shorts =
    videos.filter(function(v){

      return v.type === "short";

    });


  if(shorts.length === 0){

    list.innerHTML = `
      <div class="empty" style="color:white">
        <h2>No Shorts yet</h2>
        <p>Tap + → Short to upload one.</p>
      </div>
    `;

    return;

  }


  shorts.slice().reverse().forEach(function(video){

    const url =
      URL.createObjectURL(video.videoBlob);


    const card =
      document.createElement("div");

    card.className = "shortCard";


    card.innerHTML = `

      <video
        class="shortVideo"
        src="${url}"
        playsinline
        loop
        controls>
      </video>


      <div class="shortInfo">

        <div class="shortTitle">
          ${escapeHTML(video.title)}
        </div>

        <div class="shortChannel">
          ${escapeHTML(
            video.channelName ||
            "Flickora Creator"
          )}
        </div>

      </div>


      <div class="shortActions">

        <button class="shortAction">
          👍
          <span>Like</span>
        </button>

        <button class="shortAction">
          ↗
          <span>Share</span>
        </button>

        <button class="shortAction">
          🔖
          <span>Save</span>
        </button>

      </div>

    `;


    list.appendChild(card);

  });

}


/* =====================================================
   PLAY VIDEO + VIEW COUNT
===================================================== */

function playVideo(video){

  const player =
    document.getElementById("playerVideo");

  const overlay =
    document.getElementById("playerOverlay");


  if(player.dataset.objectUrl){

    try{
      URL.revokeObjectURL(
        player.dataset.objectUrl
      );
    }
    catch(e){}

  }


  /* VIEW +1 */

  video.views =
    Number(video.views || 0) + 1;


  updateVideo(video)
    .then(function(){

      loadVideos();

    })
    .catch(function(error){

      console.error(
        "View update error:",
        error
      );

    });


  const url =
    URL.createObjectURL(
      video.videoBlob
    );


  player.src = url;

  player.dataset.objectUrl = url;


  document.getElementById("playerTitle")
    .textContent = video.title;


  document.getElementById("playerMeta")
    .textContent =
      (
        video.channelName ||
        "Flickora Creator"
      )
      +
      " • " +
      video.views +
      " views • " +
      timeAgo(video.createdAt);


  document.getElementById("playerChannelName")
    .textContent =
      video.channelName ||
      "Flickora Creator";


  const avatar =
    document.getElementById("playerAvatar");


  if(video.channelPhoto){

    avatar.innerHTML =
      `<img src="${video.channelPhoto}">`;

  }
  else{

    avatar.textContent =
      (
        video.channelName ||
        "F"
      )
      .charAt(0)
      .toUpperCase();

  }


  loadSubscription();


  overlay.classList.remove(
    "miniMode"
  );

  overlay.classList.add(
    "show"
  );


  renderRecommended(video);


  overlay.scrollTop = 0;


  player.play().catch(function(){});

}


/* =====================================================
   MINI PLAYER
===================================================== */

function minimizePlayer(){

  const overlay =
    document.getElementById(
      "playerOverlay"
    );

  const player =
    document.getElementById(
      "playerVideo"
    );


  overlay.classList.add(
    "miniMode"
  );

  overlay.classList.add(
    "show"
  );


  player.play().catch(function(){});

}


function restorePlayer(){

  const overlay =
    document.getElementById(
      "playerOverlay"
    );


  overlay.classList.remove(
    "miniMode"
  );

  overlay.classList.add(
    "show"
  );

  overlay.scrollTop = 0;

}


function closePlayer(){

  const player =
    document.getElementById(
      "playerVideo"
    );


  player.pause();


  if(player.dataset.objectUrl){

    try{

      URL.revokeObjectURL(
        player.dataset.objectUrl
      );

    }
    catch(e){}

  }


  player.src = "";

  player.dataset.objectUrl = "";


  document.getElementById(
    "playerOverlay"
  ).classList.remove(
    "show",
    "miniMode"
  );

}


/* =====================================================
   SUBSCRIBE
===================================================== */

function toggleSubscribe(){

  const button =
    document.getElementById(
      "subscribeButton"
    );


  if(!button) return;


  const subscribed =
    localStorage.getItem(
      "flickoraSubscribed"
    ) === "true";


  if(subscribed){

    localStorage.setItem(
      "flickoraSubscribed",
      "false"
    );

    button.textContent =
      "Subscribe";

    button.classList.remove(
      "subscribed"
    );

  }
  else{

    localStorage.setItem(
      "flickoraSubscribed",
      "true"
    );

    button.textContent =
      "Subscribed";

    button.classList.add(
      "subscribed"
    );

  }

}


function loadSubscription(){

  const button =
    document.getElementById(
      "subscribeButton"
    );


  if(!button) return;


  const subscribed =
    localStorage.getItem(
      "flickoraSubscribed"
    ) === "true";


  button.textContent =
    subscribed
    ? "Subscribed"
    : "Subscribe";


  button.classList.toggle(
    "subscribed",
    subscribed
  );

}


/* =====================================================
   RECOMMENDED
===================================================== */

async function renderRecommended(currentVideo){

  const box =
    document.getElementById(
      "recommendedList"
    );


  if(!box) return;


  box.innerHTML = "";


  const videos =
    await getVideos();


  const recommended =
    videos
      .filter(function(v){

        return v.id !== currentVideo.id;

      })
      .sort(function(a,b){

        return b.createdAt - a.createdAt;

      })
      .slice(0,10);


  if(recommended.length === 0){

    box.innerHTML = `
      <div class="empty">
        No more videos yet.
      </div>
    `;

    return;

  }


  recommended.forEach(function(video){

    const card =
      document.createElement("div");

    card.className =
      "recommendedCard";


    let thumb = "";

    if(video.thumbnailBlob){

      thumb =
        URL.createObjectURL(
          video.thumbnailBlob
        );

    }


    card.innerHTML = `

      ${
        thumb
        ?
        `<img
          class="recommendedThumb"
          src="${thumb}">`
        :
        `
        <div
          class="recommendedThumb"
          style="
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:45px;
          ">
          ▶
        </div>
        `
      }


      <div class="recommendedText">

        <div class="recommendedTitle">
          ${escapeHTML(video.title)}
        </div>

        <div class="recommendedMeta">

          ${escapeHTML(
            video.channelName ||
            "Flickora Creator"
          )}

          <br>

          ${video.views || 0}
          views •
          ${timeAgo(video.createdAt)}

        </div>

        <button
          class="recommendedMore"
          onclick="event.stopPropagation()">
          ⋮
        </button>

      </div>
    `;


    card.addEventListener(
      "click",
      function(){

        playVideo(video);

      }
    );


    box.appendChild(card);

  });

}


/* =====================================================
   CHANNEL SYSTEM
===================================================== */

function getChannel(){

  try{

    return JSON.parse(
      localStorage.getItem(
        "flickoraChannel"
      )
    ) || null;

  }
  catch(e){

    return null;

  }

}


function saveChannel(channel){

  localStorage.setItem(
    "flickoraChannel",
    JSON.stringify(channel)
  );

}


function openChannel(){

  const channel =
    getChannel();


  if(!channel){

    showCreateChannel();

  }
  else{

    showChannelPage(channel);

  }

}


function closeChannel(){

  document.getElementById(
    "channelOverlay"
  ).classList.remove(
    "show"
  );

}


function showCreateChannel(){

  const overlay =
    document.getElementById(
      "channelOverlay"
    );


  overlay.innerHTML = `

    <div class="channelTop">

      <button onclick="closeChannel()">
        ×
      </button>

      <b>Create Channel</b>

    </div>


    <div class="channelForm">

      <h2>Create your Flickora Channel</h2>

      <p>
        तुमचा स्वतःचा Flickora channel तयार करा.
      </p>


      <input
        id="channelNameInput"
        class="channelInput"
        placeholder="Channel name"
        maxlength="50">


      <input
        id="channelUsernameInput"
        class="channelInput"
        placeholder="@username"
        maxlength="30">


      <textarea
        id="channelDescriptionInput"
        class="channelInput"
        placeholder="Channel description"
        maxlength="300"></textarea>


      <input
        id="channelPhotoInput"
        class="channelInput"
        type="file"
        accept="image/*">


      <button
        class="channelSubmit"
        onclick="createChannel()">

        Create Channel

      </button>


      <button
        class="channelCancel"
        onclick="closeChannel()">

        Cancel

      </button>


      <p
        id="channelStatus"
        style="text-align:center;margin-top:12px">
      </p>

    </div>

  `;


  overlay.classList.add(
    "show"
  );

}


function createChannel(){

  const name =
    document.getElementById(
      "channelNameInput"
    ).value.trim();


  let username =
    document.getElementById(
      "channelUsernameInput"
    ).value.trim();


  const description =
    document.getElementById(
      "channelDescriptionInput"
    ).value.trim();


  const photoInput =
    document.getElementById(
      "channelPhotoInput"
    );


  const status =
    document.getElementById(
      "channelStatus"
    );


  if(!name){

    status.textContent =
      "Channel name टाका.";

    return;

  }


  if(!username){

    username =
      name
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          ""
        );

    username =
      "@" + username;

  }


  if(username.charAt(0) !== "@"){

    username =
      "@" + username;

  }


  const file =
    photoInput.files[0];


  if(file){

    const reader =
      new FileReader();


    reader.onload =
      function(){

        finishCreateChannel(
          name,
          username,
          description,
          reader.result
        );

      };


    reader.readAsDataURL(file);

  }
  else{

    finishCreateChannel(
      name,
      username,
      description,
      ""
    );

  }

}


function finishCreateChannel(
  name,
  username,
  description,
  photo
){

  const channel = {

    name:name,

    username:username,

    description:description,

    photo:photo,

    subscribers:0,

    createdAt:Date.now()

  };


  saveChannel(channel);


  updateBottomAvatar();


  showChannelPage(channel);

}


/* =====================================================
   CHANNEL PAGE
===================================================== */

async function showChannelPage(channel){

  const overlay =
    document.getElementById(
      "channelOverlay"
    );


  overlay.innerHTML = `

    <div class="channelTop">

      <button onclick="closeChannel()">
        ←
      </button>

      <b>${escapeHTML(channel.name)}</b>

    </div>


    <div class="channelBanner"></div>


    <div class="channelProfile">

      <div class="channelBigAvatar">

        ${
          channel.photo
          ?
          `<img src="${channel.photo}">`
          :
          escapeHTML(
            channel.name
              .charAt(0)
              .toUpperCase()
          )
        }

      </div>


      <div class="channelBigName">

        ${escapeHTML(channel.name)}

      </div>


      <div class="channelHandle">

        ${escapeHTML(channel.username)}

      </div>


      <div class="channelStats">

        ${channel.subscribers || 0}
        subscribers
            </div>


      ${
        channel.description
        ?
        `
        <div class="channelDescription">
          ${escapeHTML(channel.description)}
        </div>
        `
        :
        ""
      }


      <button
        class="channelEdit"
        onclick="editChannel()">

        Edit Channel

      </button>

    </div>


    <div class="channelVideosTitle">
      Videos
    </div>


    <div id="channelVideoList"></div>

  `;


  overlay.classList.add(
    "show"
  );


  renderChannelVideos();

}


async function renderChannelVideos(){

  const box =
    document.getElementById(
      "channelVideoList"
    );


  if(!box) return;


  const channel =
    getChannel();


  if(!channel) return;


  const videos =
    await getVideos();


  const myVideos =
    videos
      .filter(function(video){

        return (
          video.channelUsername ===
          channel.username
        );

      })
      .reverse();


  if(myVideos.length === 0){

    box.innerHTML = `

      <div class="empty">

        <h3>No videos yet</h3>

        <p>
          + वरून तुमचा पहिला video upload करा.
        </p>

      </div>

    `;

    return;

  }


  myVideos.forEach(function(video){

    const card =
      document.createElement("div");

    card.className =
      "channelVideoCard";


    let thumb = "";

    if(video.thumbnailBlob){

      thumb =
        URL.createObjectURL(
          video.thumbnailBlob
        );

    }


    card.innerHTML = `

      ${
        thumb
        ?
        `<img
          class="channelVideoThumb"
          src="${thumb}">`
        :
        `
        <div class="channelVideoThumb"
          style="
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:45px;
          ">
          ▶
        </div>
        `
      }


      <div class="channelVideoInfo">

        <div class="channelVideoTitle">
          ${escapeHTML(video.title)}
        </div>

        <div class="channelVideoMeta">
          ${video.views || 0}
          views •
          ${timeAgo(video.createdAt)}
        </div>

      </div>
    `;


    card.onclick =
      function(){

        closeChannel();

        playVideo(video);

      };


    box.appendChild(card);

  });

}


/* =====================================================
   EDIT CHANNEL
===================================================== */

function editChannel(){

  const channel =
    getChannel();


  if(!channel) return;


  const overlay =
    document.getElementById(
      "channelOverlay"
    );


  overlay.innerHTML = `

    <div class="channelTop">

      <button onclick="openChannel()">
        ←
      </button>

      <b>Edit Channel</b>

    </div>


    <div class="channelForm">

      <h2>Edit Channel</h2>


      <input
        id="editName"
        class="channelInput"
        value="${escapeHTML(channel.name)}"
        placeholder="Channel name">


      <input
        id="editUsername"
        class="channelInput"
        value="${escapeHTML(channel.username)}"
        placeholder="@username">


      <textarea
        id="editDescription"
        class="channelInput"
        placeholder="Description">${escapeHTML(
          channel.description || ""
        )}</textarea>


      <button
        class="channelSubmit"
        onclick="saveEditedChannel()">

        Save Changes

      </button>


      <button
        class="channelCancel"
        onclick="openChannel()">

        Cancel

      </button>

    </div>

  `;

}


function saveEditedChannel(){

  const channel =
    getChannel();


  if(!channel) return;


  let name =
    document.getElementById(
      "editName"
    ).value.trim();


  let username =
    document.getElementById(
      "editUsername"
    ).value.trim();


  const description =
    document.getElementById(
      "editDescription"
    ).value.trim();


  if(!name){

    alert("Channel name टाका.");

    return;

  }


  if(!username){

    username =
      channel.username;

  }


  if(username.charAt(0) !== "@"){

    username =
      "@" + username;

  }


  const oldUsername =
    channel.username;


  channel.name =
    name;

  channel.username =
    username;

  channel.description =
    description;


  saveChannel(channel);


  /* जुन्या videos ला नवीन channel username देऊ */

  getVideos().then(function(videos){

    videos.forEach(function(video){

      if(
        video.channelUsername ===
        oldUsername
      ){

        video.channelName =
          channel.name;

        video.channelUsername =
          channel.username;

        video.channelPhoto =
          channel.photo || "";

        updateVideo(video);

      }

    });

  });


  updateBottomAvatar();


  showChannelPage(channel);

}


/* =====================================================
   BOTTOM AVATAR
===================================================== */

function updateBottomAvatar(){

  const avatar =
    document.getElementById(
      "bottomAvatar"
    );


  if(!avatar) return;


  const channel =
    getChannel();


  if(!channel){

    avatar.textContent = "F";

    return;

  }


  if(channel.photo){

    avatar.innerHTML =
      `<img src="${channel.photo}">`;

  }
  else{

    avatar.textContent =
      channel.name
        .charAt(0)
        .toUpperCase();

  }

}


/* =====================================================
   SUBSCRIPTIONS PAGE
===================================================== */

function showSubscriptions(){

  const channel =
    getChannel();


  if(!channel){

    alert(
      "आधी तुमचा Channel तयार करा."
    );

    openChannel();

    return;

  }


  alert(
    "Subscriptions system पुढच्या server version मध्ये सर्व users साठी जोडता येईल."
  );

}


/* =====================================================
   HELPERS
===================================================== */

function escapeHTML(text){

  return String(text || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

}


function timeAgo(time){

  if(!time){
    return "just now";
  }


  const seconds =
    Math.floor(
      (Date.now() - time) / 1000
    );


  if(seconds < 60){

    return "just now";

  }


  const minutes =
    Math.floor(seconds / 60);


  if(minutes < 60){

    return minutes + " min ago";

  }


  const hours =
    Math.floor(minutes / 60);


  if(hours < 24){

    return hours + " hr ago";

  }


  const days =
    Math.floor(hours / 24);


  return days + " days ago";

}


/* =====================================================
   CATEGORY BUTTONS
===================================================== */

document.querySelectorAll(".category")
.forEach(function(btn){

  btn.addEventListener(
    "click",
    function(){

      document.querySelectorAll(".category")
      .forEach(function(x){

        x.classList.remove("active");

      });


      btn.classList.add("active");

    }
  );

});


/* =====================================================
   OUTSIDE UPLOAD
===================================================== */

document.getElementById(
  "uploadOverlay"
).addEventListener(
  "click",
  function(e){

    if(e.target === this){

      closeUpload();

    }

  }
);


/* =====================================================
   ESC
===================================================== */

document.addEventListener(
  "keydown",
  function(e){

    if(e.key === "Escape"){

      closeUpload();

      closePlayer();

      closeChannel();

    }

  }
);


/* =====================================================
   START
===================================================== */

loadSubscription();

updateBottomAvatar();
