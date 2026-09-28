require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  dest: "uploads/"
});

app.get("/", (req, res) => {
  res.json({
    name: "Flickora YT",
    status: "Backend is running",
    version: "1.0.0"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Flickora YT backend online"
  });
});

app.post(
  "/api/upload",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 }
  ]),
  (req, res) => {
    res.json({
      success: true,
      message: "Upload endpoint ready",
      title: req.body.title || "",
      type: req.body.type || "video"
    });
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log("================================");
  console.log("       FLICKORA YT");
  console.log("================================");
  console.log(`Server running on port ${PORT}`);
});
