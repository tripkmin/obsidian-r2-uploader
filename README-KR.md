# R2 Uploader

**R2 Uploader**는 **Obsidian**에서 **Cloudflare R2**로 이미지를 업로드하고, 로컬 링크를 자동으로 원격 링크로 교체해주는 플러그인입니다.

> ⚠️ 이 플러그인은 **공식적으로 출시된 Obsidian 플러그인**이 아니며, **개인 개발 중인 프로젝트**입니다.

---

## ✨ 주요 기능

- **자동 이미지 업로드**: 클립보드의 이미지를 붙여넣을 때 자동으로 Cloudflare R2에 업로드
- **업로드 확인**: 업로드 전에 확인 다이얼로그 표시 (선택사항)
- **페이지 게시 (Publish Page)**: 현재 노트의 모든 로컬 이미지를 R2로 업로드하고 링크를 자동 교체
- **유연한 경로 변수 지원**: `{year}`, `{mon}`, `{day}`, `{filename}` 등의 변수를 사용해 경로를 동적으로 설정 가능
- **커스텀 도메인 지원**: `r2.dev` URL 또는 사용자 지정 도메인 사용 가능

---

## ⚙️ 설치 방법

1. 이 플러그인을 Obsidian의 플러그인 폴더에 복사합니다.
2. Obsidian 설정에서 플러그인을 활성화합니다.
3. 플러그인 설정에서 Cloudflare R2 계정 정보를 입력합니다.

---

## ☁️ Cloudflare R2 설정

### 1️⃣ Cloudflare 계정 생성 및 R2 버킷 만들기

1. [Cloudflare](https://dash.cloudflare.com/sign-up)에 가입합니다.
2. Cloudflare 대시보드에서 **R2 Storage** 기능을 활성화합니다.
3. 이미지를 저장할 **R2 버킷(bucket)** 을 새로 생성합니다.

### 2️⃣ API 자격 증명 생성

1. Cloudflare 대시보드에서 **R2 → Overview → Manage R2 API Tokens**로 이동합니다.
2. **Create API Token**을 클릭합니다.
3. 권한(permissions)을 **Read/Write**로 설정합니다.
4. 발급된 **Access Key ID**와 **Secret Access Key**를 복사해둡니다.

### 3️⃣ 플러그인 설정 입력

플러그인 설정 화면에서 아래 정보를 입력합니다:

| 항목                  | 설명                                             |
| --------------------- | ------------------------------------------------ |
| **Access Key ID**     | 발급받은 Cloudflare R2 Access Key ID             |
| **Secret Access Key** | 발급받은 Cloudflare R2 Secret Access Key         |
| **Endpoint**          | `https://<account-id>.r2.cloudflarestorage.com`  |
| **Bucket Name**       | 생성한 R2 버킷 이름                              |
| **Custom Domain**     | 선택 사항 – `r2.dev` URL 또는 사용자 지정 도메인 |

---

## 🧩 플러그인 설정 항목

| 설정 항목                      | 설명                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| **Target Path**                | 이미지 저장 경로 (`{year}`, `{mon}`, `{day}`, `{filename}` 지원) |
| **Use image name as Alt Text** | 이미지 파일명을 Alt 텍스트로 사용                                |
| **Update original document**   | 로컬 링크를 자동으로 R2 링크로 교체                              |
| **Ignore note properties**     | 이미지 붙여넣기 시 노트 속성(frontmatter) 무시                   |
| **Show progress modal**        | 업로드 진행 상황 모달 표시                                       |
| **Confirm before upload**      | 업로드 전 확인 다이얼로그 표시                                   |

---

## 🖼 사용법

### 자동 업로드

1. 이미지를 클립보드에 복사합니다.
2. Obsidian 편집기에서 붙여넣기 (`Ctrl + V`)를 합니다.
3. 업로드 확인창이 나타나면 **“Upload”** 또는 **“Always Upload”**를 선택합니다.

### 페이지 게시 (Publish Page)

1. 명령 팔레트 (`Ctrl + P`)를 엽니다.
2. **“Publish Page to R2”** 명령을 실행합니다.
3. 현재 노트의 모든 로컬 이미지가 R2로 업로드되고, 링크가 자동으로 교체됩니다.

---

## 🧱 개발

### 빌드

```bash
npm run build
```

### 개발 모드

```bash
npm run dev
```

---

## 🙏 참고 및 크레딧

이 플러그인은 아래 오픈소스 프로젝트들의 도움을 받아 제작되었습니다.

- [**obsidian-imgur-plugin**](https://github.com/gavvvr/obsidian-imgur-plugin)
  → 이미지 인스턴트 업로드 로직 참고
- [**obsidian-image-upload-toolkit**](https://github.com/addozhang/obsidian-image-upload-toolkit)
  → Cloudflare R2 업로드, Publish Page 로직 참고

---

## 📄 라이선스

MIT License
