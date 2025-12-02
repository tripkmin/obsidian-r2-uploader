import { Editor, MarkdownView, TFile, normalizePath } from 'obsidian';
import * as path from 'path';

export const ACTION_PUBLISH = 'publish';

export interface ImageTag {
  originalText: string;
  altText: string;
  imagePath: string;
  start: number;
  end: number;
}

export default class ImageTagProcessor {
  private static readonly videoExtensionRegex =
    /\.(mp4|mov|m4v|webm|ogg|ogv|mkv|avi|mpeg|mpg|mpe|m2v|3gp|3g2)(?=($|[?#]))/i;

  static isVideoAsset(target?: string | null): boolean {
    if (!target) return false;
    let normalized = target;
    try {
      normalized = decodeURIComponent(target);
    } catch (_) {
      // ignore decode errors and use the raw string
    }
    return this.videoExtensionRegex.test(normalized.toLowerCase());
  }

  static extractImageTags(content: string): ImageTag[] {
    const imageTags: ImageTag[] = [];

    // Regular markdown image syntax: ![alt](path)
    const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = mdImageRegex.exec(content)) !== null) {
      const [originalText, altText, imagePath] = match;
      imageTags.push({
        originalText,
        altText,
        imagePath,
        start: match.index,
        end: match.index + originalText.length,
      });
    }

    // Obsidian wiki link syntax: ![[image.png]]
    const wikiImageRegex = /!\[\[([^\]]+)\]\]/g;
    while ((match = wikiImageRegex.exec(content)) !== null) {
      const [originalText, imagePath] = match;
      imageTags.push({
        originalText,
        altText: '', // Wiki links don't have alt text
        imagePath,
        start: match.index,
        end: match.index + originalText.length,
      });
    }

    return imageTags;
  }

  static resolveImagePath(
    imageName: string,
    app: any
  ): { resolvedPath: string; name: string } {
    let pathName = imageName;

    if (pathName.indexOf('/') < 0) {
      // @ts-ignore: config is not defined in vault api, but available
      const attachmentFolderPath = app.vault.config.attachmentFolderPath;
      pathName = path.join(attachmentFolderPath, pathName);
      if (attachmentFolderPath.startsWith('.')) {
        pathName = './' + pathName;
      }
    } else {
      imageName = imageName.substring(pathName.lastIndexOf('/') + 1);
    }

    // Handle relative paths: ./ and ../
    if (pathName.startsWith('./') || pathName.startsWith('../')) {
      const activeFile = app.workspace.getActiveFile();
      if (!activeFile || !activeFile.parent) {
        throw new Error('No active file found');
      }
      const parentPath = activeFile.parent.path;
      // Normalize the path to resolve ../ and ./
      const normalizedPath = path.normalize(path.join(parentPath, pathName));
      return { resolvedPath: normalizedPath, name: imageName };
    } else {
      return { resolvedPath: pathName, name: imageName };
    }
  }

  static isLocalImage(imagePath: string): boolean {
    // Check if the image path is a local file (not a URL)
    return (
      !imagePath.startsWith('http://') &&
      !imagePath.startsWith('https://') &&
      !imagePath.startsWith('data:')
    );
  }

  static replaceImageTag(content: string, imageTag: ImageTag, newUrl: string): string {
    let newImageTag: string;

    const isVideo =
      ImageTagProcessor.isVideoAsset(imageTag.imagePath) ||
      ImageTagProcessor.isVideoAsset(newUrl);

    if (isVideo) {
      // Videos should render with HTML video tag so playback controls are available.
      newImageTag = `<video controls src="${newUrl}"></video>`;
      return (
        content.substring(0, imageTag.start) +
        newImageTag +
        content.substring(imageTag.end)
      );
    }

    // Check if it's a wiki link format
    if (imageTag.originalText.startsWith('![[') && imageTag.originalText.endsWith(']]')) {
      // Convert wiki link to markdown image
      newImageTag = `![](${newUrl})`;
    } else {
      // Regular markdown image
      newImageTag = `![${imageTag.altText}](${newUrl})`;
    }

    return (
      content.substring(0, imageTag.start) + newImageTag + content.substring(imageTag.end)
    );
  }

  static async getLocalImageFiles(
    vault: any,
    imageTags: ImageTag[]
  ): Promise<{ tag: ImageTag; file: TFile | null }[]> {
    const results: { tag: ImageTag; file: TFile | null }[] = [];

    for (const tag of imageTags) {
      if (this.isLocalImage(tag.imagePath)) {
        const file = vault.getAbstractFileByPath(tag.imagePath);
        results.push({ tag, file: file as TFile });
      } else {
        results.push({ tag, file: null });
      }
    }

    return results;
  }
}
