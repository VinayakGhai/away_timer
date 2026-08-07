import type { TimerStatus } from '@/types/timer'
import './ControlButtons.css'

interface ControlButtonsProps {
  status: TimerStatus
  onStart: () => void
  onPause: () => void
  onReset: () => void
  onEnterAway: () => void
  onExitAway: () => void
}

export function ControlButtons({
  status,
  onStart,
  onPause,
  onReset,
  onEnterAway,
  onExitAway,
}: ControlButtonsProps) {
  const isRunning = status === 'running'
  const isPaused = status === 'paused'
  const isAway = status === 'away'
  const isIdle = status === 'idle'
  const isCompleted = status === 'completed'

  const canStart = isIdle || isPaused || isCompleted
  const canPause = isRunning
  const canAway = (isRunning || isPaused || isIdle) && !isAway
  const canReset = !isIdle

  return (
    <div className="control-buttons">
      {canStart && (
        <button className="btn btn--primary" onClick={onStart}>
          <PlayIcon />
          {isPaused ? 'Resume' : 'Start'}
        </button>
      )}
      {canPause && (
        <button className="btn btn--secondary" onClick={onPause}>
          <PauseIcon />
          Pause
        </button>
      )}
      {isAway && (
        <button className="btn btn--back" onClick={onExitAway}>
          <BackIcon />
          I'm Back
        </button>
      )}
      {canAway && (
        <button className="btn btn--away" onClick={onEnterAway}>
          <AwayIcon />
          Away
        </button>
      )}
      {canReset && (
        <button className="btn btn--ghost" onClick={onReset}>
          <ResetIcon />
          Reset
        </button>
      )}
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    </svg>
  )
}

function AwayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-1.58 1.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08a5.99 5.99 0 01-5.65 4c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  )
}
