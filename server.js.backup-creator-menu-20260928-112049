require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

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

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
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

app.post("/api/auth/register", async (req, res) => {
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

    const cleanUsername = String(username).trim();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters"
      });
    }

    const { data, error } =
      await supabaseAdmin.auth.admin.createUser({
        email,
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
        email,
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

app.post("/api/auth/login", async (req, res) => {
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

app.post("/api/videos/:id/view", async (req, res) => {
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

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("=================================");
  console.log("      FLICKORA YT SERVER");
  console.log("=================================");
  console.log(`Server running on port ${PORT}`);
  console.log(`Website: http://127.0.0.1:${PORT}`);
  console.log("=================================");
  console.log("");
});
