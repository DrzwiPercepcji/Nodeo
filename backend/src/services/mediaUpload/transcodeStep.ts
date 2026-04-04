import {
  transcodeVideo, transcodeAudio, probeDuration,
} from '../transcoding.js';
import { setMediaJobProgress } from '../processingProgress.js';
import { P_TRANSCODE, overallTranscode } from './progressBands.js';

/** Transcode source → output file; updates job progress; returns duration (seconds) of output. */
export async function transcodeForUpload(params: {
  mediaId: string;
  mediaType: 'video' | 'audio';
  inputPath: string;
  outputPath: string;
  profileName: string;
}): Promise<number> {
  const { mediaId, mediaType, inputPath, outputPath, profileName } = params;

  const inputDurationSec = await probeDuration(inputPath);
  setMediaJobProgress(mediaId, {
    stage: 'transcoding',
    overall_percent: 0,
    current_sec: 0,
    total_sec: inputDurationSec,
  });

  const onProgress = ({ ffmpegPercent, currentSec }: { ffmpegPercent: number; currentSec: number }) => {
    setMediaJobProgress(mediaId, {
      stage: 'transcoding',
      overall_percent: overallTranscode(ffmpegPercent),
      current_sec: Math.round(currentSec),
      total_sec: inputDurationSec,
    });
  };

  if (mediaType === 'video') {
    console.log(`[${mediaId}] Transcoding video with profile ${profileName}...`);
    await transcodeVideo(inputPath, outputPath, profileName, {
      durationSec: inputDurationSec,
      onProgress,
    });
  } else {
    console.log(`[${mediaId}] Transcoding audio with profile ${profileName}...`);
    await transcodeAudio(inputPath, outputPath, profileName, {
      durationSec: inputDurationSec,
      onProgress,
    });
  }

  const totalForBar = inputDurationSec ?? null;
  setMediaJobProgress(mediaId, {
    stage: 'transcoding',
    overall_percent: P_TRANSCODE[1],
    current_sec: totalForBar,
    total_sec: totalForBar,
  });

  const outDur = await probeDuration(outputPath);
  return outDur ?? 0;
}
