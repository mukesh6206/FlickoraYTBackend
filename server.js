require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

/* =========================
   SECURITY HEADERS
========================= */

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

/* =========================
   GENERAL API RATE LIMIT
========================= */

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

/* =========================
   LOGIN / REGISTER LIMIT
========================= */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later."
  }
});

/* =========================
   UPLOAD LIMIT
========================= */

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Upload limit reached. Please try again later."
  }
});

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many posts. Please try again later."
  }
});

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const supabaseAuth = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const publicDir = path.join(__dirname, "public");

const allowedOrigins = new Set([
  "https://flickoraytbackend.onrender.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "100kb",
  parameterLimit: 100
}));

/* =========================
   SECURITY MONITOR
========================= */

const securityEvents = [];
const MAX_SECURITY_EVENTS = 200;

async function recordSecurityEvent(req, status, reason) {
  if (![401, 403, 429, 500].includes(status)) return;

  const event = {
    time: new Date().toISOString(),
    ip: clientIP(req),
    method: req.method,
    path: req.originalUrl,
    status,
    reason
  };

  securityEvents.unshift(event);

  if (securityEvents.length > MAX_SECURITY_EVENTS) {
    securityEvents.pop();
  }

  try {
    await supabaseAdmin
      .from("security_events")
      .insert({
        created_at: event.time,
        ip: event.ip,
        method: event.method,
        path: event.path,
        status: event.status,
        reason: event.reason
      });
  } catch (error) {
    console.error(
      "SECURITY LOG SAVE ERROR:",
      error.message
    );
  }
}

app.use((req, res, next) => {
  res.on("finish", () => {
    const reason =
      res.statusCode === 401
        ? "Unauthorized request"
        : res.statusCode === 403
          ? "Forbidden request"
          : res.statusCode === 429
            ? "Rate limit / blocked request"
            : res.statusCode === 500
              ? "Server error"
              : "";

    recordSecurityEvent(
      req,
      res.statusCode,
      reason
    ).catch(() => {});
  });

  next();
});

app.get("/api/security/events", async (req, res) => {
  const monitorKey =
    process.env.SECURITY_MONITOR_KEY || "";

  const suppliedKey =
    req.headers["x-security-key"] || "";

  if (
    !monitorKey ||
    suppliedKey !== monitorKey
  ) {
    return res.status(403).json({
      success: false,
      message: "Security monitor access denied"
    });
  }

  try {
    const { data, error } =
      await supabaseAdmin
        .from("security_events")
        .select(
          "id, created_at, ip, method, path, status, reason"
        )
        .order("created_at", {
          ascending: false
        })
        .limit(MAX_SECURITY_EVENTS);

    if (error) {
      console.error(
        "SECURITY LOG READ ERROR:",
        error.message
      );

      return res.json({
        success: true,
        count: securityEvents.length,
        events: securityEvents
      });
    }

    const events = (data || []).map(event => ({
      time: event.created_at,
      ip: event.ip,
      method: event.method,
      path: event.path,
      status: event.status,
      reason: event.reason
    }));

    res.json({
      success: true,
      count: events.length,
      events
    });

  } catch (error) {
    console.error(
      "SECURITY MONITOR ERROR:",
      error.message
    );

    res.json({
      success: true,
      count: securityEvents.length,
      events: securityEvents
    });
  }
});

const blockedIPs = new Map();
const BLOCK_TIME = 15 * 60 * 1000;

function clientIP(req) {
  return String(
    req.ip ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

app.use("/api", (req, res, next) => {
  const ip = clientIP(req);
  const until = blockedIPs.get(ip);

  if (until && until > Date.now()) {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later."
    });
  }

  if (until) {
    blockedIPs.delete(ip);
  }

  next();
});

apiLimiter.handler = (req, res, next, options) => {
  const ip = clientIP(req);
  blockedIPs.set(ip, Date.now() + BLOCK_TIME);

  res.status(options.statusCode).json({
    success: false,
    message: "Too many requests. Please try again later."
  });
};

app.use("/api", (req, res, next) => {
  const ip = clientIP(req);
  const blockedUntil = blockedIPs.get(ip);

  if (blockedUntil && blockedUntil > Date.now()) {
    return res.status(429).json({
      success: false,
      message: "IP temporarily blocked. Please try again later."
    });
  }

  if (blockedUntil) {
    blockedIPs.delete(ip);
  }

  apiLimiter(req, res, next);
});

function isAllowedVideo(buffer) {
  if (!buffer || buffer.length < 12) return false;

  const ftyp =
    buffer.toString("ascii", 4, 8);

  const webm =
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3;

  return ftyp === "ftyp" || webm;
}

function isAllowedImage(buffer) {
  if (!buffer || buffer.length < 12) return false;

  const jpeg =
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const png =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  const webp =
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  return jpeg || png || webp;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 2,
    fields: 10,
    parts: 12
  }
});



/* =========================
   VIDEO SHARE PREVIEW
========================= */

function escapeShareHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

app.get("/watch/:id", async (req, res) => {

  try {

    const videoId =
      String(req.params.id || "").trim();

    if (!videoId) {
      return res.redirect("/");
    }

    const { data: video, error } =
      await supabaseAdmin
        .from("videos")
        .select(`
          id,
          title,
          description,
          thumbnail_url,
          video_url,
          views,
          created_at,
          channels (
            name,
            avatar_url
          )
        `)
        .eq("id", videoId)
        .single();

    if (error || !video) {
      return res.redirect("/");
    }

    const title =
      video.title ||
      "Flickora Video";

    const description =
      video.description ||
      "Watch this video on Flickora.";

    const thumbnail =
      video.thumbnail_url ||
      "";

    const videoUrl =
      video.video_url ||
      "";

    const channelName =
      video.channels?.name ||
      "Flickora Creator";

    const shareUrl =
      `${req.protocol}://${req.get("host")}/watch/${encodeURIComponent(video.id)}`;

    const appUrl =
      `${req.protocol}://${req.get("host")}/?v=${encodeURIComponent(video.id)}`;

    res.set(
      "Cache-Control",
      "public, max-age=300"
    );

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0">

  <title>${escapeShareHTML(title)} - Flickora</title>

  <meta
    name="description"
    content="${escapeShareHTML(description)}">

  <link
    rel="canonical"
    href="${escapeShareHTML(shareUrl)}">

  <!-- WhatsApp / Facebook / Messenger -->
  <meta
    property="og:type"
    content="video.other">

  <meta
    property="og:title"
    content="${escapeShareHTML(title)}">

  <meta
    property="og:description"
    content="${escapeShareHTML(description)}">

  <meta
    property="og:image"
    content="${escapeShareHTML(thumbnail)}">

  <meta
    property="og:url"
    content="${escapeShareHTML(shareUrl)}">

  <meta
    property="og:site_name"
    content="Flickora">

  ${
    videoUrl
      ? `
  <meta
    property="og:video"
    content="${escapeShareHTML(videoUrl)}">

  <meta
    property="og:video:url"
    content="${escapeShareHTML(videoUrl)}">

  <meta
    property="og:video:secure_url"
    content="${escapeShareHTML(videoUrl)}">

  <meta
    property="og:video:type"
    content="video/mp4">
  `
      : ""
  }

  <!-- X / Twitter -->
  <meta
    name="twitter:card"
    content="summary_large_image">

  <meta
    name="twitter:title"
    content="${escapeShareHTML(title)}">

  <meta
    name="twitter:description"
    content="${escapeShareHTML(description)}">

  <meta
    name="twitter:image"
    content="${escapeShareHTML(thumbnail)}">

  <style>

    * {
      box-sizing:border-box;
    }

    body {
      margin:0;
      background:#080b18;
      color:#fff;
      font-family:Arial,sans-serif;
    }

    .page {
      width:min(900px,100%);
      margin:auto;
      padding:16px;
    }

    .brand {
      font-size:22px;
      font-weight:800;
      margin-bottom:16px;
    }

    .player {
      width:100%;
      background:#000;
      border-radius:14px;
      overflow:hidden;
    }

    video {
      display:block;
      width:100%;
      max-height:70vh;
      background:#000;
    }

    .title {
      font-size:22px;
      font-weight:700;
      margin-top:18px;
    }

    .channel {
      color:#a78bfa;
      margin-top:8px;
    }

    .description {
      color:#cbd5e1;
      line-height:1.5;
      margin-top:12px;
    }

    .open {
      display:inline-block;
      margin-top:18px;
      padding:12px 20px;
      border-radius:10px;
      background:#7c3aed;
      color:#fff;
      text-decoration:none;
      font-weight:700;
    }

  </style>

</head>

<body>

  <main class="page">

    <div class="brand">
      Flickora
    </div>

    <div class="player">

      ${
        videoUrl
          ? `
        <video
          controls
          playsinline
          poster="${escapeShareHTML(thumbnail)}"
          preload="metadata">

          <source
            src="${escapeShareHTML(videoUrl)}"
            type="video/mp4">

        </video>
        `
          : thumbnail
            ? `
        <img
          src="${escapeShareHTML(thumbnail)}"
          alt="${escapeShareHTML(title)}"
          style="width:100%;display:block;">
        `
            : ""
      }

    </div>

    <div class="title">
      ${escapeShareHTML(title)}
    </div>

    <div class="channel">
      ${escapeShareHTML(channelName)}
    </div>

    <div class="description">
      ${escapeShareHTML(description)}
    </div>

    <a
      class="open"
      href="${escapeShareHTML(appUrl)}">
      Open in Flickora
    </a>

  </main>

</body>
</html>
    `);

  }
  catch (err) {

    console.error(
      "SHARE PREVIEW ERROR:",
      err
    );

    res.redirect("/");

  }

});


/* =========================
   WEBSITE
========================= */

app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});


/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Flickora YT backend online"
  });
});


/* =========================
   AUTH HELPER
========================= */

async function getUser(req) {
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return null;
  }

  const token = auth.slice(7).trim();

  if (!token) {
    return null;
  }

  const { data, error } =
    await supabaseAdmin.auth.getUser(token);

  if (error || !data || !data.user) {
    return null;
  }

  return data.user;
}


/* =========================
   REGISTER
========================= */

app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const {
      email,
      password,
      username
    } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        success: false,
        message: "Email, password and username are required"
      });
    }

    const cleanEmail =
      String(email).trim().toLowerCase();

    const cleanUsername =
      String(username).trim();

    if (
      !cleanEmail ||
      !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(cleanEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address"
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters"
      });
    }

    const { data, error } =
      await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true
      });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const user = data.user;

    const { error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .insert({
          id: user.id,
          username: cleanUsername
        });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);

      return res.status(400).json({
        success: false,
        message: profileError.message
      });
    }

    const { error: channelError } =
      await supabaseAdmin
        .from("channels")
        .insert({
          user_id: user.id,
          name: cleanUsername,
          description: ""
        });

    if (channelError) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);

      return res.status(400).json({
        success: false,
        message: channelError.message
      });
    }

    const { data: loginData, error: loginError } =
      await supabaseAuth.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

    if (loginError) {
      return res.json({
        success: true,
        message: "Account created. Please login."
      });
    }

    return res.json({
      success: true,
      user: user,
      session: loginData.session
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});


/* =========================
   LOGIN
========================= */

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const { data, error } =
      await supabaseAuth.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    const user = data.user;

    const { data: profile } =
      await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    const { data: channel } =
      await supabaseAdmin
        .from("channels")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    res.json({
      success: true,
      user,
      profile,
      channel,
      session: data.session
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});


/* =========================
   CURRENT USER
========================= */

app.get("/api/me", async (req, res) => {
  try {
    const user = await getUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not logged in"
      });
    }

    const { data: profile } =
      await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    const { data: channel } =
      await supabaseAdmin
        .from("channels")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    res.json({
      success: true,
      user,
      profile,
      channel
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Could not load account"
    });
  }
});


/* =========================
   VIDEOS
========================= */

app.get("/api/videos", async (req, res) => {
  try {
    const type = req.query.type;

    let query = supabaseAdmin
      .from("videos")
      .select(`
        *,
        channels (
          id,
          user_id,
          name,
          avatar_url,
          subscribers_count
        )
      `)
      .order("created_at", {
        ascending: false
      });

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      videos: data || []
    });

  } catch (err) {
    console.error("VIDEOS ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Could not load videos"
    });
  }
});


/* =========================
   UPLOAD VIDEO
========================= */

app.post(
  "/api/videos/upload",
  uploadLimiter,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 }
  ]),
  async (req, res) => {

    try {
      const user = await getUser(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Please login first"
        });
      }

      const {
        title,
        description = "",
        hashtags = "",
        type = "video"
      } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title is required"
        });
      }

      const videoFile =
        req.files &&
        req.files.video &&
        req.files.video[0];

      const thumbnailFile =
        req.files &&
        req.files.thumbnail &&
        req.files.thumbnail[0];

      if (!videoFile) {
        return res.status(400).json({
          success: false,
          message: "Video file is required"
        });
      }

      if (!isAllowedVideo(videoFile.buffer)) {
        return res.status(400).json({
          success: false,
          message: "Invalid video file"
        });
      }

      const allowedVideoMime = new Set([
        "video/mp4",
        "video/webm",
        "video/quicktime"
      ]);

      if (!allowedVideoMime.has(videoFile.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Unsupported video format"
        });
      }

      let { data: channel } =
        await supabaseAdmin
          .from("channels")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

      if (!channel) {
        const { data: newChannel, error } =
          await supabaseAdmin
            .from("channels")
            .insert({
              user_id: user.id,
              name: user.email
                ? user.email.split("@")[0]
                : "Flickora User",
              description: ""
            })
            .select()
            .single();

        if (error) {
          return res.status(500).json({
            success: false,
            message: error.message
          });
        }

        channel = newChannel;
      }

      const safeTitle =
        title
          .trim()
          .replace(/[^a-zA-Z0-9_-]+/g, "-")
          .slice(0, 60);

      const random =
        crypto.randomBytes(8).toString("hex");

      const extension =
        path.extname(videoFile.originalname)
          .toLowerCase() || ".mp4";

      const videoPath =
        `${user.id}/${Date.now()}-${random}-${safeTitle}${extension}`;

      const { error: videoUploadError } =
        await supabaseAdmin.storage
          .from("videos")
          .upload(
            videoPath,
            videoFile.buffer,
            {
              contentType:
                videoFile.mimetype || "video/mp4",
              upsert: false
            }
          );

      if (videoUploadError) {
        return res.status(500).json({
          success: false,
          message: videoUploadError.message
        });
      }

      const {
        data: videoPublic
      } =
        supabaseAdmin.storage
          .from("videos")
          .getPublicUrl(videoPath);

      let thumbnailUrl = null;

      if (thumbnailFile) {

        if (!isAllowedImage(thumbnailFile.buffer)) {
          return res.status(400).json({
            success: false,
            message: "Invalid thumbnail file"
          });
        }

        const allowedImageMime = new Set([
          "image/jpeg",
          "image/png",
          "image/webp"
        ]);

        if (!allowedImageMime.has(thumbnailFile.mimetype)) {
          return res.status(400).json({
            success: false,
            message: "Unsupported thumbnail format"
          });
        }

        const thumbExtension =
          path.extname(
            thumbnailFile.originalname
          ).toLowerCase() || ".jpg";

        const thumbPath =
          `${user.id}/${Date.now()}-${random}${thumbExtension}`;

        const {
          error: thumbnailUploadError
        } =
          await supabaseAdmin.storage
            .from("thumbnails")
            .upload(
              thumbPath,
              thumbnailFile.buffer,
              {
                contentType:
                  thumbnailFile.mimetype || "image/jpeg",
                upsert: false
              }
            );

        if (thumbnailUploadError) {
          return res.status(500).json({
            success: false,
            message: thumbnailUploadError.message
          });
        }

        const {
          data: thumbPublic
        } =
          supabaseAdmin.storage
            .from("thumbnails")
            .getPublicUrl(thumbPath);

        thumbnailUrl =
          thumbPublic.publicUrl;
      }

      const { data: video, error: insertError } =
        await supabaseAdmin
          .from("videos")
          .insert({
            channel_id: channel.id,
            title: title.trim(),
            description: String(description || ""),
            hashtags: String(hashtags || ""),
            type: type === "short"
              ? "short"
              : "video",
            video_url:
              videoPublic.publicUrl,
            thumbnail_url:
              thumbnailUrl,
            views: 0
          })
          .select()
          .single();

      if (insertError) {
        return res.status(500).json({
          success: false,
          message: insertError.message
        });
      }

      res.json({
        success: true,
        message: "Video uploaded successfully",
        video
      });

    } catch (err) {
      console.error("UPLOAD ERROR:", err);

      res.status(500).json({
        success: false,
        message: "Upload failed"
      });
    }
  }
);


/* =========================
   VIDEO VIEW
========================= */

const viewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many view requests. Please try again later."
  }
});

app.post("/api/videos/:id/view", viewLimiter, async (req, res) => {
  try {
    const id = req.params.id;

    const { data: video, error: getError } =
      await supabaseAdmin
        .from("videos")
        .select("views")
        .eq("id", id)
        .single();

    if (getError || !video) {
      return res.status(404).json({
        success: false,
        message: "Video not found"
      });
    }

    const newViews =
      Number(video.views || 0) + 1;

    const { data, error } =
      await supabaseAdmin
        .from("videos")
        .update({
          views: newViews
        })
        .eq("id", id)
        .select("views")
        .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      views: data.views
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Could not update views"
    });
  }
});



/* =========================
   POSTS
========================= */

app.get("/api/posts", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("posts")
      .select(`
        *,
        channels (
          id,
          user_id,
          name,
          avatar_url
        )
      `)
      .order("created_at", {
        ascending: false
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      posts: data || []
    });

  } catch (err) {
    console.error("LOAD POSTS ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Could not load posts"
    });
  }
});


app.post("/api/posts", postLimiter, upload.single("image"), async (req, res) => {
  try {
    const user = await getUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Please login first"
      });
    }

    const content = String(req.body.content || "").trim();

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Post text is required"
      });
    }

    let { data: channel } = await supabaseAdmin
      .from("channels")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!channel) {
      const { data: newChannel, error } =
        await supabaseAdmin
          .from("channels")
          .insert({
            user_id: user.id,
            name: user.email
              ? user.email.split("@")[0]
              : "Flickora User",
            description: ""
          })
          .select()
          .single();

      if (error) {
        return res.status(500).json({
          success: false,
          message: error.message
        });
      }

      channel = newChannel;
    }

    let imageUrl = null;

    if (req.file) {
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({
          success: false,
          message: "Only image files are allowed"
        });
      }

      const extension =
        path.extname(req.file.originalname).toLowerCase() || ".jpg";

      const imagePath =
        `posts/${user.id}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;

      const { error: imageError } =
        await supabaseAdmin.storage
          .from("thumbnails")
          .upload(imagePath, req.file.buffer, {
            contentType: req.file.mimetype || "image/jpeg",
            upsert: false
          });

      if (imageError) {
        return res.status(500).json({
          success: false,
          message: imageError.message
        });
      }

      const { data: publicImage } =
        supabaseAdmin.storage
          .from("thumbnails")
          .getPublicUrl(imagePath);

      imageUrl = publicImage.publicUrl;
    }

    const { data: post, error } =
      await supabaseAdmin
        .from("posts")
        .insert({
          channel_id: channel.id,
          content,
          image_url: imageUrl
        })
        .select(`
          *,
          channels (
            id,
            user_id,
            name,
            avatar_url
          )
        `)
        .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Post published successfully",
      post
    });

  } catch (err) {
    console.error("CREATE POST ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Could not create post"
    });
  }
});


app.delete("/api/posts/:id", async (req, res) => {
  try {
    const user = await getUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Please login first"
      });
    }

    const { data: post, error } =
      await supabaseAdmin
        .from("posts")
        .select(`
          id,
          channel_id,
          channels (
            user_id
          )
        `)
        .eq("id", req.params.id)
        .single();

    if (error || !post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    if (!post.channels || post.channels.user_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: "You can delete only your own post"
      });
    }

    const { error: deleteError } =
      await supabaseAdmin
        .from("posts")
        .delete()
        .eq("id", req.params.id);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        message: deleteError.message
      });
    }

    res.json({
      success: true,
      message: "Post deleted"
    });

  } catch (err) {
    console.error("DELETE POST ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Could not delete post"
    });
  }
});


/* =========================
   CHANNEL
========================= */

app.get("/api/channels/:id", async (req, res) => {
  try {
    const channelId = req.params.id;

    const { data: channel, error } =
      await supabaseAdmin
        .from("channels")
        .select("*")
        .eq("id", channelId)
        .single();

    if (error || !channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found"
      });
    }

    const { data: videos } =
      await supabaseAdmin
        .from("videos")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", {
          ascending: false
        });

    const { data: posts } =
      await supabaseAdmin
        .from("posts")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", {
          ascending: false
        });

    let subscribed = false;

    const user = await getUser(req);

    if (user) {
      const { data: subscription } =
        await supabaseAdmin
          .from("subscriptions")
          .select("subscriber_id")
          .eq("subscriber_id", user.id)
          .eq("channel_id", channelId)
          .maybeSingle();

      subscribed = !!subscription;
    }

    res.json({
      success: true,
      channel,
      videos: videos || [],
      posts: posts || [],
      subscribed
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Could not load channel"
    });
  }
});


/* =========================
   UPDATE CHANNEL
========================= */

app.put("/api/channels/:id", async (req, res) => {
  try {
    const user = await getUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Please login first"
      });
    }

    const channelId = req.params.id;

    const {
      name,
      description
    } = req.body;

    const { data: channel } =
      await supabaseAdmin
        .from("channels")
        .select("user_id")
        .eq("id", channelId)
        .single();

    if (!channel || channel.user_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: "Not your channel"
      });
    }

    const updateData = {};

    if (name !== undefined) {
      updateData.name =
        String(name).trim();
    }

    if (description !== undefined) {
      updateData.description =
        String(description);
    }

    const { data, error } =
      await supabaseAdmin
        .from("channels")
        .update(updateData)
        .eq("id", channelId)
        .select()
        .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      channel: data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Could not update channel"
    });
  }
});



/* =========================
   UPDATE MY PROFILE
========================= */

app.put("/api/profiles/me", async (req, res) => {
  try {

    const user = await getUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Please login first"
      });
    }

    const username =
      String(req.body.username || "").trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required"
      });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        success: false,
        message: "Username must be 3-30 characters"
      });
    }

    const { data, error } =
      await supabaseAdmin
        .from("profiles")
        .update({
          username: username
        })
        .eq("id", user.id)
        .select()
        .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      profile: data
    });

  } catch (err) {

    console.error(
      "PROFILE UPDATE ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      message: "Could not update profile"
    });

  }
});


/* =========================
   SUBSCRIPTION VIDEOS
========================= */

app.get("/api/subscriptions/videos", async (req, res) => {
  try {
    const user = await getUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Please login first"
      });
    }

    const { data: subscriptions, error: subError } =
      await supabaseAdmin
        .from("subscriptions")
        .select("channel_id")
        .eq("subscriber_id", user.id);

    if (subError) {
      return res.status(500).json({
        success: false,
        message: subError.message
      });
    }

    const channelIds =
      (subscriptions || []).map(s => s.channel_id);

    if (!channelIds.length) {
      return res.json({
        success: true,
        videos: []
      });
    }

    const { data: videos, error: videoError } =
      await supabaseAdmin
        .from("videos")
        .select(`
          *,
          channels (
            id,
            user_id,
            name,
            avatar_url,
            subscribers_count
          )
        `)
        .in("channel_id", channelIds)
        .order("created_at", {
          ascending: false
        });

    if (videoError) {
      return res.status(500).json({
        success: false,
        message: videoError.message
      });
    }

    res.json({
      success: true,
      videos: videos || []
    });

  } catch (err) {
    console.error("SUBSCRIPTIONS VIDEOS ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Could not load subscriptions"
    });
  }
});


/* =========================
   SUBSCRIBE
========================= */

app.post(
  "/api/channels/:id/subscribe",
  async (req, res) => {

    try {
      const user = await getUser(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Please login first"
        });
      }

      const channelId = req.params.id;

      const { error } =
        await supabaseAdmin
          .from("subscriptions")
          .upsert({
            subscriber_id: user.id,
            channel_id: channelId
          });

      if (error) {
        return res.status(500).json({
          success: false,
          message: error.message
        });
      }

      const { count } =
        await supabaseAdmin
          .from("subscriptions")
          .select("*", {
            count: "exact",
            head: true
          })
          .eq("channel_id", channelId);

      await supabaseAdmin
        .from("channels")
        .update({
          subscribers_count:
            count || 0
        })
        .eq("id", channelId);

      res.json({
        success: true,
        subscribed: true,
        subscribers: count || 0
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Subscribe failed"
      });
    }
  }
);


/* =========================
   UNSUBSCRIBE
========================= */

app.delete(
  "/api/channels/:id/subscribe",
  async (req, res) => {

    try {
      const user = await getUser(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Please login first"
        });
      }

      const channelId = req.params.id;

      const { error } =
        await supabaseAdmin
          .from("subscriptions")
          .delete()
          .eq("subscriber_id", user.id)
          .eq("channel_id", channelId);

      if (error) {
        return res.status(500).json({
          success: false,
          message: error.message
        });
      }

      const { count } =
        await supabaseAdmin
          .from("subscriptions")
          .select("*", {
            count: "exact",
            head: true
          })
          .eq("channel_id", channelId);

      await supabaseAdmin
        .from("channels")
        .update({
          subscribers_count:
            count || 0
        })
        .eq("id", channelId);

      res.json({
        success: true,
        subscribed: false,
        subscribers: count || 0
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Unsubscribe failed"
      });
    }
  }
);



/* =========================
   CREATOR VIDEO EDIT
========================= */

app.put("/api/videos/:id", async (req, res) => {
  try {
    const user = await getUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Please login first"
      });
    }

    const videoId = req.params.id;

    const {
      title,
      description,
      hashtags
    } = req.body;

    const { data: video, error: videoError } =
      await supabaseAdmin
        .from("videos")
        .select(`
          id,
          channel_id,
          channels (
            user_id
          )
        `)
        .eq("id", videoId)
        .single();

    if (videoError || !video) {
      return res.status(404).json({
        success: false,
        message: "Video not found"
      });
    }

    if (
      !video.channels ||
      video.channels.user_id !== user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can edit only your own video"
      });
    }

    const updateData = {};

    if (title !== undefined) {
      const cleanTitle = String(title).trim();

      if (!cleanTitle) {
        return res.status(400).json({
          success: false,
          message: "Title is required"
        });
      }

      updateData.title = cleanTitle;
    }

    if (description !== undefined) {
      updateData.description =
        String(description);
    }

    if (hashtags !== undefined) {
      updateData.hashtags =
        String(hashtags);
    }

    const { data, error } =
      await supabaseAdmin
        .from("videos")
        .update(updateData)
        .eq("id", videoId)
        .select()
        .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Video updated successfully",
      video: data
    });

  } catch (err) {
    console.error("EDIT VIDEO ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Could not edit video"
    });
  }
});



/* =========================
   CREATOR VIDEO THUMBNAIL
========================= */

app.post("/api/videos/:id/thumbnail", upload.single("thumbnail"), async (req, res) => {
  try {
    const user = await getUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Please login first"
      });
    }

    const videoId = req.params.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Thumbnail is required"
      });
    }

    if (!String(req.file.mimetype || "").startsWith("image/")) {
      return res.status(400).json({
        success: false,
        message: "Please select an image"
      });
    }

    const { data: video, error: videoError } =
      await supabaseAdmin
        .from("videos")
        .select(`
          id,
          channel_id,
          thumbnail_url,
          channels (
            user_id
          )
        `)
        .eq("id", videoId)
        .single();

    if (videoError || !video) {
      return res.status(404).json({
        success: false,
        message: "Video not found"
      });
    }

    if (
      !video.channels ||
      video.channels.user_id !== user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can change only your own thumbnail"
      });
    }

    function getStoragePath(publicUrl, bucket) {
      if (!publicUrl) return null;

      const marker =
        "/storage/v1/object/public/" + bucket + "/";

      const index =
        publicUrl.indexOf(marker);

      if (index === -1) return null;

      return decodeURIComponent(
        publicUrl.slice(index + marker.length)
      );
    }

    const oldPath =
      getStoragePath(
        video.thumbnail_url,
        "thumbnails"
      );

    const extension =
      path.extname(
        req.file.originalname || ""
      ).toLowerCase() || ".jpg";

    const newPath =
      `${user.id}/thumb-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;

    const { error: uploadError } =
      await supabaseAdmin.storage
        .from("thumbnails")
        .upload(
          newPath,
          req.file.buffer,
          {
            contentType:
              req.file.mimetype || "image/jpeg",
            upsert: false
          }
        );

    if (uploadError) {
      return res.status(500).json({
        success: false,
        message: uploadError.message
      });
    }

    const {
      data: publicData
    } =
      supabaseAdmin.storage
        .from("thumbnails")
        .getPublicUrl(newPath);

    const thumbnailUrl =
      publicData.publicUrl;

    const { data: updatedVideo, error: updateError } =
      await supabaseAdmin
        .from("videos")
        .update({
          thumbnail_url: thumbnailUrl
        })
        .eq("id", videoId)
        .select()
        .single();

    if (updateError) {
      await supabaseAdmin.storage
        .from("thumbnails")
        .remove([newPath]);

      return res.status(500).json({
        success: false,
        message: updateError.message
      });
    }

    if (oldPath) {
      await supabaseAdmin.storage
        .from("thumbnails")
        .remove([oldPath]);
    }

    res.json({
      success: true,
      message: "Thumbnail updated successfully",
      video: updatedVideo,
      thumbnail_url: thumbnailUrl
    });

  } catch (err) {
    console.error(
      "THUMBNAIL UPDATE ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      message: "Could not update thumbnail"
    });
  }
});


/* =========================
   CREATOR VIDEO DELETE
========================= */

app.delete("/api/videos/:id", async (req, res) => {
  try {
    const user = await getUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Please login first"
      });
    }

    const videoId = req.params.id;

    const { data: video, error: videoError } =
      await supabaseAdmin
        .from("videos")
        .select(`
          id,
          channel_id,
          video_url,
          thumbnail_url,
          channels (
            user_id
          )
        `)
        .eq("id", videoId)
        .single();

    if (videoError || !video) {
      return res.status(404).json({
        success: false,
        message: "Video not found"
      });
    }

    if (
      !video.channels ||
      video.channels.user_id !== user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can delete only your own video"
      });
    }

    function getStoragePath(publicUrl, bucket) {
      if (!publicUrl) return null;

      const marker =
        `/storage/v1/object/public/${bucket}/`;

      const index =
        publicUrl.indexOf(marker);

      if (index === -1) return null;

      return decodeURIComponent(
        publicUrl.slice(index + marker.length)
      );
    }

    const videoPath =
      getStoragePath(
        video.video_url,
        "videos"
      );

    const thumbnailPath =
      getStoragePath(
        video.thumbnail_url,
        "thumbnails"
      );

    if (videoPath) {
      await supabaseAdmin.storage
        .from("videos")
        .remove([videoPath]);
    }

    if (thumbnailPath) {
      await supabaseAdmin.storage
        .from("thumbnails")
        .remove([thumbnailPath]);
    }

    const { error: deleteError } =
      await supabaseAdmin
        .from("videos")
        .delete()
        .eq("id", videoId);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        message: deleteError.message
      });
    }

    res.json({
      success: true,
      message: "Video deleted successfully"
    });

  } catch (err) {
    console.error("DELETE VIDEO ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Could not delete video"
    });
  }
});


/* =========================
   CHANNEL PROFILE PHOTO
========================= */

app.post(
  "/api/channels/:id/avatar",
  upload.single("avatar"),
  async (req, res) => {
    try {
      const user = await getUser(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Please login first"
        });
      }

      const channelId = req.params.id;

      const { data: channel, error: channelError } =
        await supabaseAdmin
          .from("channels")
          .select("id, user_id, avatar_url")
          .eq("id", channelId)
          .single();

      if (
        channelError ||
        !channel ||
        channel.user_id !== user.id
      ) {
        return res.status(403).json({
          success: false,
          message: "You can change only your own profile"
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Profile photo is required"
        });
      }

      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({
          success: false,
          message: "Only image files are allowed"
        });
      }

      const extension =
        path.extname(
          req.file.originalname
        ).toLowerCase() || ".jpg";

      const avatarPath =
        `${user.id}/profile-${Date.now()}${extension}`;

      const { error: uploadError } =
        await supabaseAdmin.storage
          .from("thumbnails")
          .upload(
            avatarPath,
            req.file.buffer,
            {
              contentType:
                req.file.mimetype,
              upsert: false
            }
          );

      if (uploadError) {
        return res.status(500).json({
          success: false,
          message: uploadError.message
        });
      }

      const { data: publicData } =
        supabaseAdmin.storage
          .from("thumbnails")
          .getPublicUrl(avatarPath);

      const avatarUrl =
        publicData.publicUrl;

      const { data, error } =
        await supabaseAdmin
          .from("channels")
          .update({
            avatar_url: avatarUrl
          })
          .eq("id", channelId)
          .select()
          .single();

      if (error) {
        return res.status(500).json({
          success: false,
          message: error.message
        });
      }

      res.json({
        success: true,
        message: "Profile photo updated successfully",
        channel: data,
        avatar_url: avatarUrl
      });

    } catch (err) {
      console.error("AVATAR ERROR:", err);

      res.status(500).json({
        success: false,
        message: "Could not update profile photo"
      });
    }
  }
);


/* =========================
   404 API
========================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});


/* =========================
   ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});


/* =========================
   START
========================= */

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("=================================");
  console.log("      FLICKORA YT SERVER");
  console.log("=================================");
  console.log(`Server running on port ${PORT}`);
  console.log(`Website: http://127.0.0.1:${PORT}`);
  console.log("=================================");
  console.log("");
});

server.requestTimeout = 120000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;
