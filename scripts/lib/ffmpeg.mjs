import { spawnSync } from 'node:child_process'

// `brew install ffmpeg-full` is the only build with the drawtext filter the
// resume-share image needs. setup.mjs installs it here; generate-resume-share
// uses it.
export const HOMEBREW_FFMPEG_FULL_BIN = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'

export function checkCommand(bin, args) {
  return spawnSync(bin, args, { encoding: 'utf8' })
}

export function hasDrawtextFilter(ffmpegBin) {
  const check = checkCommand(ffmpegBin, ['-hide_banner', '-filters'])
  if (check.error || check.status !== 0) {
    return false
  }

  return check.stdout.includes('drawtext')
}
