import { UploaderUtils } from '../uploader/uploaderUtils';

export interface ImgurSetting {
  clientId: string;
  path: string;
  customDomainName: string;
}

export class ImgurUploader {
  private readonly clientId: string;
  private readonly pathTemplate: string;
  private readonly customDomainName: string;

  constructor(setting: ImgurSetting) {
    this.clientId = setting.clientId;
    this.pathTemplate = setting.path;
    this.customDomainName = setting.customDomainName;
  }

  async upload(image: File): Promise<string> {
    const arrayBuffer = await this.readFileAsArrayBuffer(image);
    const base64 = this.arrayBufferToBase64(arrayBuffer);

    const formData = new FormData();
    formData.append('image', base64);
    formData.append('type', 'base64');

    try {
      const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
          Authorization: `Client-ID ${this.clientId}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Imgur API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        return data.data.link;
      } else {
        throw new Error(`Imgur upload failed: ${data.data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      throw new Error(`Imgur upload failed: ${error.message}`);
    }
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
