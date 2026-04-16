# Product Requirements Document (PRD)
**Project Name:** Obsidian Lens (AI Video Mastery Studio)
**Status:** V1.0 Finalized 
**Tech Stack:** Node.js, Vercel (Edge & Workers), Tailwind CSS, NVIDIA NIM, Google Drive API

## 1. Product Overview
**Vision:** To build a frictionless, mass-market B2C platform that instantly synthesizes cinematic, highly engaging explainer videos on any topic. 
**Core Value:** Generating 5 to 60-minute explainer videos featuring animated slides and a photorealistic human presenter, explicitly localized for Indian audiences using natural code-mixing (Hinglish, Conversational Marathi, Basic English).
**Design Philosophy:** "The Obsidian Lens." A premium, dark-mode, glassmorphic UI that feels like a high-end production suite rather than a standard SaaS dashboard.

## 2. Core Features & Capabilities

### A. Intelligent Scripting & Localization
* **Frictionless Input:** Users generate comprehensive videos from a single, simple text prompt (e.g., "Explain how the stock market works").
* **Colloquial Generation:** The LLM bypasses robotic textbook tones, drafting scripts in natural, everyday conversational language (Hinglish, Marathi, Simple English).
* **Dynamic Duration:** Strict user control over video length, scaling from 5 minutes to a maximum of 60 minutes.

### B. Visual & Audio Engine
* **Automated Slide Generation:** Dynamic creation of visual milestones, text reveals, and basic animations to maintain viewer retention over long durations.
* **Photorealistic Avatars:** Integration of high-fidelity 3D presenters with accurate lip-syncing and micro-expressions.
* **Regional Voice Synthesis:** Text-to-Speech (TTS) optimized for natural Indian intonations and accents.

## 3. System Architecture (The "No-Friction" Backend)

To handle massive 60-minute video generation without latency or severe compute costs, the backend relies on high-speed parallel processing and API pooling.

| Component | Technology | Implementation Strategy |
| :--- | :--- | :--- |
| **Backend Framework** | Node.js / Vercel | Vercel Edge Functions handle the ultra-low latency API routing, while dedicated background workers handle the heavy FFmpeg video compositing. |
| **AI Processing** | NVIDIA NIM | Utilizes Nemotron/Llama 3 for scripting, Riva for TTS, and Audio2Face-3D for avatar generation. |
| **API Pooling (Throughput)** | Custom Router | The backend stores 4 to 5 NVIDIA NIM API keys, acting as a load balancer (Round-Robin). This bumps the standard 35 RPM limit to a massive **140–175 RPM**, allowing simultaneous multi-threaded generation. |
| **Storage Solution** | Google Drive API | Bypasses AWS S3 costs. The backend uses a Google Cloud Service Account and Resumable Uploads to pipe the massive FFmpeg output streams directly into a 15TB Google Drive vault. |

## 4. Frontend File Structure & Components

The frontend maps directly to the "Obsidian Lens" design system. Based on your local environment setup, the UI components are divided into specific workflow directories:

* **`\creation_zone` (The Input Module):** Contains the primary interface where users input prompts, select language (Hinglish/Marathi), define duration, and choose their NVIDIA Audio2Face Persona.
* **`\processing_dashboard` (The Waiting Room):** Houses the multi-step real-time progress tracker and "Live Engine Status" components. Displays chunking progress as the API pool processes the video in parallel.
* **`\the_cinema` (The Delivery Module):** The screening room interface featuring a premium video player, embedded metadata, and direct download/sharing links pulled from the Google Drive API.
* **`\user_library` (The Archive):** A responsive grid layout component displaying thumbnail previews and durations of previously synthesized video assets. 
* **`\lumina_synth` (The Core Visual Engine):** The overarching design assets, Tailwind configuration, and glassmorphic CSS rules that govern the "no-line" floating UI across all screens.

## 5. Execution Flow (Step-by-Step)

1. **Initiation:** User submits a prompt, duration, and language in the `creation_zone`.
2. **Parallel Chunking:** The Vercel Node.js backend splits the requested duration (e.g., 60 minutes) into 2-minute "Chapters."
3. **API Routing:** The backend fires off simultaneous requests for Chapter 1, 2, 3, etc., routing them across the 5 pooled NVIDIA NIM keys to maximize the 175 RPM limit without hitting 429 errors.
4. **User Feedback:** The `processing_dashboard` updates in real-time as individual chapters complete audio and avatar synthesis.
5. **Compositing & Upload:** FFmpeg stitches the audio, avatar, and slides together, streaming the data directly via Resumable Upload to the 15TB Google Drive.
6. **Delivery:** The `the_cinema` module retrieves the public `webContentLink` from Drive, allowing the user to watch or download the final MP4.

## 6. Technical Constraints & Mitigations

* **Vercel Timeout Limits:** Standard serverless functions time out after 10–60 seconds. The video rendering and Drive upload logic must be strictly assigned to Vercel Background Functions or an independent worker process.
* **API Key Burnout:** The token bucket algorithm must continuously monitor the health of all 5 NVIDIA API keys. If one key throws an error, the system must instantly pause it and redistribute the queue to the remaining active keys.
* **Memory Overload:** At no point should a 60-minute raw video be temporarily saved to the server's disk space. FFmpeg must be piped directly to the Google Drive API to maintain low overhead.