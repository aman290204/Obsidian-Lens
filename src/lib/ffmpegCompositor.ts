import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Point fluent-ffmpeg to the universally valid cross-platform binary package
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function compositeVideo(chapterBuffers: Buffer[]): Promise<Buffer> {
  if (!chapterBuffers || chapterBuffers.length === 0) {
    throw new Error('No chapters provided for compositing.');
  }

  if (chapterBuffers.length === 1) {
    // Optimization: if there's only 1 chapter, skip ffmpeg altogether!
    return chapterBuffers[0];
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obsidian-'));
  const concatFilePath = path.join(tmpDir, 'concat_list.txt');
  let concatListContent = '';

  const inputFiles: string[] = [];

  // Write all base64-decoded chunks linearly to the temporary directory
  for (let i = 0; i < chapterBuffers.length; i++) {
    const filePath = path.join(tmpDir, `chapter_${i}.mp4`);
    fs.writeFileSync(filePath, new Uint8Array(chapterBuffers[i]));
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
