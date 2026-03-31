import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import FormData from "form-data";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔧 CONFIG
const UPLOAD_URL = "https://your-api.com/upload"; // change this
const ROOT_DIR = __dirname;

// 📂 Get ALL files recursively
function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath));
    } else {
      results.push(filePath);
    }
  }

  return results;
}

// 🚀 Upload function
async function uploadAll() {
  const files = getAllFiles(ROOT_DIR);

  console.log(`📦 Found ${files.length} files. Uploading...`);

  for (const file of files) {
    try {
      const form = new FormData();
      form.append("file", fs.createReadStream(file));
      form.append("path", path.relative(ROOT_DIR, file));

      const res = await fetch(UPLOAD_URL, {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
      });

      if (!res.ok) {
        console.log(`❌ Failed: ${file}`);
        continue;
      }

      console.log(`✅ Uploaded: ${file}`);
    } catch (err) {
      console.log(`💥 Error: ${file}`, err.message);
    }
  }

  console.log("🚀 Done uploading EVERYTHING.");
}

uploadAll();
