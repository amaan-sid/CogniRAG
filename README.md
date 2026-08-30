# Full-Stack RAG System Architecture

An interactive, production-ready Retrieval-Augmented Generation (RAG) web application built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Node.js**.

This project features a step-by-step visual workbench tracking a 12-stage RAG pipeline:
- **Step 1: PDF → Text Extraction & Metadata Parsing** (✅ Complete)
- **Step 2: Text → Custom Chunks with Overlap & Strategy Selector** (✅ Complete)
- **Step 3: Chunks → Vector Embeddings & Pairwise Cosine Similarity Engine** (✅ Complete)
- **Step 4: Embeddings → Vector DB Storage & Collection Indexing** (✅ Complete)
- **Step 5: Question → Query Vector Embedding** (✅ Complete)
- **Step 6: Top-K Vector Nearest Neighbor Search** (✅ Complete)
- **Step 7: Context + Question → LLM Synthesis & Citation Engine** (✅ Complete)

---

## 🚀 Active Pipeline Features (Steps 1 to 7)

### 📄 Step 1: PDF → Text Extraction
- **Server-Side PDF Parser**: Built on `pdf-parse` within Next.js API Routes running on the Node.js runtime.
- **Text Cleaning & Sanitization**: Filters out null bytes, non-printable control characters, normalizes line endings, and cleans excessive whitespace.
- **Per-Page Text Breakdown**: Splits extracted content into page-by-page text blocks with per-page word and character metrics.

### ✂️ Step 2: Text → Chunks Engine
- **Multi-Strategy Chunking Core**: Supports **Recursive Character Chunking**, **Fixed-Size Sliding Window**, **Sentence Boundary Chunking**, and **Markdown Header Chunking**.
- **Interactive Controls**: Real-time sliders for **Chunk Size (100–1500 chars)** and **Chunk Overlap (0–500 chars)**.
- **Page Attribution Mapping**: Maps character indices back to original PDF pages (`Page 1`, `Pages 1-2`).

### 🧬 Step 3: Vector Embeddings Engine
- **Vector Generation Engine**: Powered exclusively by **NVIDIA Nemotron** (`nemotron-3-embed-1b` 1024d) with automatic **Deterministic Unit-Vector Fallback Generator** for offline testing.
- **Cosine Similarity Matrix**: Computes pairwise cosine similarity scores ($\cos(\theta) = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\| \|\mathbf{B}\|}$) across all document chunks.

### 📦 Step 4: Vector DB Store
- **In-Memory & Storage Vector Index**: Store and index vectors with distance metrics (`Flat Cosine Index`), payload metadata, collection memory statistics, and search previews.

### 🔍 Steps 5–7: End-to-End RAG Query & LLM Synthesis
- **Interactive Q&A Search Bar**: Submit questions with 1-click sample prompt chips.
- **Top-K & Similarity Threshold Controls**: Real-time sliders for $K$ (1–5) and min similarity threshold.
- **Ranked Top-K Search Cards**: Displays similarity score percentages, rank badges (`#1 Top Match`), page attributions, and progress score bars.
- **Assembled Prompt Inspector**: View system instructions and assembled context blocks sent to the LLM.
- **LLM Answer Generation**: Synthesizes structured answers using NVIDIA Nemotron (`nvidia/nemotron-3-super-120b-a12b` 120B NIM) or an offline smart RAG synthesizer, with page and chunk citations (`[Page 1, Chunk #2]`).

---

## 🗺️ 10-Step RAG Architecture Roadmap

| Step | Phase | Status | Description |
| :--- | :--- | :---: | :--- |
| **Step 1** | **PDF → Text** | ✅ **Complete** | Extract raw text, per-page breakdown & metadata using `pdf-parse` |
| **Step 2** | **Text → Chunks** | ✅ **Complete** | Recursive character, fixed, sentence & markdown chunking with overlap |
| **Step 3** | **Chunks → Embeddings**| ✅ **Complete** | NVIDIA Nemotron `nemotron-3-embed-1b` 1024d vectors & pairwise cosine similarity matrix |
| **Step 4** | **Embeddings → Vector DB**| ✅ **Complete** | Index and store vector embeddings with memory stats & payload table |
| **Step 5** | **Question → Embedding**| ✅ **Complete** | Convert user queries into 1024d dense query vector representations |
| **Step 6** | **Vector Search** | ✅ **Complete** | Cosine similarity ranking & Top-K nearest neighbor retrieval |
| **Step 7** | **Context + Question → LLM**| ✅ **Complete** | Assemble prompts & synthesize NVIDIA Nemotron 120B answers with page citations |
| **Step 10**| **Conversation Memory** | ⏳ Pending | Multi-turn chat history management & session memory |
| **Step 11**| **Optimization** | ⏳ Pending | Hybrid search (Keyword + Vector) and Cohere re-ranking |
| **Step 12**| **Production Deploy** | ⏳ Pending | Vercel deployment, rate limiting, and observability |

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **PDF Extraction**: [pdf-parse](https://www.npmjs.com/package/pdf-parse)
- **Utilities**: `clsx`, `tailwind-merge`

---

## 📂 Project Structure

```
rag-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── pdf/
│   │   │       └── parse/
│   │   │           └── route.ts          # POST endpoint for PDF extraction
│   │   ├── globals.css                   # Global styles & custom scrollbars
│   │   ├── layout.tsx                    # Root layout with dark theme
│   │   └── page.tsx                      # Dashboard & Step 1 Workbench page
│   ├── components/
│   │   ├── ExtractedTextViewer.tsx       # Tabbed text, metadata, & JSON viewer
│   │   ├── PdfUploader.tsx               # Drag & drop uploader with sample PDF test
│   │   └── PipelineStepper.tsx           # 12-Step RAG architecture stepper UI
│   └── lib/
│       └── pdf/
│           └── extractor.ts              # PDF extraction engine wrapper & text cleaner
├── scripts/
│   └── test-pdf-parse.js                 # Standalone CLI test script for PDF extraction
├── .env.example                          # Configuration template for future RAG steps
├── next.config.mjs                       # Next.js configuration
├── package.json                          # Dependencies & scripts
├── tailwind.config.ts                    # Tailwind CSS configuration
└── tsconfig.json                         # TypeScript configuration
```

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js 18.x or higher
- npm or yarn

### 2. Installation

Clone the repository and install dependencies:

```bash
cd /home/amaan/Desktop/rag-app
npm install
```

### 3. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

*(Note: Step 1 runs 100% standalone and does not require external API keys).*

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

### Automated CLI Extraction Test
Run the standalone test script to verify `pdf-parse` extraction logic on a generated sample PDF buffer:

```bash
node scripts/test-pdf-parse.js
```

### Type Checking
Verify TypeScript types across the project:

```bash
npx tsc --noEmit
```

---

## 📡 API Reference (Step 1)

### `POST /api/pdf/parse`

Parses an uploaded PDF file and returns structured text, page breakdown, stats, and metadata.

#### Request
- **Content-Type**: `multipart/form-data`
- **Body**: `file` (File object, `.pdf`)

#### Example Response
```json
{
  "success": true,
  "filename": "sample_rag_architecture.pdf",
  "numPages": 2,
  "info": {
    "title": "Retrieval-Augmented Generation Overview",
    "author": "RAG Architect"
  },
  "rawText": "...",
  "cleanedText": "...",
  "stats": {
    "charCount": 1420,
    "wordCount": 215,
    "estimatedTokens": 355,
    "fileSizeBytes": 1024
  },
  "pages": [
    {
      "pageNumber": 1,
      "text": "...",
      "charCount": 710,
      "wordCount": 108
    }
  ],
  "extractedAt": "2026-08-16T07:22:50.000Z"
}
```

---

## 📄 License

MIT License.
