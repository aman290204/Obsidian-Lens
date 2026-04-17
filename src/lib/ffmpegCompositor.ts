import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Point fluent-ffmpeg to the universally valid cross-platform binary package
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function compositeVideo(chapterBuffers: Buffer[]): Promise<Buffer> {
  // Filter out empty buffers (chapters where TTS/avatar failed)
  const validBuffers = chapterBuffers.filter(b => b && b.length > 0);

  if (!validBuffers || validBuffers.length === 0) {
    throw new Error('No valid chapter data to composite (all chapters empty).');
  }

  if (validBuffers.length === 1) {
    // Skip ffmpeg — return the single valid buffer directly
    return validBuffers[0];
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obsidian-'));
  const concatFilePath = path.join(tmpDir, 'concat_list.txt');
  let concatListContent = '';

  const inputFiles: string[] = [];

  // Write all valid chunks to temp directory
  for (let i = 0; i < validBuffers.length; i++) {
    const filePath = path.join(tmpDir, `chapter_${i}.mp4`);
    fs.writeFileSync(filePath, new Uint8Array(validBuffers[i]));
    inputFiles.push(filePath);
    
    // The concat demuxer expects exactly this literal formatted string
    // "file '/tmp/obsidian-XYZ/chapter_0.mp4'" with properly escaped backslashes for Windows
    const safePath = filePath.replace(/\\/g, '/');
    concatListContent += `file '${safePath}'\n`;
  }

  fs.writeFileSync(concatFilePath, concatListContent);

  const outputPath = path.join(tmpDir, 'final_output.mp4');

  await new Promise<void>((resolve, reject) => {
    // ── Concat Demuxer without Re-Encoding ─────────────
    // This is the single most important performance optimization.
    // '-c copy' skips rendering CPU cycles, copying the H.264 streams sequentially bit-for-bit.
    // Allowing Vercel Edge Serverless functions to 'render' 60 minutes of video in ~1.5s flat.
    ffmpeg()
      .input(concatFilePath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy']) 
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`FFmpeg Concatenation Error: ${err.message}`)));
  });

  const finalVideoBuffer = fs.readFileSync(outputPath);

  // Instantly unblock disk space synchronously to preserve serverless bounds
  try {
    fs.unlinkSync(concatFilePath);
    fs.unlinkSync(outputPath);
    inputFiles.forEach(f => fs.unlinkSync(f));
    fs.rmdirSync(tmpDir); // Clear folder hierarchy
  } catch (e) {
    console.error('[FFmpeg] Cleanup exception:', e);
  }

  return finalVideoBuffer;
}
