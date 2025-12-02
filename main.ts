import {
  App,
  Editor,
  EditorPosition,
  MarkdownView,
  Modal,
  Notice,
  normalizePath,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from 'obsidian';
import { R2Uploader, R2Setting } from './src/uploader/r2Uploader';
import ImageTagProcessor, { ImageTag } from './src/uploader/imageTagProcessor';

// Helper class to create a copy of paste event for local paste
class PasteEventCopy extends ClipboardEvent {
  constructor(originalEvent: ClipboardEvent) {
    const { files } = originalEvent.clipboardData;
    const dt = new DataTransfer();
    for (const file of files) {
      dt.items.add(file);
    }
    super('paste', { clipboardData: dt });
  }
}

// Generate pseudo random ID for temporary text
const generatePseudoRandomId = (generatedIdLength = 5) => {
  const fullAlphanumericRadix = 36;
  return Array(generatedIdLength)
    .fill(undefined)
    .map(() =>
      ((Math.random() * fullAlphanumericRadix) | 0).toString(fullAlphanumericRadix)
    )
    .join('');
};

// Remember to rename these classes and interfaces!

interface R2UploaderSettings {
  // CloudFlare R2 설정
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucketName: string;
  targetPath: string;
  customDomainName: string;

  // 업로드 설정
  useImageNameAsAltText: boolean;
  updateOriginalDocument: boolean;
  ignoreNoteProperties: boolean;
  showProgressModal: boolean;
  confirmBeforeUpload: boolean;
}

const DEFAULT_SETTINGS: R2UploaderSettings = {
  // CloudFlare R2 설정
  accessKeyId: '',
  secretAccessKey: '',
  endpoint: '',
  bucketName: '',
  targetPath: '/{year}/{mon}/{day}/{filename}',
  customDomainName: '',

  // 업로드 설정
  useImageNameAsAltText: true,
  updateOriginalDocument: true,
  ignoreNoteProperties: true,
  showProgressModal: true,
  confirmBeforeUpload: true,
};

export default class R2UploaderPlugin extends Plugin {
  settings: R2UploaderSettings;
  private r2Uploader: R2Uploader | null = null;
  private static readonly extensionMimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    avif: 'image/avif',
    heic: 'image/heic',
    heif: 'image/heif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    webm: 'video/webm',
    ogg: 'video/ogg',
    ogv: 'video/ogg',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    mpg: 'video/mpeg',
    mpeg: 'video/mpeg',
    mpe: 'video/mpeg',
    m2v: 'video/mpeg',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
  };

  async onload() {
    await this.loadSettings();
    this.setupR2Uploader();

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon(
      'upload',
      'R2 Uploader',
      (_evt: MouseEvent) => {
        // Called when the user clicks the icon.
        new Notice('R2 Uploader Plugin Loaded!');
      }
    );
    // Perform additional things with the ribbon
    ribbonIconEl.addClass('r2-uploader-ribbon-class');

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText('R2 Uploader Ready');

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: 'publish-page-to-r2',
      name: 'Publish Page to R2',
      callback: () => {
        new PublishPageModal(this.app, this).open();
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new R2UploaderSettingTab(this.app, this));

    // Register paste event listener for automatic image upload
    this.registerEvent(
      this.app.workspace.on('editor-paste', this.handlePasteEvent.bind(this))
    );

    // Register drop event listener for automatic image upload
    this.registerEvent(
      this.app.workspace.on('editor-drop', this.handleDropEvent.bind(this))
    );
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.setupR2Uploader();
  }

  private setupR2Uploader() {
    if (
      this.settings.accessKeyId &&
      this.settings.secretAccessKey &&
      this.settings.endpoint &&
      this.settings.bucketName
    ) {
      const r2Setting: R2Setting = {
        accessKeyId: this.settings.accessKeyId,
        secretAccessKey: this.settings.secretAccessKey,
        endpoint: this.settings.endpoint,
        bucketName: this.settings.bucketName,
        path: this.settings.targetPath,
        customDomainName: this.settings.customDomainName,
      };
      this.r2Uploader = new R2Uploader(r2Setting);
    } else {
      this.r2Uploader = null;
    }
  }

  private async handlePasteEvent(
    evt: ClipboardEvent,
    editor: Editor,
    markdownView: MarkdownView
  ) {
    if (evt instanceof PasteEventCopy) return;

    if (!this.r2Uploader) {
      new Notice('R2 Uploader not configured. Please check your settings.');
      return;
    }

    const files: File[] = [];

    // First, check clipboardData.files (used by some browsers when copying images)
    if (evt.clipboardData?.files && evt.clipboardData.files.length > 0) {
      for (let i = 0; i < evt.clipboardData.files.length; i++) {
        const file = evt.clipboardData.files[i];
        if (file.type.startsWith('image/')) {
          // Ensure file has a proper name
          if (!file.name || file.name === 'blob') {
            const extension = file.type.split('/')[1] || 'png';
            const timestamp = Date.now();
            const newFile = new File([file], `Pasted image ${timestamp}.${extension}`, {
              type: file.type,
            });
            files.push(newFile);
          } else {
            files.push(file);
          }
        }
      }
    }

    // Also check clipboardData.items (used by other browsers/scenarios)
    // Check items even if files were found, as some browsers may have data in both
    const clipboardItems = evt.clipboardData?.items;
    if (clipboardItems) {
      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            // Check if we already have this file (avoid duplicates)
            const isDuplicate = files.some(
              f => f.size === file.size && f.type === file.type
            );
            if (isDuplicate) continue;

            // Ensure file has a proper name
            if (!file.name || file.name === 'blob') {
              const extension = item.type.split('/')[1] || 'png';
              const timestamp = Date.now();
              const newFile = new File([file], `Pasted image ${timestamp}.${extension}`, {
                type: item.type,
              });
              files.push(newFile);
            } else {
              files.push(file);
            }
          }
        }
      }
    }

    if (files.length === 0) return;

    evt.preventDefault();

    if (this.settings.confirmBeforeUpload) {
      const modal = new UploadConfirmationModal(this.app, this, files);
      modal.open();

      const userResp = await modal.response();
      switch (userResp.shouldUpload) {
        case undefined:
          return;
        case true:
          if (userResp.alwaysUpload) {
            this.settings.confirmBeforeUpload = false;
            await this.saveSettings();
          }
          break;
        case false:
          markdownView.currentMode.clipboardManager.handlePaste(new PasteEventCopy(evt));
          return;
        default:
          return;
      }
    }

    for (const file of files) {
      this.uploadFileAndEmbedR2Image(file).catch(() => {
        markdownView.currentMode.clipboardManager.handlePaste(new PasteEventCopy(evt));
      });
    }
  }

  private async handleDropEvent(
    evt: DragEvent,
    editor: Editor,
    markdownView: MarkdownView
  ) {
    if (!this.r2Uploader) {
      new Notice('R2 Uploader not configured. Please check your settings.');
      return;
    }

    const files: File[] = [];

    if (evt.dataTransfer?.files) {
      for (let i = 0; i < evt.dataTransfer.files.length; i++) {
        const file = evt.dataTransfer.files[i];
        if (file.type.startsWith('image/')) {
          files.push(file);
        }
      }
    }

    if (files.length === 0) return;

    evt.preventDefault();
    evt.stopPropagation();

    const cursorPos = editor.getCursor();

    if (this.settings.confirmBeforeUpload) {
      const modal = new UploadConfirmationModal(this.app, this, files);
      modal.open();

      const userResp = await modal.response();
      switch (userResp.shouldUpload) {
        case undefined:
          return;
        case true:
          if (userResp.alwaysUpload) {
            this.settings.confirmBeforeUpload = false;
            await this.saveSettings();
          }
          break;
        case false:
          // Let Obsidian handle the drop normally
          return;
        default:
          return;
      }
    }

    for (const file of files) {
      this.uploadFileAndEmbedR2Image(file, cursorPos).catch(error => {
        new Notice(`Failed to upload ${file.name}: ${error.message}`);
      });
    }
  }

  async uploadImage(file: File): Promise<string | null> {
    if (!this.r2Uploader) {
      new Notice('R2 Uploader not configured. Please check your settings.');
      return null;
    }

    try {
      new Notice(`Uploading ${file.name} to R2...`);
      const url = await this.r2Uploader.upload(file, '');
      new Notice(`Uploaded: ${url}`);
      return url;
    } catch (error) {
      new Notice(`Upload failed: ${error.message}`);
      return null;
    }
  }

  async uploadImages(files: File[]): Promise<string[]> {
    const urls: string[] = [];

    for (const file of files) {
      const url = await this.uploadImage(file);
      if (url) {
        urls.push(url);
      }
    }

    return urls;
  }

  private async uploadFileAndEmbedR2Image(
    file: File,
    atPos?: EditorPosition
  ): Promise<string> {
    const pasteId = generatePseudoRandomId();
    this.insertTemporaryText(pasteId, atPos);

    let imgUrl: string;
    try {
      imgUrl = await this.uploadImage(file);
      if (!imgUrl) {
        throw new Error('Upload failed');
      }
    } catch (e) {
      this.handleFailedUpload(pasteId, `Upload failed: ${e.message}`);
      throw e;
    }

    this.embedMarkDownImage(pasteId, imgUrl, file);
    return imgUrl;
  }

  private insertTemporaryText(pasteId: string, atPos?: EditorPosition) {
    const progressText = R2UploaderPlugin.progressTextFor(pasteId);
    const replacement = `${progressText}\n`;
    const editor = this.activeEditor;
    if (atPos) {
      editor.replaceRange(replacement, atPos, atPos);
    } else {
      editor.replaceSelection(replacement);
    }
  }

  private static progressTextFor(id: string) {
    return `![Uploading file...${id}]()`;
  }

  private static mimeTypeFromExtension(extension: string): string {
    if (!extension) return 'application/octet-stream';
    const lower = extension.toLowerCase();
    return this.extensionMimeMap[lower] || 'application/octet-stream';
  }

  private embedMarkDownImage(pasteId: string, imageUrl: string, file: File) {
    const progressText = R2UploaderPlugin.progressTextFor(pasteId);

    const isVideo =
      file.type?.startsWith('video/') ||
      ImageTagProcessor.isVideoAsset(file.name) ||
      ImageTagProcessor.isVideoAsset(imageUrl);

    const embedTag = isVideo ? `<video controls src="${imageUrl}"></video>` : `![](${imageUrl})`;

    this.replaceFirstOccurrence(this.activeEditor, progressText, embedTag);
  }

  private generateUniqueFileName(originalName: string): string {
    const now = new Date();
    const timestamp =
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0') +
      now.getMilliseconds().toString().padStart(3, '0');

    // Extract file extension
    const extension = originalName.split('.').pop() || 'png';

    // If the original name is generic (like 'image'), use timestamp-based name
    if (originalName.toLowerCase().includes('image') || originalName === 'blob') {
      return `Pasted image ${timestamp}.${extension}`;
    }

    // For other cases, keep original name but add timestamp if needed
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExt} ${timestamp}.${extension}`;
  }

  private handleFailedUpload(pasteId: string, message: string) {
    const progressText = R2UploaderPlugin.progressTextFor(pasteId);
    this.replaceFirstOccurrence(this.activeEditor, progressText, `<!--${message}-->`);
  }

  private replaceFirstOccurrence(
    editor: Editor,
    searchText: string,
    replacement: string
  ) {
    const content = editor.getValue();
    const index = content.indexOf(searchText);
    if (index !== -1) {
      const start = editor.offsetToPos(index);
      const end = editor.offsetToPos(index + searchText.length);
      editor.replaceRange(replacement, start, end);
    }
  }

  private get activeEditor(): Editor {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    return mdView.editor;
  }

  async uploadImagesAndInsert(files: File[]): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      new Notice('No active markdown view found.');
      return;
    }

    const editor = activeView.editor;
    const uploads: { url: string; file: File }[] = [];

    for (const file of files) {
      const url = await this.uploadImage(file);
      if (url) {
        uploads.push({ url, file });
      }
    }

    if (uploads.length > 0) {
      // Generate image/video tags with actual uploaded URLs
      const mediaTags = uploads.map(({ url, file }) => {
        const isVideo =
          file.type?.startsWith('video/') ||
          ImageTagProcessor.isVideoAsset(file.name) ||
          ImageTagProcessor.isVideoAsset(url);
        return isVideo ? `<video controls src="${url}"></video>` : `![](${url})`;
      });

      // Insert image tags at cursor position
      const cursor = editor.getCursor();
      const embedText = mediaTags.join('\n');
      editor.replaceRange(embedText, cursor, cursor);

      // Move cursor after inserted content
      const newCursor = {
        line: cursor.line + mediaTags.length - 1,
        ch: editor.getLine(cursor.line + mediaTags.length - 1).length,
      };
      editor.setCursor(newCursor);
    }
  }

  async publishPageToR2(): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      new Notice('No active markdown view found.');
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const imageTags = ImageTagProcessor.extractImageTags(content);

    if (imageTags.length === 0) {
      new Notice('No images found in the current note.');
      return;
    }

    // Filter local images only
    const localImageTags = imageTags.filter(tag =>
      ImageTagProcessor.isLocalImage(tag.imagePath)
    );

    if (localImageTags.length === 0) {
      new Notice('No local images found in the current note.');
      return;
    }

    new Notice(`Found ${localImageTags.length} local images to upload.`);

    let updatedContent = content;
    let successCount = 0;
    let errorCount = 0;
    const replacements: { originalText: string; newUrl: string }[] = [];

    // First, upload all images and collect replacements
    for (const imageTag of localImageTags) {
      try {
        // Resolve the image path using the same logic as obsidian-image-upload-toolkit
        const { resolvedPath } = ImageTagProcessor.resolveImagePath(
          imageTag.imagePath,
          this.app
        );
        const normalizedPath = normalizePath(resolvedPath);

        // Get the file from vault using the resolved path
        const file = this.app.vault.getAbstractFileByPath(normalizedPath) as TFile;
        if (!file) {
          new Notice(
            `File not found: ${imageTag.imagePath} (resolved to: ${normalizedPath})`
          );
          errorCount++;
          continue;
        }

        // Read file content
        const fileContent = await this.app.vault.readBinary(file);

        // Determine MIME type from file extension
        const extension = file.extension?.toLowerCase() || '';
        const mimeType = R2UploaderPlugin.mimeTypeFromExtension(extension);

        // Create a File object from the binary data
        const blob = new Blob([fileContent], { type: mimeType });
        const fileObj = new File([blob], file.name, { type: mimeType });

        // Upload to R2
        const url = await this.uploadImage(fileObj);
        if (url) {
          // Collect replacement information
          replacements.push({
            originalText: imageTag.originalText,
            newUrl: url,
          });
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        new Notice(`Failed to upload ${imageTag.imagePath}: ${error.message}`);
        errorCount++;
      }
    }

    // Now apply all replacements using replaceAll (like obsidian-image-upload-toolkit)
    for (const replacement of replacements) {
      // Generate alt text from filename (like obsidian-image-upload-toolkit)
      let fileName = '';

      // Extract filename from wiki link: ![[filename.png]]
      if (
        replacement.originalText.startsWith('![[') &&
        replacement.originalText.endsWith(']]')
      ) {
        fileName = replacement.originalText.slice(3, -2); // Remove ![[ and ]]
      }
      // Extract filename from markdown image: ![alt](filename.png)
      else {
        const pathMatch = replacement.originalText.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (pathMatch) {
          fileName = pathMatch[2];
        }
      }

      const altText =
        this.settings.useImageNameAsAltText && fileName
          ? fileName
              .replace(/\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff|tif)$/i, '')
              .replaceAll('-', ' ')
              .replaceAll('_', ' ')
          : '';

      // Use replaceAll for safety (like obsidian-image-upload-toolkit)
      const isVideo =
        ImageTagProcessor.isVideoAsset(fileName) ||
        ImageTagProcessor.isVideoAsset(replacement.newUrl);

      const newImageTag = isVideo
        ? `<video controls src="${replacement.newUrl}"></video>`
        : `![${altText}](${replacement.newUrl})`;
      updatedContent = updatedContent.replaceAll(replacement.originalText, newImageTag);
    }

    // Update the editor content
    if (successCount > 0) {
      editor.setValue(updatedContent);
      new Notice(`Successfully uploaded ${successCount} images. ${errorCount} failed.`);
    } else {
      new Notice(`Failed to upload any images. ${errorCount} errors.`);
    }
  }
}

class UploadConfirmationModal extends Modal {
  plugin: R2UploaderPlugin;
  files: File[];
  private userResponded = false;
  private deferredResolve: (value: UploadConfirmationResponse) => void;
  private resp = new Promise<UploadConfirmationResponse>(resolve => {
    this.deferredResolve = resolve;
  });

  constructor(app: App, plugin: R2UploaderPlugin, files: File[]) {
    super(app);
    this.plugin = plugin;
    this.files = files;
  }

  async response(): Promise<UploadConfirmationResponse> {
    return this.resp;
  }

  onOpen() {
    this.titleEl.setText('R2 Uploader');

    const fileNames = this.files.map(f => f.name).join(', ');
    const message =
      this.files.length === 1
        ? `Would you like to upload "${fileNames}" to Cloudflare R2 or paste your content locally?`
        : `Would you like to upload ${this.files.length} images (${fileNames}) to Cloudflare R2 or paste your content locally?`;

    this.contentEl.setText(message);

    const buttonContainer = this.modalEl.createDiv('modal-button-container');

    const alwaysUploadButton = buttonContainer.createEl('button', {
      text: 'Always Upload',
    });
    alwaysUploadButton.addClass('mod-cta');
    alwaysUploadButton.onclick = () => {
      this.deferredResolve({ shouldUpload: true, alwaysUpload: true });
      this.afterUserInput();
    };

    const uploadButton = buttonContainer.createEl('button', { text: 'Upload' });
    uploadButton.addClass('mod-cta');
    uploadButton.onclick = () => {
      this.deferredResolve({ shouldUpload: true });
      this.afterUserInput();
    };

    const pasteLocallyButton = buttonContainer.createEl('button', {
      text: 'Paste Locally',
    });
    pasteLocallyButton.onclick = () => {
      this.deferredResolve({ shouldUpload: false });
      this.afterUserInput();
    };
  }

  private afterUserInput() {
    this.userResponded = true;
    this.close();
  }

  onClose() {
    if (!this.userResponded) this.deferredResolve({ shouldUpload: undefined });
    const { contentEl } = this;
    contentEl.empty();
  }
}

interface UploadConfirmationResponse {
  shouldUpload: boolean | undefined;
  alwaysUpload?: boolean;
}

class PublishPageModal extends Modal {
  plugin: R2UploaderPlugin;

  constructor(app: App, plugin: R2UploaderPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Publish Page to R2' });
    contentEl.createEl('p', {
      text: 'This will upload all local images in the current note to Cloudflare R2 and replace the links.',
    });

    const buttonContainer = contentEl.createDiv();
    buttonContainer.addClass('r2-uploader-button-container');

    const publishButton = buttonContainer.createEl('button', { text: 'Publish to R2' });
    publishButton.addClass('mod-cta');
    publishButton.onclick = async () => {
      this.close();
      await this.plugin.publishPageToR2();
    };

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.onclick = () => {
      this.close();
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class R2UploaderSettingTab extends PluginSettingTab {
  plugin: R2UploaderPlugin;

  constructor(app: App, plugin: R2UploaderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h1', { text: 'Upload Settings' });

    // 일반 업로드 설정
    new Setting(containerEl)
      .setName('Use image name as Alt Text')
      .setDesc(
        "Whether to use image name as Alt Text with '-' and '_' replaced with space."
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.useImageNameAsAltText)
          .onChange(async value => {
            this.plugin.settings.useImageNameAsAltText = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Update original document')
      .setDesc('Whether to replace internal link with store link.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.updateOriginalDocument)
          .onChange(async value => {
            this.plugin.settings.updateOriginalDocument = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Ignore note properties')
      .setDesc(
        "Where to ignore note properties when copying to clipboard. This won't affect original note."
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.ignoreNoteProperties)
          .onChange(async value => {
            this.plugin.settings.ignoreNoteProperties = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show progress modal')
      .setDesc(
        'Show a modal dialog with detailed progress when uploading images (auto close in 3s). If disabled, a simpler status indicator will be used.'
      )
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.showProgressModal).onChange(async value => {
          this.plugin.settings.showProgressModal = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Confirm before upload')
      .setDesc('Show confirmation dialog before uploading images.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.confirmBeforeUpload)
          .onChange(async value => {
            this.plugin.settings.confirmBeforeUpload = value;
            await this.plugin.saveSettings();
          })
      );

    // CloudFlare R2 설정
    containerEl.createEl('h2', { text: 'CloudFlare R2 Settings' });

    new Setting(containerEl)
      .setName('Cloudflare R2 Access Key ID')
      .setDesc('Your Cloudflare R2 access key ID')
      .addText(text =>
        text
          .setPlaceholder('Enter your access key ID')
          .setValue(this.plugin.settings.accessKeyId)
          .onChange(async value => {
            this.plugin.settings.accessKeyId = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Cloudflare R2 Secret Access Key')
      .setDesc('Your Cloudflare R2 secret access key')
      .addText(text =>
        text
          .setPlaceholder('Enter your secret access key')
          .setValue(this.plugin.settings.secretAccessKey)
          .onChange(async value => {
            this.plugin.settings.secretAccessKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Cloudflare R2 Endpoint')
      .setDesc(
        'Your Cloudflare R2 endpoint URL (e.g., https://account-id.r2.cloudflarestorage.com)'
      )
      .addText(text =>
        text
          .setPlaceholder('Enter your R2 endpoint')
          .setValue(this.plugin.settings.endpoint)
          .onChange(async value => {
            this.plugin.settings.endpoint = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Cloudflare R2 Bucket Name')
      .setDesc('Your Cloudflare R2 bucket name')
      .addText(text =>
        text
          .setPlaceholder('Enter your bucket name')
          .setValue(this.plugin.settings.bucketName)
          .onChange(async value => {
            this.plugin.settings.bucketName = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Target Path')
      .setDesc(
        'The path to store image.\\nSupport {year} {mon} {day} {random} {filename} vars. For example, /{year}/{mon}/{day}/{filename} with uploading pic.jpg, it will store as /2023/06/08/pic.jpg.'
      )
      .addText(text =>
        text
          .setPlaceholder('Enter path')
          .setValue(this.plugin.settings.targetPath)
          .onChange(async value => {
            this.plugin.settings.targetPath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('R2.dev URL, Custom Domain Name')
      .setDesc(
        'You can use the R2.dev URL such as https://pub-xxxx.r2.dev here, or custom domain. If the custom domain name is example.com, you can use https://example.com/pic.jpg to access pic.img.'
      )
      .addText(text =>
        text
          .setPlaceholder('Enter domain name')
          .setValue(this.plugin.settings.customDomainName)
          .onChange(async value => {
            this.plugin.settings.customDomainName = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
