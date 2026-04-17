/**
 * POST /api/worker - Step-Based State Machine
 * Each invocation moves the job forward ONE STEP, then re-triggers itself.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getJob, updateJob, markJobCompleted, markJobFailed } from '../../src/lib/jobStore';
import { generateScript, synthesiseSpeech, renderAvatar } from '../../src/lib/nimClient';
import { compositeVideo } from '../../src/lib/ffmpegCompositor';
import { uploadVideoToDrive, ensureFolderExists } from '../../src/lib/driveClient';
import { getFromRedis, saveToRedis } from '../../src/lib/redisStore';

export const config = { api: { bodyParser: true, externalResolver: true } };

const CHAPTER_DURATION = 2;
const WORKER_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_RETRIES = 5; // Prevent infinite loops

// Folder ID cache (Redis-backed in production)
const folderCache = new Map<string, string>();
function getFolderCacheKey(userId: string): string {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const dd = String(now.getDate()).padStart(2,'0');
  return `/videos/${ym}/${dd}/${userId}`;
}

function getFolderPath(userId: string): string {
  return getFolderCacheKey(userId) + '/';
}

// Structured logging helper
function logJobEvent(jobId: string, stage: string, message: string, meta?: Record<string, any>) {
  const log = {
    jobId,
    stage,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };
  console.log(JSON.stringify(log)); // Use structured logging (send to service in prod)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.body ?? {};
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId is required' });
  }

  try {
    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: `Job ${jobId} not found` });
    }

    // Idempotency guard
    if (job.status === 'completed') {
      return res.json({ ok: true, reason: 'already completed' });
    }

    // Retry limit check - PREVENT INFINITE LOOPS
    if (job.retryCount >= MAX_RETRIES) {
      await markJobFailed(jobId, `Max retries (${MAX_RETRIES}) exceeded`);
      logJobEvent(jobId, 'failed', `Max retries exceeded (count: ${job.retryCount})`);
      return res.json({ ok: true, reason: 'max-retries' });
    }

    // Timeout guard
    if (Date.now() - job.lastUpdated > WORKER_TIMEOUT_MS) {
      await markJobFailed(jobId, 'Worker timeout - job stalled');
      logJobEvent(jobId, 'failed', 'Job timeout - stalled');
      return res.json({ ok: true, reason: 'timeout' });
    }

    // State machine
    if (job.stage === 'starting') {
      await handleStarting(job);
    } else if (job.stage === 'generating') {
      await handleGenerating(job);
    } else if (job.stage === 'uploading') {
      await handleUploading(job);
    } else {
      await markJobFailed(jobId, `Unknown stage: ${job.stage}`);
      logJobEvent(jobId, 'failed', `Unknown stage: ${job.stage}`);
      return res.status(500).json({ error: 'Invalid job stage' });
    }

    return res.json({ ok: true });

  } catch (err: any) {
    logJobEvent(jobId, 'error', `Worker exception`, { error: err.message });
    await markJobFailed(jobId, err.message || 'Unknown worker error');
    return res.status(500).json({ error: err.message || 'Pipeline failed' });
  }
}

async function handleStarting(job: any) {
  const totalChapters = job.totalChapters || Math.ceil((job.durationMins || 15) / CHAPTER_DURATION);

  await updateJob(job.jobId, {
    stage: 'generating',
    progress: 5,
    lastUpdated: Date.now(),
  });

  logJobEvent(job.jobId, 'starting', `Starting generation (${totalChapters} chapters)`);

  // Increment retry count before self-triggering
  await updateJob(job.jobId, {
    retryCount: (job.retryCount || 0) + 1,
    lastUpdated: Date.now()
  });

  await selfTrigger(job.jobId);
}

async function handleGenerating(job: any) {
  const totalChapters = job.totalChapters || Math.ceil((job.durationMins || 15) / CHAPTER_DURATION);

  // Check if we have chapter results stored
  const chapterBuffers: Buffer[] = new Array(totalChapters);
  let startChapter = 0;

  for (let i = 0; i < totalChapters; i++) {
    const chapterData = await getChapterResult(job.jobId, i);
    if (chapterData?.videoBase64) {
      chapterBuffers[i] = Buffer.from(chapterData.videoBase64, 'base64');
      startChapter = i + 1;
    }
  }

  logJobEvent(job.jobId, 'generating', `Resuming from chapter ${startChapter + 1}/${totalChapters}`);

  // Process remaining chapters one at a time
  for (let chIdx = startChapter; chIdx < totalChapters; chIdx++) {
    try {
      await updateJob(job.jobId, {
        progress: Math.round((chIdx / totalChapters) * 60) + 5,
        lastUpdated: Date.now(),
      });

      // Generate
      const script = await generateScript({
        topic: job.prompt || 'Untitled',
        language: (job.language as any) || 'english',
        durationMins: CHAPTER_DURATION,
        chapterIndex: chIdx,
        totalChapters,
      });

      // TTS
      const tts = await synthesiseSpeech({ text: script.script, language: job.language || 'english' });

      // Avatar
      const avatar = await renderAvatar({
        audioBase64: tts.audioBase64,
        avatarId: job.avatarId || 'ethan',
        emotionStyle: 'engaged',
      });

      // Store chapter result
      await saveChapterResult(job.jobId, chIdx, {
        videoBase64: avatar.videoBase64,
        script: script.script,
        title: script.title,
        completedAt: Date.now(),
      });

      logJobEvent(job.jobId, 'generating', `Chapter ${chIdx + 1}/${totalChapters} done`);

      // Re-trigger to continue (avoid timeout)
      if (chIdx < totalChapters - 1) {
        // Increment retry count before self-trigger
        await updateJob(job.jobId, {
          retryCount: (job.retryCount || 0) + 1,
          lastUpdated: Date.now()
        });
        await selfTrigger(job.jobId);
        return;
      }

    } catch (err: any) {
      logJobEvent(job.jobId, 'error', `Chapter ${chIdx + 1} failed`, { error: err.message });
      await markJobFailed(job.jobId, `Chapter ${chIdx + 1} failed: ${err.message}`);
      throw err;
    }
  }

  // All chapters complete
  await updateJob(job.jobId, {
    stage: 'uploading',
    progress: 70,
    lastUpdated: Date.now(),
  });

  // Increment retry count before self-trigger
  await updateJob(job.jobId, {
    retryCount: (job.retryCount || 0) + 1,
    lastUpdated: Date.now()
  });

  await selfTrigger(job.jobId);
}

async function handleUploading(job: any) {
  const totalChapters = job.totalChapters || Math.ceil((job.durationMins || 15) / CHAPTER_DURATION);

  // Load all chapter buffers
  const chapterBuffers: Buffer[] = [];
  for (let i = 0; i < totalChapters; i++) {
    const chapterData = await getChapterResult(job.jobId, i);
    if (!chapterData?.videoBase64) {
      throw new Error(`Missing chapter ${i} data`);
    }
    chapterBuffers.push(Buffer.from(chapterData.videoBase64, 'base64'));
  }

  await updateJob(job.jobId, { progress: 75, lastUpdated: Date.now() });

  // Composite
  logJobEvent(job.jobId, 'uploading', 'Compositing video...');
  const finalVideoBuffer = await compositeVideo(chapterBuffers);

  await updateJob(job.jobId, { progress: 85, lastUpdated: Date.now() });

  // Upload with organized folder structure
  const folderPath = getFolderPath(job.userId);
  await ensureFolderExists(folderPath);

  const fileName = `${job.jobId}.mp4`;
  const driveResult = await uploadVideoToDrive(fileName, finalVideoBuffer, folderPath);

  await updateJob(job.jobId, { progress: 95, lastUpdated: Date.now() });

  // Complete - use webContentLink for direct download
  await markJobCompleted(job.jobId, driveResult.webContentLink, driveResult.fileId);
  logJobEvent(job.jobId, 'completed', `Video ready`, { driveUrl: driveResult.webViewLink });
}

async function selfTrigger(jobId: string): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://localhost:${process.env.PORT || 3000}`;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/api/worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        const msg = `HTTP ${res.status}: ${errorText}`;

        if (attempt < MAX_ATTEMPTS) {
          const delay = 1000 * attempt; // exponential backoff: 1s, 2s, 3s
          logJobEvent(jobId, 'warning', `Self-trigger attempt ${attempt} failed, retrying in ${delay}ms`, { error: msg });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        logJobEvent(jobId, 'error', `Self-trigger failed after ${MAX_ATTEMPTS} attempts`, { error: msg });
        return false;
      }

      logJobEvent(jobId, 'trigger', `Self-trigger successful (attempt ${attempt})`);
      return true;
    } catch (err: any) {
      if (attempt < MAX_ATTEMPTS) {
        const delay = 1000 * attempt;
        logJobEvent(jobId, 'warning', `Self-trigger network error (attempt ${attempt}), retrying`, { error: err.message });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      logJobEvent(jobId, 'error', `Self-trigger failed after ${MAX_ATTEMPTS} attempts`, { error: err.message });
      return false;
    }
  }

  return false;
}

// Chapter storage
async function saveChapterResult(jobId: string, chapterIndex: number, data: any) {
  const key = `job:${jobId}:chapter:${chapterIndex}`;
  await saveToRedis(key, { ...data, jobId, chapterIndex });
}

async function getChapterResult(jobId: string, chapterIndex: number) {
  const key = `job:${jobId}:chapter:${chapterIndex}`;
  return await getFromRedis(key);
}
