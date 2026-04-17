/**
 * POST /api/worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Background worker endpoint that executes the video generation pipeline.
 * This endpoint is designed to run in a separate Vercel function or background
 * worker process, isolated from the request/response cycle of /api/generate.
 *
 * Expected body: { jobId: string }
 *
 * This worker:
 * 1. Fetches job details from Redis
 * 2. Runs the full pipeline: script → TTS → avatar → composite → Drive upload
 * 3. Updates job status in Redis throughout
 * 4. Handles errors gracefully and marks job as FAILED on any pipeline error
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getJob, updateJob, updateChapter, setJobDone, setJobFailed } from '../../src/lib/jobStore';
import {
  generateScript, synthesiseSpeech, renderAvatar,
} from '../../src/lib/nimClient';
import { compositeVideo } from '../../src/lib/ffmpegCompositor';
import { uploadVideoToDrive } from '../../src/lib/driveClient';

// Allow longer execution for video processing (Vercel Pro: 5min, Enterprise: 15min)
export const config = {
  api: {
    bodyParser: true,
    externalResolver: true, // suppress "resolved without sending response" warning
  },
};

const CHAPTER_DURATION = 2; // minutes per chapter (must match generate.ts)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.body ?? {};

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId is required' });
  }

  try {
    // ── Fetch job details ───────────────────────────────────────────────────
    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: `Job ${jobId} not found` });
    }

    console.log(`[Worker] Starting job ${jobId}: ${job.totalChapters} chapters`);

    // Mark as processing (phase not status) - using SCRIPTING as first phase
    await updateJob(jobId, { phase: 'SCRIPTING' as const });

    const chapterBuffers: Buffer[] = new Array(job.totalChapters);

    // ── Process chapters in parallel batches ─────────────────────────────────
    const concurrency = Math.min(job.totalChapters, 5); // max 5 concurrent
    const indexes = Array.from({ length: job.totalChapters }, (_, i) => i);

    for (let batchStart = 0; batchStart < job.totalChapters; batchStart += concurrency) {
      const batch = indexes.slice(batchStart, batchStart + concurrency);

      await Promise.all(batch.map(async (chIdx) => {
        try {
          // Phase 1: Scripting
          await updateChapter(jobId, chIdx, { phase: 'SCRIPTING', progress: 10 });

          const script = await generateScript({
            topic:         job.prompt,
            language:      job.language as any,
            durationMins:  CHAPTER_DURATION,
            chapterIndex:  chIdx,
            totalChapters: job.totalChapters,
          });

          await updateChapter(jobId, chIdx, { phase: 'SYNTHESISING', progress: 35, title: script.title });

          // Phase 2: TTS
          const tts = await synthesiseSpeech({ text: script.script, language: job.language });

          await updateChapter(jobId, chIdx, { phase: 'AVATAR', progress: 65 });

          // Phase 3: Avatar
          const avatar = await renderAvatar({
            audioBase64:  tts.audioBase64,
            avatarId:    job.avatarId,
            emotionStyle: 'engaged',
          });

          // Chapter complete
          await updateChapter(jobId, chIdx, { phase: 'DONE', progress: 100 });

          // Store model info from first chapter
          if (chIdx === 0) {
            await updateJob(jobId, {
              models: {
                llm:          script.model,
                tts:          tts.model,
                avatar:       avatar.model,
                usedFallback: script.usedFallback || tts.usedFallback,
              },
            });
          }

          chapterBuffers[chIdx] = Buffer.from(avatar.videoBase64, 'base64');
          console.log(`[Worker] ${jobId}: Chapter ${chIdx + 1}/${job.totalChapters} ✓`);

        } catch (err: any) {
          console.error(`[Worker] ${jobId}: Chapter ${chIdx + 1} failed — ${err.message}`);
          await updateChapter(jobId, chIdx, { phase: 'FAILED', progress: 0 });
          throw err; // abort entire job
        }
      }));
    }

    // Verify all chapters completed
    const updatedJob = await getJob(jobId);
    if (!updatedJob || updatedJob.chapters.some(ch => ch.phase === 'FAILED')) {
      throw new Error('One or more chapters failed');
    }

    // ── Compositing ─────────────────────────────────────────────────────────
    console.log(`[Worker] ${jobId}: Compositing ${job.totalChapters} chapters...`);
    await updateJob(jobId, { phase: 'COMPOSITING' as const });

    const finalVideoBuffer = await compositeVideo(chapterBuffers);

    // ── Upload to Google Drive ───────────────────────────────────────────────
    console.log(`[Worker] ${jobId}: Uploading to Google Drive...`);
    const fileName = `obsidian-${jobId}.mp4`;
    const gDriveData = await uploadVideoToDrive(fileName, finalVideoBuffer);

    // ── Complete ────────────────────────────────────────────────────────────
    const videoId = `video-${jobId}-${Date.now()}`;
    await setJobDone(jobId, videoId, gDriveData.webContentLink || gDriveData.webViewLink);

    console.log(`[Worker] ${jobId}: Complete → ${videoId}`);
    res.json({ success: true, videoId, driveLink: gDriveData.webContentLink });

  } catch (err: any) {
    console.error(`[Worker] Job ${jobId} failed:`, err);
    await setJobFailed(jobId, err.message || 'Unknown worker error');
    res.status(500).json({ error: err.message || 'Pipeline failed' });
  }
}
