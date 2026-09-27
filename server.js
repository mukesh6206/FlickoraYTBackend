require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: Supabase environment variables missing.");
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

/* =====================================================
   BASIC
===================================================== */

app.get("/", (req, res) => {
  res.json({
    name: "Flickora YT",
    status: "Backend is running",
    version: "2.0.0"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Flickora YT backend online",
    database: "Supabase"
  });
});

/* =====================================================
   AUTH HELPER
===================================================== */

async function getUser(req) {

  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.substring(7).trim();

  if (!token) {
    return null;
  }

  const { data, error } =
    await supabase.auth.getUser(token);

  if (error || !data || !data.user) {
    return null;
  }

  return data.user;
}

async function requireUser(req, res) {

  const user = await getUser(req);

  if (!user) {

    res.status(401).json({
      success: false,
      message: "Login required"
    });

    return null;
  }

  return user;
}

/* =====================================================
   REGISTER
===================================================== */

app.post("/api/auth/register", async (req, res) => {

  try {

    const email =
      String(req.body.email || "")
        .trim()
        .toLowerCase();

    const password =
      String(req.body.password || "");

    const username =
      String(req.body.username || "")
        .trim();

    const channelName =
      String(
        req.body.channelName ||
        username ||
        "Flickora Creator"
      ).trim();

    if (!email || !password || !username) {

      return res.status(400).json({
        success: false,
        message: "Email, password आणि username आवश्यक आहेत."
      });

    }

    if (password.length < 6) {

      return res.status(400).json({
        success: false,
        message: "Password किमान 6 characters असावा."
      });

    }

    const { data, error } =
      await supabase.auth.signUp({
        email,
        password
      });

    if (error) {

      return res.status(400).json({
        success: false,
        message: error.message
      });

    }

    if (!data.user) {

      return res.status(400).json({
        success: false,
        message: "Account तयार झाला नाही."
      });

    }

    const userId = data.user.id;

    const { error: profileError } =
      await supabase
        .from("profiles")
        .insert({
          id: userId,
          username
        });

    if (profileError) {

      return res.status(400).json({
        success: false,
        message:
          "Profile तयार करता आला नाही: " +
          profileError.message
      });

    }

    const { data: channel, error: channelError } =
      await supabase
        .from("channels")
        .insert({
          user_id: userId,
          name: channelName,
          description: "",
          subscribers_count: 0
        })
        .select()
        .single();

    if (channelError) {

      return res.status(400).json({
        success: false,
        message:
          "Channel तयार करता आला नाही: " +
          channelError.message
      });

    }

    res.json({
      success: true,
      message:
        data.session
          ? "Account successfully created."
          : "Account created. Email confirmation आवश्यक असल्यास email तपासा.",
      user: {
        id: userId,
        email: email
      },
      profile: {
        username
      },
      channel,
      session: data.session || null
    });

  }
  catch (error) {

    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Registration failed."
    });

  }

});

/* =====================================================
   LOGIN
===================================================== */

app.post("/api/auth/login", async (req, res) => {

  try {

    const email =
      String(req.body.email || "")
        .trim()
        .toLowerCase();

    const password =
      String(req.body.password || "");

    if (!email || !password) {

      return res.status(400).json({
        success: false,
        message: "Email आणि password टाका."
      });

    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
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
      await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    const { data: channel } =
      await supabase
        .from("channels")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email
      },
      profile,
      channel,
      session: data.session
    });

  }
  catch (error) {

    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Login failed."
    });

  }

});

/* =====================================================
   CURRENT USER
===================================================== */

app.get("/api/me", async (req, res) => {

  try {

    const user = await requireUser(req, res);

    if (!user) return;

    const { data: profile } =
      await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    const { data: channel } =
      await supabase
        .from("channels")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email
      },
      profile,
      channel
    });

  }
  catch (error) {

    console.error("ME ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Could not load account."
    });

  }

});

/* =====================================================
   ALL VIDEOS
===================================================== */

app.get("/api/videos", async (req, res) => {

  try {

    const { data, error } =
      await supabase
        .from("videos")
        .select(`
          id,
          channel_id,
          title,
          description,
          hashtags,
          type,
          video_url,
          thumbnail_url,
          views,
          created_at,
          channels (
            id,
            user_id,
            name,
            description,
            avatar_url,
            subscribers_count
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

    const videos = (data || []).map(v => ({
      id: v.id,
      channelId: v.channel_id,
      title: v.title,
      description: v.description || "",
      hashtags: v.hashtags || "",
      type: v.type,
      videoUrl: v.video_url,
      thumbnailUrl: v.thumbnail_url || "",
      views: Number(v.views || 0),
      createdAt: v.created_at,
      channelName:
        v.channels?.name ||
        "Flickora Creator",
      channelPhoto:
        v.channels?.avatar_url ||
        "",
      subscribers:
        Number(
          v.channels?.subscribers_count || 0
        )
    }));

    res.json({
      success: true,
      videos
    });

  }
  catch (error) {

    console.error("VIDEOS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Could not load videos."
    });

  }

});

/* =====================================================
   UPLOAD VIDEO
===================================================== */

app.post(
  "/api/videos/upload",
  upload.fields([
    {
      name: "video",
      maxCount: 1
    },
    {
      name: "thumbnail",
      maxCount: 1
    }
  ]),
  async (req, res) => {

    try {

      const user =
        await requireUser(req, res);

      if (!user) return;

      const title =
        String(req.body.title || "")
          .trim();

      const description =
        String(req.body.description || "")
          .trim();

      const hashtags =
        String(req.body.hashtags || "")
          .trim();

      const type =
        req.body.type === "short"
          ? "short"
          : "video";

      const videoFile =
        req.files?.video?.[0];

      const thumbnailFile =
        req.files?.thumbnail?.[0] ||
        null;

      if (!title) {

        return res.status(400).json({
          success: false,
          message: "Video title आवश्यक आहे."
        });

      }

      if (!videoFile) {

        return res.status(400).json({
          success: false,
          message: "Video file आवश्यक आहे."
        });

      }

      const { data: channel, error: channelError } =
        await supabase
          .from("channels")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

      if (channelError || !channel) {

        return res.status(400).json({
          success: false,
          message: "आधी channel तयार करा."
        });

      }

      const random =
        crypto.randomBytes(8).toString("hex");

      const extension =
        (
          videoFile.originalname
            .split(".")
            .pop() || "mp4"
        )
        .replace(/[^a-zA-Z0-9]/g, "");

      const videoPath =
        `${user.id}/${Date.now()}-${random}.${extension}`;

      const { error: videoUploadError } =
        await supabase.storage
          .from("videos")
          .upload(
            videoPath,
            videoFile.buffer,
            {
              contentType:
                videoFile.mimetype ||
                "video/mp4",
              upsert: false
            }
          );

      if (videoUploadError) {

        return res.status(500).json({
          success: false,
          message:
            "Video upload failed: " +
            videoUploadError.message
        });

      }

      const {
        data: videoPublic
      } =
        supabase.storage
          .from("videos")
          .getPublicUrl(videoPath);

      let thumbnailUrl = null;

      if (thumbnailFile) {

        const thumbExt =
          (
            thumbnailFile.originalname
              .split(".")
              .pop() || "jpg"
          )
          .replace(/[^a-zA-Z0-9]/g, "");

        const thumbPath =
          `${user.id}/${Date.now()}-${random}.${thumbExt}`;

        const {
          error: thumbError
        } =
          await supabase.storage
            .from("thumbnails")
            .upload(
              thumbPath,
              thumbnailFile.buffer,
              {
                contentType:
                  thumbnailFile.mimetype ||
                  "image/jpeg",
                upsert: false
              }
            );

        if (thumbError) {

          console.error(
            "THUMBNAIL ERROR:",
            thumbError
          );

        }
        else {

          const {
            data: thumbPublic
          } =
            supabase.storage
              .from("thumbnails")
              .getPublicUrl(
                thumbPath
              );

          thumbnailUrl =
            thumbPublic.publicUrl;

        }

      }

      const { data: video, error: insertError } =
        await supabase
          .from("videos")
          .insert({
            channel_id: channel.id,
            title,
            description,
            hashtags,
            type,
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
          message:
            "Database save failed: " +
            insertError.message
        });

      }

      res.json({
        success: true,
        message: "Video uploaded successfully",
        video: {
          ...video,
          videoUrl: video.video_url,
          thumbnailUrl:
            video.thumbnail_url || "",
          channelName: channel.name,
          channelPhoto:
            channel.avatar_url || "",
          subscribers:
            Number(
              channel.subscribers_count || 0
            )
        }
      });

    }
    catch (error) {

      console.error(
        "UPLOAD ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Upload failed."
      });

    }

  }
);

/* =====================================================
   VIEW +1
===================================================== */

app.post(
  "/api/videos/:id/view",
  async (req, res) => {

    try {

      const videoId =
        req.params.id;

      const { data: video, error: findError } =
        await supabase
          .from("videos")
          .select("views")
          .eq("id", videoId)
          .maybeSingle();

      if (findError || !video) {

        return res.status(404).json({
          success: false,
          message: "Video not found."
        });

      }

      const newViews =
        Number(video.views || 0) + 1;

      const { error: updateError } =
        await supabase
          .from("videos")
          .update({
            views: newViews
          })
          .eq("id", videoId);

      if (updateError) {

        return res.status(500).json({
          success: false,
          message: updateError.message
        });

      }

      res.json({
        success: true,
        views: newViews
      });

    }
    catch (error) {

      console.error(
        "VIEW ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "View update failed."
      });

    }

  }
);

/* =====================================================
   CHANNEL
===================================================== */

app.get(
  "/api/channels/:id",
  async (req, res) => {

    try {

      const channelId =
        req.params.id;

      const { data: channel, error } =
        await supabase
          .from("channels")
          .select("*")
          .eq("id", channelId)
          .maybeSingle();

      if (error || !channel) {

        return res.status(404).json({
          success: false,
          message: "Channel not found."
        });

      }

      const { data: videos } =
        await supabase
          .from("videos")
          .select("*")
          .eq("channel_id", channelId)
          .order("created_at", {
            ascending: false
          });

      res.json({
        success: true,
        channel,
        videos: videos || []
      });

    }
    catch (error) {

      console.error(
        "CHANNEL ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Channel load failed."
      });

    }

  }
);

/* =====================================================
   UPDATE CHANNEL
===================================================== */

app.put(
  "/api/channels/:id",
  async (req, res) => {

    try {

      const user =
        await requireUser(req, res);

      if (!user) return;

      const channelId =
        req.params.id;

      const { data: channel } =
        await supabase
          .from("channels")
          .select("*")
          .eq("id", channelId)
          .maybeSingle();

      if (!channel) {

        return res.status(404).json({
          success: false,
          message: "Channel not found."
        });

      }

      if (channel.user_id !== user.id) {

        return res.status(403).json({
          success: false,
          message: "Not your channel."
        });

      }

      const name =
        String(req.body.name || "")
          .trim();

      const description =
        String(req.body.description || "")
          .trim();

      if (!name) {

        return res.status(400).json({
          success: false,
          message: "Channel name आवश्यक आहे."
        });

      }

      const { data: updated, error } =
        await supabase
          .from("channels")
          .update({
            name,
            description
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
        channel: updated
      });

    }
    catch (error) {

      console.error(
        "UPDATE CHANNEL ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Channel update failed."
      });

    }

  }
);

/* =====================================================
   SUBSCRIBE
===================================================== */

app.post(
  "/api/channels/:id/subscribe",
  async (req, res) => {

    try {

      const user =
        await requireUser(req, res);

      if (!user) return;

      const channelId =
        req.params.id;

      const { data: channel } =
        await supabase
          .from("channels")
          .select("*")
          .eq("id", channelId)
          .maybeSingle();

      if (!channel) {

        return res.status(404).json({
          success: false,
          message: "Channel not found."
        });

      }

      if (channel.user_id === user.id) {

        return res.status(400).json({
          success: false,
          message: "स्वतःच्या channel ला subscribe करता येत नाही."
        });

      }

      const { error: insertError } =
        await supabase
          .from("subscriptions")
          .upsert(
            {
              subscriber_id: user.id,
              channel_id: channelId
            },
            {
              onConflict:
                "subscriber_id,channel_id",
              ignoreDuplicates: true
            }
          );

      if (insertError) {

        return res.status(500).json({
          success: false,
          message: insertError.message
        });

      }

      const { count } =
        await supabase
          .from("subscriptions")
          .select("*", {
            count: "exact",
            head: true
          })
          .eq("channel_id", channelId);

      const subscribers =
        Number(count || 0);

      await supabase
        .from("channels")
        .update({
          subscribers_count:
            subscribers
        })
        .eq("id", channelId);

      res.json({
        success: true,
        subscribed: true,
        subscribers
      });

    }
    catch (error) {

      console.error(
        "SUBSCRIBE ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Subscribe failed."
      });

    }

  }
);

/* =====================================================
   UNSUBSCRIBE
===================================================== */

app.delete(
  "/api/channels/:id/subscribe",
  async (req, res) => {

    try {

      const user =
        await requireUser(req, res);

      if (!user) return;

      const channelId =
        req.params.id;

      const { error } =
        await supabase
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
        await supabase
          .from("subscriptions")
          .select("*", {
            count: "exact",
            head: true
          })
          .eq("channel_id", channelId);

      const subscribers =
        Number(count || 0);

      await supabase
        .from("channels")
        .update({
          subscribers_count:
            subscribers
        })
        .eq("id", channelId);

      res.json({
        success: true,
        subscribed: false,
        subscribers
      });

    }
    catch (error) {

      console.error(
        "UNSUBSCRIBE ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Unsubscribe failed."
      });

    }

  }
);

/* =====================================================
   START
===================================================== */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "================================"
    );

    console.log(
      "       FLICKORA YT"
    );

    console.log(
      "================================"
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      "Supabase backend connected"
    );

  }
);
