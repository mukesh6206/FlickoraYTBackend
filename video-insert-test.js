require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log("Testing videos INSERT...");

  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .select("id")
    .limit(1)
    .single();

  if (channelError) {
    console.log("CHANNEL ERROR:");
    console.log(channelError);
    process.exit(1);
  }

  const { data: video, error } = await supabase
    .from("videos")
    .insert({
      channel_id: channel.id,
      title: "__FLICKORA_TEST__",
      description: "Temporary test",
      hashtags: "#test",
      type: "video",
      video_url: "https://example.com/test.mp4",
      thumbnail_url: null,
      views: 0
    })
    .select()
    .single();

  if (error) {
    console.log("VIDEOS INSERT ERROR:");
    console.log(error);
    process.exit(1);
  }

  console.log("VIDEOS INSERT OK:");
  console.log(video);

  const { error: deleteError } = await supabase
    .from("videos")
    .delete()
    .eq("id", video.id);

  if (deleteError) {
    console.log("TEST ROW DELETE ERROR:");
    console.log(deleteError);
    process.exit(1);
  }

  console.log("TEST ROW DELETED");
  console.log("ALL DATABASE TESTS PASSED");
})();
