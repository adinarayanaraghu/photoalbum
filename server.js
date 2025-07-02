import fs from "fs";
import path from "path";
import express from "express";
import multer from "multer";
import mime from "mime-types";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const {
  PORT = 3000,
  GOOGLE_APPLICATION_CREDENTIALS,
  DRIVE_FOLDER_ID,
  MAX_FILE_SIZE_MB = 25,
  ALLOWED_MIME = "image/*",
} = process.env;

if (!GOOGLE_APPLICATION_CREDENTIALS || !DRIVE_FOLDER_ID) {
  console.error("Missing required env vars. Check .env file.");
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});
const drive = google.drive({ version: "v3", auth });

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME === "image/*" && file.mimetype.startsWith("image/")) return cb(null, true);
    if (file.mimetype === ALLOWED_MIME) return cb(null, true);
    cb(new Error("Invalid file type"));
  },
});

const app = express();
app.use(express.static("public"));

app.post("/upload", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const fileMetadata = {
      name: `${Date.now()}-${req.file.originalname}`,
      parents: [DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType: mime.lookup(req.file.originalname) || req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };

    await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id,webViewLink",
    });

    fs.unlinkSync(req.file.path);
    res.json({ status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
