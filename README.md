[한국어](README-KR.md)

# R2 Uploader

**R2 Uploader** is an Obsidian plugin that uploads images to **Cloudflare R2** and automatically replaces local links with remote ones.

> ⚠️ This plugin is **not an officially released Obsidian plugin** — it’s a personal project currently in development.

---

## ✨ Features

- **Automatic Image Upload**: Automatically uploads clipboard images to Cloudflare R2 when pasted
- **Upload Confirmation**: Optional dialog before upload
- **Publish Page**: Uploads all local images in the current note and replaces links automatically
- **Flexible Path Variables**: Supports dynamic paths using variables like `{year}`, `{mon}`, `{day}`, `{filename}`
- **Custom Domain Support**: Use either your `r2.dev` URL or a custom domain

---

## ⚙️ Installation

1. Copy this plugin into your Obsidian plugin folder.
2. Enable it from the Obsidian settings.
3. Enter your Cloudflare R2 account credentials in the plugin settings.

---

## ☁️ Cloudflare R2 Setup

### 1️⃣ Create a Cloudflare Account and R2 Bucket

1. Sign up at [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Enable **R2 Storage** in your Cloudflare dashboard.
3. Create a new **R2 bucket** for storing images.

### 2️⃣ Generate API Credentials

1. Go to **R2 → Overview → Manage R2 API Tokens** in your Cloudflare dashboard.
2. Click **Create API Token**.
3. Grant **Read/Write** permissions.
4. Copy the generated **Access Key ID** and **Secret Access Key**.

### 3️⃣ Configure in Plugin

In the plugin settings, enter the following information:

| Field                 | Description                                     |
| --------------------- | ----------------------------------------------- |
| **Access Key ID**     | Your Cloudflare R2 access key ID                |
| **Secret Access Key** | Your Cloudflare R2 secret access key            |
| **Endpoint**          | `https://<account-id>.r2.cloudflarestorage.com` |
| **Bucket Name**       | The name of your R2 bucket                      |
| **Custom Domain**     | Optional – your `r2.dev` URL or a custom domain |

---

## 🧩 Plugin Settings

| Setting                        | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| **Target Path**                | Image storage path (supports `{year}`, `{mon}`, `{day}`, `{filename}`) |
| **Use image name as Alt Text** | Use the image filename as alt text                                     |
| **Update original document**   | Replace local links with R2 links automatically                        |
| **Ignore note properties**     | Ignore frontmatter/note properties when pasting                        |
| **Show progress modal**        | Display upload progress                                                |
| **Confirm before upload**      | Show a confirmation dialog before uploading                            |

---

## 🖼 Usage

### Automatic Upload

1. Copy an image to your clipboard.
2. Paste it into the Obsidian editor (Ctrl+V).
3. When prompted, choose **“Upload”** or **“Always Upload.”**

### Publish Page

1. Open the command palette (Ctrl+P).
2. Run **“Publish Page to R2.”**
3. All local images in the current note will be uploaded to R2, and their links will be automatically replaced.

---

## 🧱 Development

### Build

```bash
npm run build
```

### Dev Mode

```bash
npm run dev
```

---

## 🙏 Credits

This plugin was heavily inspired by the following open-source projects:

- [**obsidian-imgur-plugin**](https://github.com/gavvvr/obsidian-imgur-plugin)
  → Logic for instant image uploads
- [**obsidian-image-upload-toolkit**](https://github.com/addozhang/obsidian-image-upload-toolkit)
  → Logic for Cloudflare R2 integration

---

## 📄 License

MIT License
