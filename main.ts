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
  TFolder,
  TAbstractFile,
  Menu,
} from 'obsidian';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
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

type Language = 'en' | 'ko';

interface Translations {
  // General
  pluginName: string;
  pluginLoaded: string;
  pluginReady: string;
  notConfigured: string;
  
  // Commands
  publishPageToR2: string;
  publishCurrentFolderToR2: string;
  publishEntireVaultToR2: string;
  publishSelectedFilesToR2: string;
  
  // Upload
  uploading: string;
  uploaded: string;
  uploadFailed: string;
  downloadExternalImage: string;
  
  // Messages
  noActiveMarkdownView: string;
  noActiveFile: string;
  noActiveFileParent: string;
  noMarkdownFilesSelected: string;
  noMarkdownFilesInFolder: string;
  noMarkdownFilesInVault: string;
  noImagesFound: string;
  noImagesToUpload: string;
  noLocalImagesFound: string;
  foundImages: string;
  startingUpload: string;
  finishedUpload: string;
  failedToProcess: string;
  fileNotFound: string;
  failedToUpload: string;
  failedToDownloadUpload: string;
  successfullyUploaded: string;
  failedToUploadAny: string;
  
  // Modals
  r2Uploader: string;
  uploadConfirmationSingle: string;
  uploadConfirmationMultiple: string;
  alwaysUpload: string;
  upload: string;
  pasteLocally: string;
  publishPageToR2Title: string;
  publishPageToR2Desc: string;
  publishToR2: string;
  cancel: string;
  
  // Settings
  uploadSettings: string;
  useImageNameAsAltText: string;
  useImageNameAsAltTextDesc: string;
  updateOriginalDocument: string;
  updateOriginalDocumentDesc: string;
  ignoreNoteProperties: string;
  ignoreNotePropertiesDesc: string;
  showProgressModal: string;
  showProgressModalDesc: string;
  confirmBeforeUpload: string;
  confirmBeforeUploadDesc: string;
  downloadExternalImages: string;
  downloadExternalImagesDesc: string;
  language: string;
  languageDesc: string;
  cloudflareR2Settings: string;
  cloudflareR2AccessKeyID: string;
  cloudflareR2AccessKeyIDDesc: string;
  cloudflareR2SecretAccessKey: string;
  cloudflareR2SecretAccessKeyDesc: string;
  cloudflareR2Endpoint: string;
  cloudflareR2EndpointDesc: string;
  cloudflareR2BucketName: string;
  cloudflareR2BucketNameDesc: string;
  targetPath: string;
  targetPathDesc: string;
  r2devUrlCustomDomain: string;
  r2devUrlCustomDomainDesc: string;
}

const translations: Record<Language, Translations> = {
  en: {
    pluginName: 'R2 Uploader',
    pluginLoaded: 'R2 Uploader Plugin Loaded!',
    pluginReady: 'R2 Uploader Ready',
    notConfigured: 'R2 Uploader not configured. Please check your settings.',
    publishPageToR2: 'Publish Page to R2',
    publishCurrentFolderToR2: 'Publish Current Folder to R2',
    publishEntireVaultToR2: 'Publish Entire Vault to R2',
    publishSelectedFilesToR2: 'Publish Selected Files to R2',
    uploading: 'Uploading',
    uploaded: 'Uploaded',
    uploadFailed: 'Upload failed',
    downloadExternalImage: 'Downloading external image',
    noActiveMarkdownView: 'No active markdown view found.',
    noActiveFile: 'No active file found.',
    noActiveFileParent: 'Active file has no parent folder.',
    noMarkdownFilesSelected: 'No markdown files selected.',
    noMarkdownFilesInFolder: 'No markdown files found in the current folder.',
    noMarkdownFilesInVault: 'No markdown files found in the vault.',
    noImagesFound: 'No images found',
    noImagesToUpload: 'No images found to upload',
    noLocalImagesFound: 'No local images found',
    foundImages: 'Found {local} local and {external} external images to upload',
    startingUpload: 'Starting R2 upload',
    finishedUpload: 'Finished uploading images',
    failedToProcess: 'Failed to process',
    fileNotFound: 'File not found',
    failedToUpload: 'Failed to upload',
    failedToDownloadUpload: 'Failed to download/upload external image',
    successfullyUploaded: 'Successfully uploaded {count} images',
    failedToUploadAny: 'Failed to upload any images',
    r2Uploader: 'R2 Uploader',
    uploadConfirmationSingle: 'Would you like to upload "{fileName}" to Cloudflare R2 or paste your content locally?',
    uploadConfirmationMultiple: 'Would you like to upload {count} images ({fileNames}) to Cloudflare R2 or paste your content locally?',
    alwaysUpload: 'Always Upload',
    upload: 'Upload',
    pasteLocally: 'Paste Locally',
    publishPageToR2Title: 'Publish Page to R2',
    publishPageToR2Desc: 'This will upload all local images in the current note to Cloudflare R2 and replace the links.',
    publishToR2: 'Publish to R2',
    cancel: 'Cancel',
    uploadSettings: 'Upload Settings',
    useImageNameAsAltText: 'Use image name as Alt Text',
    useImageNameAsAltTextDesc: "Whether to use image name as Alt Text with '-' and '_' replaced with space.",
    updateOriginalDocument: 'Update original document',
    updateOriginalDocumentDesc: 'Whether to replace internal link with store link.',
    ignoreNoteProperties: 'Ignore note properties',
    ignoreNotePropertiesDesc: "Where to ignore note properties when copying to clipboard. This won't affect original note.",
    showProgressModal: 'Show progress modal',
    showProgressModalDesc: 'Show a modal dialog with detailed progress when uploading images (auto close in 3s). If disabled, a simpler status indicator will be used.',
    confirmBeforeUpload: 'Confirm before upload',
    confirmBeforeUploadDesc: 'Show confirmation dialog before uploading images.',
    downloadExternalImages: 'Download external images',
    downloadExternalImagesDesc: 'Download external images (http/https URLs) and upload them to R2. When enabled, external image URLs will be downloaded and replaced with R2 URLs.',
    language: 'Language',
    languageDesc: 'Select the language for the plugin interface.',
    cloudflareR2Settings: 'CloudFlare R2 Settings',
    cloudflareR2AccessKeyID: 'Cloudflare R2 Access Key ID',
    cloudflareR2AccessKeyIDDesc: 'Your Cloudflare R2 access key ID',
    cloudflareR2SecretAccessKey: 'Cloudflare R2 Secret Access Key',
    cloudflareR2SecretAccessKeyDesc: 'Your Cloudflare R2 secret access key',
    cloudflareR2Endpoint: 'Cloudflare R2 Endpoint',
    cloudflareR2EndpointDesc: 'Your Cloudflare R2 endpoint URL (e.g., https://account-id.r2.cloudflarestorage.com)',
    cloudflareR2BucketName: 'Cloudflare R2 Bucket Name',
    cloudflareR2BucketNameDesc: 'Your Cloudflare R2 bucket name',
    targetPath: 'Target Path',
    targetPathDesc: 'The path to store image.\\nSupport {year} {mon} {day} {random} {filename} vars. For example, /{year}/{mon}/{day}/{filename} with uploading pic.jpg, it will store as /2023/06/08/pic.jpg.',
    r2devUrlCustomDomain: 'R2.dev URL, Custom Domain Name',
    r2devUrlCustomDomainDesc: 'You can use the R2.dev URL such as https://pub-xxxx.r2.dev here, or custom domain. If the custom domain name is example.com, you can use https://example.com/pic.jpg to access pic.img.',
  },
  ko: {
    pluginName: 'R2 업로더',
    pluginLoaded: 'R2 업로더 플러그인이 로드되었습니다!',
    pluginReady: 'R2 업로더 준비됨',
    notConfigured: 'R2 업로더가 설정되지 않았습니다. 설정을 확인해주세요.',
    publishPageToR2: '현재 페이지를 R2에 게시',
    publishCurrentFolderToR2: '현재 폴더를 R2에 게시',
    publishEntireVaultToR2: '전체 볼트를 R2에 게시',
    publishSelectedFilesToR2: '선택한 파일을 R2에 게시',
    uploading: '업로드 중',
    uploaded: '업로드 완료',
    uploadFailed: '업로드 실패',
    downloadExternalImage: '외부 이미지 다운로드 중',
    noActiveMarkdownView: '활성 마크다운 뷰를 찾을 수 없습니다.',
    noActiveFile: '활성 파일을 찾을 수 없습니다.',
    noActiveFileParent: '활성 파일에 상위 폴더가 없습니다.',
    noMarkdownFilesSelected: '선택한 마크다운 파일이 없습니다.',
    noMarkdownFilesInFolder: '현재 폴더에서 마크다운 파일을 찾을 수 없습니다.',
    noMarkdownFilesInVault: '볼트에서 마크다운 파일을 찾을 수 없습니다.',
    noImagesFound: '이미지를 찾을 수 없습니다',
    noImagesToUpload: '업로드할 이미지를 찾을 수 없습니다',
    noLocalImagesFound: '로컬 이미지를 찾을 수 없습니다',
    foundImages: '로컬 이미지 {local}개와 외부 이미지 {external}개를 찾았습니다',
    startingUpload: 'R2 업로드 시작',
    finishedUpload: '이미지 업로드 완료',
    failedToProcess: '처리 실패',
    fileNotFound: '파일을 찾을 수 없습니다',
    failedToUpload: '업로드 실패',
    failedToDownloadUpload: '외부 이미지 다운로드/업로드 실패',
    successfullyUploaded: '{count}개의 이미지를 성공적으로 업로드했습니다',
    failedToUploadAny: '이미지 업로드에 실패했습니다',
    r2Uploader: 'R2 업로더',
    uploadConfirmationSingle: '"{fileName}"을(를) Cloudflare R2에 업로드하시겠습니까? 아니면 로컬에 붙여넣으시겠습니까?',
    uploadConfirmationMultiple: '{count}개의 이미지({fileNames})를 Cloudflare R2에 업로드하시겠습니까? 아니면 로컬에 붙여넣으시겠습니까?',
    alwaysUpload: '항상 업로드',
    upload: '업로드',
    pasteLocally: '로컬에 붙여넣기',
    publishPageToR2Title: '현재 페이지를 R2에 게시',
    publishPageToR2Desc: '현재 노트의 모든 로컬 이미지를 Cloudflare R2에 업로드하고 링크를 교체합니다.',
    publishToR2: 'R2에 게시',
    cancel: '취소',
    uploadSettings: '업로드 설정',
    useImageNameAsAltText: '이미지 이름을 Alt 텍스트로 사용',
    useImageNameAsAltTextDesc: "이미지 이름을 Alt 텍스트로 사용할지 여부. '-'와 '_'는 공백으로 대체됩니다.",
    updateOriginalDocument: '원본 문서 업데이트',
    updateOriginalDocumentDesc: '내부 링크를 저장소 링크로 교체할지 여부.',
    ignoreNoteProperties: '노트 속성 무시',
    ignoreNotePropertiesDesc: '클립보드에 복사할 때 노트 속성을 무시할지 여부. 원본 노트에는 영향을 주지 않습니다.',
    showProgressModal: '진행 상황 모달 표시',
    showProgressModalDesc: '이미지 업로드 시 상세 진행 상황을 모달 대화상자로 표시합니다 (3초 후 자동 닫힘). 비활성화하면 더 간단한 상태 표시기를 사용합니다.',
    confirmBeforeUpload: '업로드 전 확인',
    confirmBeforeUploadDesc: '이미지 업로드 전 확인 대화상자를 표시합니다.',
    downloadExternalImages: '외부 이미지 다운로드',
    downloadExternalImagesDesc: '외부 이미지(http/https URL)를 다운로드하여 R2에 업로드합니다. 활성화하면 외부 이미지 URL이 다운로드되어 R2 URL로 교체됩니다.',
    language: '언어',
    languageDesc: '플러그인 인터페이스의 언어를 선택합니다.',
    cloudflareR2Settings: 'CloudFlare R2 설정',
    cloudflareR2AccessKeyID: 'Cloudflare R2 액세스 키 ID',
    cloudflareR2AccessKeyIDDesc: 'Cloudflare R2 액세스 키 ID',
    cloudflareR2SecretAccessKey: 'Cloudflare R2 시크릿 액세스 키',
    cloudflareR2SecretAccessKeyDesc: 'Cloudflare R2 시크릿 액세스 키',
    cloudflareR2Endpoint: 'Cloudflare R2 엔드포인트',
    cloudflareR2EndpointDesc: 'Cloudflare R2 엔드포인트 URL (예: https://account-id.r2.cloudflarestorage.com)',
    cloudflareR2BucketName: 'Cloudflare R2 버킷 이름',
    cloudflareR2BucketNameDesc: 'Cloudflare R2 버킷 이름',
    targetPath: '저장 경로',
    targetPathDesc: '이미지를 저장할 경로.\\n{year} {mon} {day} {random} {filename} 변수를 지원합니다. 예를 들어, /{year}/{mon}/{day}/{filename}로 설정하고 pic.jpg를 업로드하면 /2023/06/08/pic.jpg로 저장됩니다.',
    r2devUrlCustomDomain: 'R2.dev URL, 사용자 정의 도메인 이름',
    r2devUrlCustomDomainDesc: '여기에 https://pub-xxxx.r2.dev와 같은 R2.dev URL을 사용하거나 사용자 정의 도메인을 사용할 수 있습니다. 사용자 정의 도메인 이름이 example.com인 경우 https://example.com/pic.jpg를 사용하여 pic.img에 액세스할 수 있습니다.',
  },
};

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
  downloadExternalImages: boolean;
  language: Language;
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
  downloadExternalImages: false,
  language: 'en',
};

export default class R2UploaderPlugin extends Plugin {
  settings: R2UploaderSettings;
  
  // Translation helper function
  t(key: keyof Translations, params?: Record<string, string | number>): string {
    const lang = this.settings.language || 'en';
    let text = translations[lang][key] || translations['en'][key];
    
    // Replace placeholders like {count}, {local}, etc.
    if (params) {
      Object.keys(params).forEach(param => {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(params[param]));
      });
    }
    
    return text;
  }
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
      this.t('pluginName'),
      (_evt: MouseEvent) => {
        // Called when the user clicks the icon.
        new Notice(this.t('pluginLoaded'));
      }
    );
    // Perform additional things with the ribbon
    ribbonIconEl.addClass('r2-uploader-ribbon-class');

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText(this.t('pluginReady'));

    // This adds simple commands that can be triggered anywhere
    this.addCommand({
      id: 'publish-page-to-r2',
      name: this.t('publishPageToR2'),
      callback: () => {
        new PublishPageModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'publish-current-folder-to-r2',
      name: this.t('publishCurrentFolderToR2'),
      callback: () => {
        this.publishCurrentFolderToR2();
      },
    });

    this.addCommand({
      id: 'publish-vault-to-r2',
      name: this.t('publishEntireVaultToR2'),
      callback: () => {
        this.publishVaultToR2();
      },
    });

    // Add context menu items for publishing from the file explorer
    // Single file/folder context menu
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
        if (!(file instanceof TFile) && !(file instanceof TFolder)) return;

        menu.addItem(item => {
          item
            .setTitle(this.t('publishSelectedFilesToR2'))
            .setIcon('upload')
            .onClick(async () => {
              const fallbackFile = file instanceof TFile ? file : null;
              const files = this.getSelectedMarkdownFiles(fallbackFile);
              await this.publishSelectedFilesToR2(files);
            });
        });
      })
    );

    // Multi-file selection context menu (like Multi Properties)
    this.registerEvent(
      this.app.workspace.on('files-menu', (menu: Menu, files: TAbstractFile[]) => {
        const markdownFiles = files.filter(
          f => f instanceof TFile && (f as TFile).extension === 'md'
        ) as TFile[];
        if (markdownFiles.length === 0) return;

        menu.addItem(item => {
          item
            .setTitle(this.t('publishSelectedFilesToR2'))
            .setIcon('upload')
            .onClick(async () => {
              await this.publishSelectedFilesToR2(markdownFiles);
            });
        });
      })
    );

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
      new Notice(this.t('notConfigured'));
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
      new Notice(this.t('notConfigured'));
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
      new Notice(this.t('notConfigured'));
      return null;
    }

    try {
      new Notice(`${this.t('uploading')} ${file.name} to R2...`);
      const url = await this.r2Uploader.upload(file, '');
      new Notice(`${this.t('uploaded')}: ${url}`);
      return url;
    } catch (error) {
      new Notice(`${this.t('uploadFailed')}: ${error.message}`);
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

  /**
   * Get currently selected markdown files in the file explorer.
   * If selection cannot be determined, fall back to the provided single file.
   */
  private getSelectedMarkdownFiles(fallback: TFile | null): TFile[] {
    try {
      const leaves = this.app.workspace.getLeavesOfType('file-explorer');
      if (leaves.length > 0) {
        const view: any = leaves[0].view;
        if (view?.getSelection) {
          const selection = view.getSelection() as TFile[];
          const markdownFiles = selection.filter(f => f.extension === 'md');
          if (markdownFiles.length > 0) {
            return markdownFiles;
          }
        }
      }
    } catch (_) {
      // ignore errors and fall back to single file
    }

    return fallback && fallback.extension === 'md' ? [fallback] : [];
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
      new Notice(this.t('noActiveMarkdownView'));
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

  /**
   * Download external image from URL and convert to File object
   * Uses Node.js https/http modules to avoid CORS issues in Electron
   */
  private async downloadExternalImage(url: string): Promise<File | null> {
    return new Promise((resolve, reject) => {
      try {
        new Notice(`${this.t('downloadExternalImage')}: ${url.substring(0, 50)}...`);
        
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 60000, // 60초 타임아웃
        };
        
        const chunks: Buffer[] = [];
        let contentType = '';
        let statusCode = 0;
        let statusMessage = '';
        
        const req = httpModule.request(options, (res) => {
          statusCode = res.statusCode || 0;
          statusMessage = res.statusMessage || '';
          
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`HTTP ${statusCode}: ${statusMessage}`));
            return;
          }
          
          contentType = res.headers['content-type'] || '';
          
          // Check if it's actually an image
          if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
            reject(new Error(`Not an image/video: ${contentType}`));
            return;
          }
          
          // Check content-length for size limit
          const contentLength = res.headers['content-length'];
          const maxSize = 50 * 1024 * 1024; // 50MB
          if (contentLength && parseInt(contentLength) > maxSize) {
            reject(new Error(`File too large: ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB (max 50MB)`));
            return;
          }
          
          res.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
            
            // Check accumulated size
            const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            if (totalSize > maxSize) {
              req.destroy();
              reject(new Error(`File too large: ${(totalSize / 1024 / 1024).toFixed(2)}MB (max 50MB)`));
            }
          });
          
          res.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks);
              
              // Get file extension from URL or Content-Type
              const urlPath = urlObj.pathname;
              let extension = urlPath.split('.').pop()?.toLowerCase() || '';
              
              // Remove query parameters from extension
              extension = extension.split('?')[0].split('#')[0];
              
              // If no extension, try to get from Content-Type
              if (!extension || extension.length > 5) {
                const mimeToExt: Record<string, string> = {
                  'image/jpeg': 'jpg',
                  'image/jpg': 'jpg',
                  'image/png': 'png',
                  'image/gif': 'gif',
                  'image/webp': 'webp',
                  'image/svg+xml': 'svg',
                  'image/bmp': 'bmp',
                  'image/tiff': 'tiff',
                  'video/mp4': 'mp4',
                  'video/webm': 'webm',
                };
                extension = mimeToExt[contentType] || 'png';
              }
              
              // Generate filename from URL
              const urlFileName = urlPath.split('/').pop() || 'image';
              const cleanFileName = urlFileName.split('?')[0].split('#')[0];
              const fileName = cleanFileName && cleanFileName.includes('.') 
                ? cleanFileName 
                : `downloaded_image_${Date.now()}.${extension}`;
              
              // Create File object from Buffer
              const blob = new Blob([buffer], { type: contentType });
              const file = new File([blob], fileName, { type: contentType });
              
              resolve(file);
            } catch (error: any) {
              reject(new Error(`Failed to create file: ${error.message}`));
            }
          });
        });
        
        req.on('error', (error: Error) => {
          reject(new Error(`Network error: ${error.message}`));
        });
        
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Download timeout (60s)'));
        });
        
        req.end();
      } catch (error: any) {
        reject(new Error(`Failed to download image: ${error.message}`));
      }
    });
  }

  /**
   * Upload local images referenced in the given markdown files and update them in-place.
   */
  private async publishSelectedFilesToR2(files: TFile[]): Promise<void> {
    if (!files || files.length === 0) {
      new Notice(this.t('noMarkdownFilesSelected'));
      return;
    }

    let totalSuccess = 0;
    let totalError = 0;

    new Notice(
      `${this.t('startingUpload')} for ${files.length} selected markdown file(s). This may take a while.`
    );

    for (const file of files) {
      try {
        const content = await this.app.vault.read(file);
        const { updatedContent, successCount, errorCount } =
          await this.uploadLocalImagesInContent(content, file);

        if (successCount > 0) {
          await this.app.vault.modify(file, updatedContent);
        }

        totalSuccess += successCount;
        totalError += errorCount;
      } catch (e) {
        new Notice(`${this.t('failedToProcess')} "${file.name}": ${e.message}`);
        totalError++;
      }
    }

    new Notice(
      `${this.t('finishedUpload')} for selected files. ${this.t('successfullyUploaded', { count: totalSuccess.toString() })} with ${totalError} errors.`
    );
  }

  private async uploadLocalImagesInContent(
    content: string,
    fileContext: TFile
  ): Promise<{ updatedContent: string; successCount: number; errorCount: number }> {
    const imageTags = ImageTagProcessor.extractImageTags(content);

    if (imageTags.length === 0) {
      new Notice(`${this.t('noImagesFound')} in "${fileContext.name}".`);
      return { updatedContent: content, successCount: 0, errorCount: 0 };
    }

    // Separate local and external images
    const localImageTags = imageTags.filter(tag =>
      ImageTagProcessor.isLocalImage(tag.imagePath)
    );
    const externalImageTags = this.settings.downloadExternalImages
      ? imageTags.filter(tag => !ImageTagProcessor.isLocalImage(tag.imagePath))
      : [];

    if (localImageTags.length === 0 && externalImageTags.length === 0) {
      new Notice(`${this.t('noImagesToUpload')} in "${fileContext.name}".`);
      return { updatedContent: content, successCount: 0, errorCount: 0 };
    }

    const totalImages = localImageTags.length + externalImageTags.length;
    new Notice(
      this.t('foundImages', { local: localImageTags.length.toString(), external: externalImageTags.length.toString() }) + ` in "${fileContext.name}".`
    );

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

        // 1) 기본 경로로 먼저 찾기
        let file = this.app.vault.getAbstractFileByPath(normalizedPath) as TFile | null;

        // 2) 실패하면, Obsidian의 링크 해석 로직(metadataCache)을 사용해서 전역 검색
        if (!file) {
          const activeFile = fileContext;
          if (activeFile) {
            const linked = this.app.metadataCache.getFirstLinkpathDest(
              imageTag.imagePath,
              activeFile.path
            );
            if (linked) {
              file = linked as TFile;
            }
          }
        }

        // 3) 그래도 못 찾으면, vault 내 모든 파일 이름을 전역 검색
        if (!file) {
          const imageName = imageTag.imagePath.split('/').pop();
          const allFiles = this.app.vault.getFiles();
          file = allFiles.find((f: TFile) => f.name === imageName) ?? null;
        }

        if (!file) {
          new Notice(
            `${this.t('fileNotFound')}: ${imageTag.imagePath} (resolved to: ${normalizedPath}) in "${fileContext.name}". Tried global search but could not locate the file.`
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
        new Notice(
          `${this.t('failedToUpload')} ${imageTag.imagePath} in "${fileContext.name}": ${error.message}`
        );
        errorCount++;
      }
    }

    // Process external images if enabled
    for (const imageTag of externalImageTags) {
      try {
        // Download external image
        const file = await this.downloadExternalImage(imageTag.imagePath);
        if (!file) {
          errorCount++;
          continue;
        }

        // Upload to R2
        const url = await this.uploadImage(file);
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
        new Notice(
          `${this.t('failedToDownloadUpload')} ${imageTag.imagePath} in "${fileContext.name}": ${error.message}`
        );
        errorCount++;
      }
    }

    // Now apply all replacements using replaceAll (like obsidian-image-upload-toolkit)
    for (const replacement of replacements) {
      // Generate alt text from filename (like obsidian-image-upload-toolkit)
      let fileName = '';

      // Extract filename from wiki link: ![[filename.png]]
      if (/^!\[\[/.test(replacement.originalText) && /\]\]$/.test(replacement.originalText)) {
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

    return { updatedContent, successCount, errorCount };
  }

  async publishPageToR2(): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      new Notice(this.t('noActiveMarkdownView'));
      return;
    }

    const fileContext = activeView.file;
    if (!fileContext) {
      new Notice(this.t('noActiveFile'));
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();

    const { updatedContent, successCount, errorCount } =
      await this.uploadLocalImagesInContent(content, fileContext);

    if (successCount > 0) {
      editor.setValue(updatedContent);
      new Notice(
        `${this.t('successfullyUploaded', { count: successCount.toString() })} in current note. ${errorCount} failed.`
      );
    } else if (errorCount > 0) {
      new Notice(
        `${this.t('failedToUploadAny')} in current note. ${errorCount} errors encountered.`
      );
    }
  }

  async publishCurrentFolderToR2(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file found.');
      return;
    }

    const folder = activeFile.parent;
    if (!folder) {
      new Notice(this.t('noActiveFileParent'));
      return;
    }

    const allMarkdownFiles = this.app.vault.getMarkdownFiles();
    const targetFiles = allMarkdownFiles.filter(f => f.parent?.path === folder.path);

    if (targetFiles.length === 0) {
      new Notice(this.t('noMarkdownFilesInFolder'));
      return;
    }

    new Notice(
      `${this.t('startingUpload')} for ${targetFiles.length} markdown files in the current folder.`
    );

    let totalSuccess = 0;
    let totalError = 0;

    for (const file of targetFiles) {
      const content = await this.app.vault.read(file);
      const { updatedContent, successCount, errorCount } =
        await this.uploadLocalImagesInContent(content, file);

      if (successCount > 0) {
        await this.app.vault.modify(file, updatedContent);
      }

      totalSuccess += successCount;
      totalError += errorCount;
    }

    new Notice(
      `${this.t('finishedUpload')} for current folder. ${this.t('successfullyUploaded', { count: totalSuccess.toString() })} with ${totalError} errors.`
    );
  }

  async publishVaultToR2(): Promise<void> {
    const allMarkdownFiles = this.app.vault.getMarkdownFiles();
    if (allMarkdownFiles.length === 0) {
      new Notice(this.t('noMarkdownFilesInVault'));
      return;
    }

    new Notice(
      `${this.t('startingUpload')} for ${allMarkdownFiles.length} markdown files in the vault. This may take a while.`
    );

    let totalSuccess = 0;
    let totalError = 0;

    for (const file of allMarkdownFiles) {
      const content = await this.app.vault.read(file);
      const { updatedContent, successCount, errorCount } =
        await this.uploadLocalImagesInContent(content, file);

      if (successCount > 0) {
        await this.app.vault.modify(file, updatedContent);
      }

      totalSuccess += successCount;
      totalError += errorCount;
    }

    new Notice(
      `${this.t('finishedUpload')} for entire vault. ${this.t('successfullyUploaded', { count: totalSuccess.toString() })} with ${totalError} errors.`
    );
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
    this.titleEl.setText(this.plugin.t('r2Uploader'));

    const fileNames = this.files.map(f => f.name).join(', ');
    const message =
      this.files.length === 1
        ? this.plugin.t('uploadConfirmationSingle', { fileName: fileNames })
        : this.plugin.t('uploadConfirmationMultiple', { count: this.files.length.toString(), fileNames });

    this.contentEl.setText(message);

    const buttonContainer = this.modalEl.createDiv('modal-button-container');

    const alwaysUploadButton = buttonContainer.createEl('button', {
      text: this.plugin.t('alwaysUpload'),
    });
    alwaysUploadButton.addClass('mod-cta');
    alwaysUploadButton.onclick = () => {
      this.deferredResolve({ shouldUpload: true, alwaysUpload: true });
      this.afterUserInput();
    };

    const uploadButton = buttonContainer.createEl('button', { text: this.plugin.t('upload') });
    uploadButton.addClass('mod-cta');
    uploadButton.onclick = () => {
      this.deferredResolve({ shouldUpload: true });
      this.afterUserInput();
    };

    const pasteLocallyButton = buttonContainer.createEl('button', {
      text: this.plugin.t('pasteLocally'),
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
    contentEl.createEl('h2', { text: this.plugin.t('publishPageToR2Title') });
    contentEl.createEl('p', {
      text: this.plugin.t('publishPageToR2Desc'),
    });

    const buttonContainer = contentEl.createDiv();
    buttonContainer.addClass('r2-uploader-button-container');

    const publishButton = buttonContainer.createEl('button', { text: this.plugin.t('publishToR2') });
    publishButton.addClass('mod-cta');
    publishButton.onclick = async () => {
      this.close();
      await this.plugin.publishPageToR2();
    };

    const cancelButton = buttonContainer.createEl('button', { text: this.plugin.t('cancel') });
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
    containerEl.createEl('h1', { text: this.plugin.t('uploadSettings') });

    // Language selection
    new Setting(containerEl)
      .setName(this.plugin.t('language'))
      .setDesc(this.plugin.t('languageDesc'))
      .addDropdown(dropdown =>
        dropdown
          .addOption('en', 'English')
          .addOption('ko', '한국어')
          .setValue(this.plugin.settings.language)
          .onChange(async value => {
            this.plugin.settings.language = value as Language;
            await this.plugin.saveSettings();
            // Refresh settings UI to show new language
            this.display();
          })
      );

    // 일반 업로드 설정
    new Setting(containerEl)
      .setName(this.plugin.t('useImageNameAsAltText'))
      .setDesc(this.plugin.t('useImageNameAsAltTextDesc'))
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.useImageNameAsAltText)
          .onChange(async value => {
            this.plugin.settings.useImageNameAsAltText = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('updateOriginalDocument'))
      .setDesc(this.plugin.t('updateOriginalDocumentDesc'))
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.updateOriginalDocument)
          .onChange(async value => {
            this.plugin.settings.updateOriginalDocument = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('ignoreNoteProperties'))
      .setDesc(this.plugin.t('ignoreNotePropertiesDesc'))
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.ignoreNoteProperties)
          .onChange(async value => {
            this.plugin.settings.ignoreNoteProperties = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('showProgressModal'))
      .setDesc(this.plugin.t('showProgressModalDesc'))
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.showProgressModal).onChange(async value => {
          this.plugin.settings.showProgressModal = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('confirmBeforeUpload'))
      .setDesc(this.plugin.t('confirmBeforeUploadDesc'))
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.confirmBeforeUpload)
          .onChange(async value => {
            this.plugin.settings.confirmBeforeUpload = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('downloadExternalImages'))
      .setDesc(this.plugin.t('downloadExternalImagesDesc'))
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.downloadExternalImages)
          .onChange(async value => {
            this.plugin.settings.downloadExternalImages = value;
            await this.plugin.saveSettings();
          })
      );

    // CloudFlare R2 설정
    containerEl.createEl('h2', { text: this.plugin.t('cloudflareR2Settings') });

    new Setting(containerEl)
      .setName(this.plugin.t('cloudflareR2AccessKeyID'))
      .setDesc(this.plugin.t('cloudflareR2AccessKeyIDDesc'))
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
      .setName(this.plugin.t('cloudflareR2SecretAccessKey'))
      .setDesc(this.plugin.t('cloudflareR2SecretAccessKeyDesc'))
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
      .setName(this.plugin.t('cloudflareR2Endpoint'))
      .setDesc(this.plugin.t('cloudflareR2EndpointDesc'))
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
      .setName(this.plugin.t('cloudflareR2BucketName'))
      .setDesc(this.plugin.t('cloudflareR2BucketNameDesc'))
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
      .setName(this.plugin.t('targetPath'))
      .setDesc(this.plugin.t('targetPathDesc'))
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
      .setName(this.plugin.t('r2devUrlCustomDomain'))
      .setDesc(this.plugin.t('r2devUrlCustomDomainDesc'))
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
