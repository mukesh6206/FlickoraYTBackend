require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log("Testing videos table...");

  const { data, error } = await supabase
    .from("videos")
    .select("id")
    .limit(1);

  if (error) {
    console.log("VIDEOS TABLE ERROR:");
    console.log(error);
    process.exit(1);
  }

  console.log("VIDEOS TABLE SELECT OK:");
  console.log(data);
})();
