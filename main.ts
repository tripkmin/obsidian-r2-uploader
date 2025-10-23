import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { R2Uploader, R2Setting } from './src/uploader/r2Uploader';
import ImageTagProcessor, { ImageTag } from './src/uploader/imageTagProcessor';

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
}

export default class R2UploaderPlugin extends Plugin {
	settings: R2UploaderSettings;
	private r2Uploader: R2Uploader | null = null;

	async onload() {
		await this.loadSettings();
		this.setupR2Uploader();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('upload', 'R2 Uploader', (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('R2 Uploader Plugin Loaded!');
		});
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
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new R2UploaderSettingTab(this.app, this));

		// Register paste event listener for automatic image upload
		this.registerDomEvent(document, 'paste', (evt: ClipboardEvent) => {
			this.handlePasteEvent(evt);
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.setupR2Uploader();
	}

	private setupR2Uploader() {
		if (this.settings.accessKeyId && this.settings.secretAccessKey && this.settings.endpoint && this.settings.bucketName) {
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

	private async handlePasteEvent(evt: ClipboardEvent) {
		const clipboardItems = evt.clipboardData?.items;
		if (!clipboardItems) return;

		// Check if all files are images
		const files: File[] = [];
		for (let i = 0; i < clipboardItems.length; i++) {
			const item = clipboardItems[i];
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					files.push(file);
				}
			}
		}

		if (files.length === 0) return;

		// If there are non-image files, don't handle the paste event
		if (files.length !== clipboardItems.length) return;

		evt.preventDefault();

		if (this.settings.confirmBeforeUpload) {
			new UploadConfirmationModal(this.app, this, files).open();
		} else {
			await this.uploadImages(files);
		}
	}

	async uploadImage(file: File): Promise<string | null> {
		if (!this.r2Uploader) {
			new Notice('R2 Uploader not configured. Please check your settings.');
			return null;
		}

		try {
			new Notice(`Uploading ${file.name} to R2...`);
			const url = await this.r2Uploader.upload(file);
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
		const localImageTags = imageTags.filter(tag => ImageTagProcessor.isLocalImage(tag.imagePath));
		
		if (localImageTags.length === 0) {
			new Notice('No local images found in the current note.');
			return;
		}

		new Notice(`Found ${localImageTags.length} local images to upload.`);

		let updatedContent = content;
		let successCount = 0;
		let errorCount = 0;

		for (const imageTag of localImageTags) {
			try {
				// Get the file from vault
				const file = this.app.vault.getAbstractFileByPath(imageTag.imagePath) as TFile;
				if (!file) {
					new Notice(`File not found: ${imageTag.imagePath}`);
					errorCount++;
					continue;
				}

				// Read file content
				const fileContent = await this.app.vault.readBinary(file);
				
				// Determine MIME type from file extension
				const extension = file.extension.toLowerCase();
				let mimeType = 'image/jpeg'; // default
				if (extension === 'png') mimeType = 'image/png';
				else if (extension === 'gif') mimeType = 'image/gif';
				else if (extension === 'webp') mimeType = 'image/webp';
				else if (extension === 'svg') mimeType = 'image/svg+xml';
				else if (extension === 'bmp') mimeType = 'image/bmp';
				else if (extension === 'tiff' || extension === 'tif') mimeType = 'image/tiff';

				// Create a File object from the binary data
				const blob = new Blob([fileContent], { type: mimeType });
				const fileObj = new File([blob], file.name, { type: mimeType });

				// Upload to R2
				const url = await this.uploadImage(fileObj);
				if (url) {
					// Replace the image tag with the new URL
					updatedContent = ImageTagProcessor.replaceImageTag(updatedContent, imageTag, url);
					successCount++;
				} else {
					errorCount++;
				}
			} catch (error) {
				new Notice(`Failed to upload ${imageTag.imagePath}: ${error.message}`);
				errorCount++;
			}
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

	constructor(app: App, plugin: R2UploaderPlugin, files: File[]) {
		super(app);
		this.plugin = plugin;
		this.files = files;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl("h2", {text: "Upload Images to R2"});
		
		const fileNames = this.files.map(f => f.name).join(", ");
		const message = this.files.length === 1 
			? `Would you like to upload "${fileNames}" to Cloudflare R2 or paste your content locally?`
			: `Would you like to upload ${this.files.length} images (${fileNames}) to Cloudflare R2 or paste your content locally?`;
		
		contentEl.createEl("p", {text: message});
		
		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass("r2-uploader-button-container");
		
		const uploadButton = buttonContainer.createEl("button", {text: "Upload"});
		uploadButton.addClass("mod-cta");
		uploadButton.onclick = async () => {
			await this.plugin.uploadImages(this.files);
			this.close();
		};
		
		const alwaysUploadButton = buttonContainer.createEl("button", {text: "Always Upload"});
		alwaysUploadButton.onclick = async () => {
			this.plugin.settings.confirmBeforeUpload = false;
			await this.plugin.saveSettings();
			await this.plugin.uploadImages(this.files);
			this.close();
		};
		
		const pasteLocallyButton = buttonContainer.createEl("button", {text: "Paste Locally"});
		pasteLocallyButton.onclick = () => {
			// TODO: Implement local paste functionality
			this.close();
		};
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class PublishPageModal extends Modal {
	plugin: R2UploaderPlugin;

	constructor(app: App, plugin: R2UploaderPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl("h2", {text: "Publish Page to R2"});
		contentEl.createEl("p", {text: "This will upload all local images in the current note to Cloudflare R2 and replace the links."});
		
		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass("r2-uploader-button-container");
		
		const publishButton = buttonContainer.createEl("button", {text: "Publish to R2"});
		publishButton.addClass("mod-cta");
		publishButton.onclick = async () => {
			this.close();
			await this.plugin.publishPageToR2();
		};
		
		const cancelButton = buttonContainer.createEl("button", {text: "Cancel"});
		cancelButton.onclick = () => {
			this.close();
		};
	}

	onClose() {
		const {contentEl} = this;
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
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl("h1", {text: "Upload Settings"});

		// 일반 업로드 설정
		new Setting(containerEl)
			.setName('Use image name as Alt Text')
			.setDesc('Whether to use image name as Alt Text with \'-\' and \'_\' replaced with space.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useImageNameAsAltText)
				.onChange(async (value) => {
					this.plugin.settings.useImageNameAsAltText = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Update original document')
			.setDesc('Whether to replace internal link with store link.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.updateOriginalDocument)
				.onChange(async (value) => {
					this.plugin.settings.updateOriginalDocument = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Ignore note properties')
			.setDesc('Where to ignore note properties when copying to clipboard. This won\'t affect original note.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.ignoreNoteProperties)
				.onChange(async (value) => {
					this.plugin.settings.ignoreNoteProperties = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show progress modal')
			.setDesc('Show a modal dialog with detailed progress when uploading images (auto close in 3s). If disabled, a simpler status indicator will be used.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showProgressModal)
				.onChange(async (value) => {
					this.plugin.settings.showProgressModal = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Confirm before upload')
			.setDesc('Show confirmation dialog before uploading images.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.confirmBeforeUpload)
				.onChange(async (value) => {
					this.plugin.settings.confirmBeforeUpload = value;
					await this.plugin.saveSettings();
				}));

		// CloudFlare R2 설정
		containerEl.createEl("h2", {text: "CloudFlare R2 Settings"});

		new Setting(containerEl)
			.setName('Cloudflare R2 Access Key ID')
			.setDesc('Your Cloudflare R2 access key ID')
			.addText(text => text
				.setPlaceholder('Enter your access key ID')
				.setValue(this.plugin.settings.accessKeyId)
				.onChange(async (value) => {
					this.plugin.settings.accessKeyId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Cloudflare R2 Secret Access Key')
			.setDesc('Your Cloudflare R2 secret access key')
			.addText(text => text
				.setPlaceholder('Enter your secret access key')
				.setValue(this.plugin.settings.secretAccessKey)
				.onChange(async (value) => {
					this.plugin.settings.secretAccessKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Cloudflare R2 Endpoint')
			.setDesc('Your Cloudflare R2 endpoint URL (e.g., https://account-id.r2.cloudflarestorage.com)')
			.addText(text => text
				.setPlaceholder('Enter your R2 endpoint')
				.setValue(this.plugin.settings.endpoint)
				.onChange(async (value) => {
					this.plugin.settings.endpoint = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Cloudflare R2 Bucket Name')
			.setDesc('Your Cloudflare R2 bucket name')
			.addText(text => text
				.setPlaceholder('Enter your bucket name')
				.setValue(this.plugin.settings.bucketName)
				.onChange(async (value) => {
					this.plugin.settings.bucketName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Target Path')
			.setDesc('The path to store image.\\nSupport {year} {mon} {day} {random} {filename} vars. For example, /{year}/{mon}/{day}/{filename} with uploading pic.jpg, it will store as /2023/06/08/pic.jpg.')
			.addText(text => text
				.setPlaceholder('Enter path')
				.setValue(this.plugin.settings.targetPath)
				.onChange(async (value) => {
					this.plugin.settings.targetPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('R2.dev URL, Custom Domain Name')
			.setDesc('You can use the R2.dev URL such as https://pub-xxxx.r2.dev here, or custom domain. If the custom domain name is example.com, you can use https://example.com/pic.jpg to access pic.img.')
			.addText(text => text
				.setPlaceholder('Enter domain name')
				.setValue(this.plugin.settings.customDomainName)
				.onChange(async (value) => {
					this.plugin.settings.customDomainName = value;
					await this.plugin.saveSettings();
				}));
	}
}
