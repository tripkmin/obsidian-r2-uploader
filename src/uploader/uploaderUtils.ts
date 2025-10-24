import * as path from 'path';

export class UploaderUtils {
  static generateName(pathTmpl: string, imageName: string): string {
    const date = new Date();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = this.generateRandomString(20);

    // Generate unique filename similar to Obsidian's local paste behavior
    const uniqueFileName = this.generateUniqueFileName(imageName);

    return pathTmpl != undefined && pathTmpl.trim().length > 0
      ? pathTmpl
          .replace('{year}', year)
          .replace('{mon}', month)
          .replace('{day}', day)
          .replace('{random}', random)
          .replace('{filename}', uniqueFileName)
      : uniqueFileName;
  }

  private static generateUniqueFileName(originalName: string): string {
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

  private static generateRandomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
    }

    return result;
  }

  static customizeDomainName(url: string, customDomainName: string): string {
    const regex = /https?:\/\/([^/]+)/;
    customDomainName = customDomainName.replaceAll('https://', '');
    if (customDomainName && customDomainName.trim() !== '') {
      if (url.match(regex) != null) {
        return url.replace(regex, (match, domain) => {
          return match.replace(domain, customDomainName);
        });
      } else {
        return `https://${customDomainName}/${url}`;
      }
    }
    return url;
  }
}
