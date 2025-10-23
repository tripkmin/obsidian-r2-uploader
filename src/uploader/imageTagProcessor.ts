import { Editor, MarkdownView, TFile } from 'obsidian';

export const ACTION_PUBLISH = 'publish';

export interface ImageTag {
    originalText: string;
    altText: string;
    imagePath: string;
    start: number;
    end: number;
}

export default class ImageTagProcessor {
    static extractImageTags(content: string): ImageTag[] {
        const imageTags: ImageTag[] = [];
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;

        while ((match = imageRegex.exec(content)) !== null) {
            const [originalText, altText, imagePath] = match;
            imageTags.push({
                originalText,
                altText,
                imagePath,
                start: match.index,
                end: match.index + originalText.length
            });
        }

        return imageTags;
    }

    static isLocalImage(imagePath: string): boolean {
        // Check if the image path is a local file (not a URL)
        return !imagePath.startsWith('http://') && 
               !imagePath.startsWith('https://') && 
               !imagePath.startsWith('data:');
    }

    static replaceImageTag(content: string, imageTag: ImageTag, newUrl: string): string {
        const newImageTag = `![${imageTag.altText}](${newUrl})`;
        return content.substring(0, imageTag.start) + 
               newImageTag + 
               content.substring(imageTag.end);
    }

    static async getLocalImageFiles(vault: any, imageTags: ImageTag[]): Promise<{ tag: ImageTag; file: TFile | null }[]> {
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
