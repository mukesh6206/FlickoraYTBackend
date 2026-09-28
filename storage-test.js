require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log("Testing videos bucket...");

  const testData = Buffer.from("Flickora storage test");

  const { data, error } = await supabase.storage
    .from("videos")
    .upload(
      `__test__/storage-test-${Date.now()}.txt`,
      testData,
      {
        contentType: "text/plain",
        upsert: false
      }
    );

  if (error) {
    console.log("VIDEO STORAGE ERROR:");
    console.log(error);
    process.exit(1);
  }

  console.log("VIDEO STORAGE OK:");
  console.log(data);

  console.log("Testing thumbnails bucket...");

  const { data: thumbData, error: thumbError } =
    await supabase.storage
      .from("thumbnails")
      .upload(
        `__test__/thumbnail-test-${Date.now()}.txt`,
        testData,
        {
          contentType: "text/plain",
          upsert: false
        }
      );

  if (thumbError) {
    console.log("THUMBNAIL STORAGE ERROR:");
    console.log(thumbError);
    process.exit(1);
  }

  console.log("THUMBNAIL STORAGE OK:");
  console.log(thumbData);

  console.log("ALL STORAGE TESTS PASSED");
})();
