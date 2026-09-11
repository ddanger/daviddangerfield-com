import { spawnSync } from 'node:child_process'

// The Homebrew path where `brew install ffmpeg-full` lands its binary — the
// only build with the drawtext filter the resume-share image needs. Shared
// so setup.mjs (installs it) and generate-resume-share.mjs (uses it) agree
// on where to look.
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
