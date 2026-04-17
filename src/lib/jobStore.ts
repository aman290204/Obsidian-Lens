/**
 * Job Store - Final Architecture (Step-Based State Machine)
 * ─────────────────────────────────────────────────────────────────────────────
 * Jobs are stored in Redis with a flat schema optimized for stateless workers.
 * Each worker invocation moves the job forward ONE STEP, then re-triggers itself.
 *
 * Job Stages:
 *   starting     → job created, waiting to start NVIDIA
 *   generating   → NVIDIA is producing video (multiple sub-steps)
 *   uploading    → pushing final video to Google Drive
 *   done         → complete, Drive link ready
 *   failed       → error occurred
 */

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type JobStage = 'starting' | 'generating' | 'uploading' | 'done';

export interface JobRecord {
  // Identity
  jobId:         string;
  userId:        string; // for folder organization

  // State Machine
  status:        JobStatus;
  stage:         JobStage;
  progress:      number; // 0-100 overall

  // Async Operation Tracking
  taskId:        string | null; // NVIDIA async task ID (if supported)
  error:         string | null;

  // Timestamps
  createdAt:     number;
  lastUpdated:   number;

  // Metadata (for reference)
  prompt?:       string;
  language?:     string;
  durationMins?: number;
  avatarId?:     string;
  totalChapters?: number;

  // Output
  url?:          string;  // Google Drive download link
  videoId?:      string;  // local tracking ID

  // Technical
  models?: {
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
  userId:       string;
  prompt?:      string;
  language?:    string;
  durationMins?: number;
  avatarId?:    string;
  totalChapters?: number;
}): Promise<JobRecord> {
  const now = Date.now();
  const record: JobRecord = {
    jobId:         params.jobId,
    userId:        params.userId,
    status:        'queued',
    stage:         'starting',
    progress:      0,
    taskId:        null,
    error:         null,
    createdAt:     now,
    lastUpdated:   now,
    // Optional metadata
    prompt:        params.prompt,
    language:      params.language,
    durationMins:  params.durationMins,
    avatarId:      params.avatarId,
    totalChapters: params.totalChapters,
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

  const updated: JobRecord = { ...job, ...patch, lastUpdated: Date.now() };
  await saveToRedis(updated);
  return updated;
}

// Step-based completion helpers (no chapters in new schema)
export async function markJobProcessing(jobId: string, stage: JobStage, progress: number, taskId?: string): Promise<JobRecord | undefined> {
  const updates: Partial<JobRecord> = {
    status: 'processing',
    stage,
    progress,
    lastUpdated: Date.now(),
  };
  if (taskId) updates.taskId = taskId;
  return await updateJob(jobId, updates);
}

export async function markJobCompleted(jobId: string, url: string, videoId?: string): Promise<JobRecord | undefined> {
  return await updateJob(jobId, {
    status: 'completed',
    stage: 'done',
    progress: 100,
    url,
    videoId,
    lastUpdated: Date.now(),
  });
}

export async function markJobFailed(jobId: string, error: string): Promise<JobRecord | undefined> {
  return await updateJob(jobId, {
    status: 'failed',
    error,
    lastUpdated: Date.now(),
  });
}

export async function listJobs(): Promise<JobRecord[]> {
  return await listFromRedis();
}

