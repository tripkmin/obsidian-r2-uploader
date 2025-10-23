# R2 Uploader

R2 Uploader는 Obsidian에서 CloudFlare R2에 이미지를 업로드하고 자동으로 링크를 교체하는 플러그인입니다.

## 기능

- **자동 이미지 업로드**: 클립보드에서 이미지를 붙여넣을 때 자동으로 CloudFlare R2에 업로드
- **업로드 확인**: 업로드 전 확인 다이얼로그 (선택사항)
- **Publish Page**: 현재 노트의 모든 로컬 이미지를 R2에 업로드하고 링크 교체
- **유연한 경로 설정**: 날짜, 파일명 등 변수를 사용한 저장 경로 설정
- **커스텀 도메인 지원**: R2.dev URL 또는 사용자 지정 도메인 사용

## 설치

1. 이 플러그인을 Obsidian의 플러그인 폴더에 복사합니다.
2. Obsidian에서 플러그인을 활성화합니다.
3. 설정에서 CloudFlare R2 계정 정보를 입력합니다.

## 설정

### CloudFlare R2 설정

1. **Access Key ID**: CloudFlare R2 액세스 키 ID
2. **Secret Access Key**: CloudFlare R2 비밀 액세스 키
3. **Endpoint**: R2 엔드포인트 URL (예: `https://account-id.r2.cloudflarestorage.com`)
4. **Bucket Name**: R2 버킷 이름
5. **Target Path**: 이미지 저장 경로 (변수 지원: `{year}`, `{mon}`, `{day}`, `{filename}`)
6. **Custom Domain**: R2.dev URL 또는 사용자 지정 도메인

### 업로드 설정

- **Use image name as Alt Text**: 이미지 이름을 Alt 텍스트로 사용
- **Update original document**: 내부 링크를 스토어 링크로 교체
- **Ignore note properties**: 클립보드 복사 시 노트 속성 무시
- **Show progress modal**: 업로드 진행 상황 모달 표시
- **Confirm before upload**: 업로드 전 확인 다이얼로그 표시

## 사용법

### 자동 업로드
1. 이미지를 클립보드에 복사합니다.
2. Obsidian 편집기에서 붙여넣기 (Ctrl+V)를 합니다.
3. 확인 다이얼로그가 나타나면 "Upload" 또는 "Always Upload"를 선택합니다.

### Publish Page
1. 명령 팔레트 (Ctrl+P)를 엽니다.
2. "Publish Page to R2" 명령을 실행합니다.
3. 현재 노트의 모든 로컬 이미지가 R2에 업로드되고 링크가 교체됩니다.

## 개발

### 빌드
```bash
npm run build
```

### 개발 모드
```bash
npm run dev
```

## 라이선스

MIT License
