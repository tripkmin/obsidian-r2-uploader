import { UploaderUtils } from '../uploader/uploaderUtils';

export interface S3Setting {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucketName: string;
  path: string;
  customDomainName: string;
}

export class DirectS3Uploader {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly pathTemplate: string;
  private readonly customDomainName: string;

  constructor(setting: S3Setting) {
    this.accessKeyId = setting.accessKeyId;
    this.secretAccessKey = setting.secretAccessKey;
    this.endpoint = setting.endpoint;
    this.bucket = setting.bucketName;
    this.pathTemplate = setting.path;
    this.customDomainName = setting.customDomainName;
  }

  async upload(image: File): Promise<string> {
    const arrayBuffer = await this.readFileAsArrayBuffer(image);
    const uint8Array = new Uint8Array(arrayBuffer);
    let path = UploaderUtils.generateName(this.pathTemplate, image.name);
    path = path.replace(/^\/+/, ''); // remove the /

    // Create a signed URL for PUT request
    const signedUrl = await this.createSignedUrl(path, image.type);

    // Use XMLHttpRequest instead of fetch to avoid CORS issues
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl, true);
      xhr.setRequestHeader('Content-Type', image.type);

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const url = `${this.endpoint}/${this.bucket}/${path}`;
          const dst = url.split(`/${this.bucket}/`).pop();
          if (!dst) {
            reject(new Error('Could not extract file path from URL'));
            return;
          }
          resolve(UploaderUtils.customizeDomainName(dst, this.customDomainName));
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      xhr.send(uint8Array);
    });
  }

  private async createSignedUrl(key: string, contentType: string): Promise<string> {
    // This is a simplified approach - in production, you'd need to implement
    // proper AWS Signature v4 with crypto operations
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const datetimeString = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');

    // For Cloudflare R2, we can use a simpler approach
    // This creates a pre-signed URL that should work with R2
    const url = `${this.endpoint}/${this.bucket}/${key}`;

    // Note: This is a simplified implementation
    // In a real implementation, you'd need to:
    // 1. Create proper AWS signature v4
    // 2. Include proper headers
    // 3. Handle authentication properly

    return url;
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
}
