require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log("Testing channels table...");

  const { data, error } = await supabase
    .from("channels")
    .select("id,user_id,name")
    .limit(5);

  if (error) {
    console.log("CHANNELS TABLE ERROR:");
    console.log(error);
    process.exit(1);
  }

  console.log("CHANNELS:");
  console.log(data);
})();
