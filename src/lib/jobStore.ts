/**
 * In-memory job store
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks the state of every video generation job within the Node.js process.
 * In production, replace with Redis or a database for persistence across
 * Vercel serverless function instances.
 *
 * Each job progresses through phases:
 *   QUEUED → SCRIPTING → SYNTHESISING → AVATAR → COMPOSITING → DONE | FAILED
 */

export type JobPhase =
  | 'QUEUED'
  | 'SCRIPTING'
  | 'SYNTHESISING'
  | 'AVATAR'
  | 'COMPOSITING'
  | 'DONE'
  | 'FAILED';

export interface ChapterStatus {
  index:    number;
  phase:    JobPhase;
  title?:   string;
  progress: number; // 0–100 within this chapter
}

export interface JobRecord {
  jobId:         string;
  prompt:        string;
  language:      string;
  durationMins:  number;
  avatarId:      string;
  totalChapters: number;

  phase:         JobPhase;
  overallProgress: number; // 0–100

  chapters:      ChapterStatus[];
  startedAt:     number;
  updatedAt:     number;
  completedAt?:  number;

  videoId?:      string;  // local ID
  driveLink?:    string;  // Google Drive url
  errorMessage?: string;  // set when FAILED

  models: {
    llm:    string;
    tts:    string;
    avatar: string;
    usedFallback: boolean;
  };
}

import { saveJob as saveToRedis, getJob as getFromRedis, listJobs as listFromRedis } from './redisStore';

// ── CRUD helpers (Persisted via Redis) ───────────────────────────────────────
export async function createJob(params: {
  jobId:        string;
  prompt:       string;
  language:     string;
  durationMins: number;
  avatarId:     string;
  totalChapters: number;
}): Promise<JobRecord> {
  const now = Date.now();
  const record: JobRecord = {
    ...params,
    phase:           'QUEUED',
    overallProgress: 0,
    chapters: Array.from({ length: params.totalChapters }, (_, i) => ({
      index:    i,
      phase:    'QUEUED',
      progress: 0,
    })),
    startedAt: now,
    updatedAt: now,
    models: {
      llm:          process.env.NIM_LLM_PRIMARY  || 'qwen/qwen3.5-122b-a10b',
      tts:          process.env.NIM_TTS_PRIMARY  || 'magpie-tts-multilingual',
      avatar:       process.env.NIM_AVATAR       || 'audio2face-3d',
      usedFallback: false,
    },
  };

  await saveToRedis(record);
  return record;
}

export async function getJob(jobId: string): Promise<JobRecord | undefined> {
  return await getFromRedis(jobId);
}

export async function updateJob(jobId: string, patch: Partial<JobRecord>): Promise<JobRecord | undefined> {
  const job = await getFromRedis(jobId);
  if (!job) return undefined;

  const updated: JobRecord = { ...job, ...patch, updatedAt: Date.now() };
  await saveToRedis(updated);
  return updated;
}

export async function updateChapter(
  jobId: string,
  chapterIndex: number,
  patch: Partial<ChapterStatus>
): Promise<JobRecord | undefined> {
  const job = await getFromRedis(jobId);
  if (!job) return undefined;

  const chapters = [...job.chapters];
  chapters[chapterIndex] = { ...chapters[chapterIndex], ...patch };

  const overallProgress = Math.round(
    chapters.reduce((sum, c) => sum + c.progress, 0) / chapters.length
  );

  return await updateJob(jobId, { chapters, overallProgress });
}

export async function setJobDone(jobId: string, videoId: string, driveLink: string): Promise<JobRecord | undefined> {
  return await updateJob(jobId, {
    phase:           'DONE',
    overallProgress: 100,
    videoId,
    driveLink,
    completedAt:     Date.now(),
  });
}

export async function setJobFailed(jobId: string, errorMessage: string): Promise<JobRecord | undefined> {
  return await updateJob(jobId, {
    phase:        'FAILED',
    errorMessage,
    completedAt:  Date.now(),
  });
}

export async function listJobs(): Promise<JobRecord[]> {
  return await listFromRedis();
}

