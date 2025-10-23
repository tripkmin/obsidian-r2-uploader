import { UploaderUtils } from '../uploader/uploaderUtils';

export interface R2Setting {
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
    bucketName: string;
    path: string;
    customDomainName: string;
}

export class R2Uploader {
    private readonly accessKeyId: string;
    private readonly secretAccessKey: string;
    private readonly endpoint: string;
    private readonly bucketName: string;
    private readonly pathTemplate: string;
    private readonly customDomainName: string;

    constructor(setting: R2Setting) {
        this.accessKeyId = setting.accessKeyId;
        this.secretAccessKey = setting.secretAccessKey;
        this.endpoint = setting.endpoint;
        this.bucketName = setting.bucketName;
        this.pathTemplate = setting.path;
        this.customDomainName = setting.customDomainName;
    }

    async upload(image: File): Promise<string> {
        try {
            const arrayBuffer = await this.readFileAsArrayBuffer(image);
            const path = UploaderUtils.generateName(this.pathTemplate, image.name);
            const cleanPath = path.replace(/^\/+/, ''); // remove leading slashes
            
            // Create AWS signature for the request
            const signedHeaders = await this.createSignedRequest('PUT', cleanPath, image.type, arrayBuffer);
            
            // Upload the file
            const url = `${this.endpoint}/${this.bucketName}/${cleanPath}`;
            const response = await fetch(url, {
                method: 'PUT',
                body: arrayBuffer,
                headers: signedHeaders,
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }

            // Return the public URL
            const publicUrl = `${this.endpoint}/${this.bucketName}/${cleanPath}`;
            return UploaderUtils.customizeDomainName(publicUrl, this.customDomainName);
        } catch (error) {
            throw new Error(`R2 upload failed: ${error.message}`);
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

    private async createSignedRequest(method: string, key: string, contentType: string, body: ArrayBuffer): Promise<Record<string, string>> {
        const now = new Date();
        const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
        const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const region = 'auto';
        const service = 's3';
        
        // Create canonical request
        const canonicalUri = `/${key}`;
        const canonicalQueryString = '';
        const canonicalHeaders = `host:${this.endpoint.replace(/^https?:\/\//, '')}\nx-amz-content-sha256:${await this.sha256(body)}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        const payloadHash = await this.sha256(body);
        
        const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
        
        // Create string to sign
        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
        const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await this.sha256(canonicalRequest)}`;
        
        // Calculate signature
        const signature = await this.getSignatureKey(this.secretAccessKey, dateStamp, region, service, stringToSign);
        
        // Create authorization header
        const authorization = `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
        
        return {
            'Authorization': authorization,
            'x-amz-content-sha256': payloadHash,
            'x-amz-date': amzDate,
            'Content-Type': contentType,
        };
    }

    private async sha256(data: string | ArrayBuffer): Promise<string> {
        const encoder = new TextEncoder();
        const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private async getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string, stringToSign: string): Promise<string> {
        const encoder = new TextEncoder();
        
        const kDate = await this.hmacSha256(encoder.encode('AWS4' + key), dateStamp);
        const kRegion = await this.hmacSha256(kDate, regionName);
        const kService = await this.hmacSha256(kRegion, serviceName);
        const kSigning = await this.hmacSha256(kService, 'aws4_request');
        
        return await this.hmacSha256(kSigning, stringToSign);
    }

    private async hmacSha256(key: ArrayBuffer, data: string): Promise<string> {
        const encoder = new TextEncoder();
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            key,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
        const hashArray = Array.from(new Uint8Array(signature));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
