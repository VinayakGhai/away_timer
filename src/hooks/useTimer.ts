import { useCallback, useEffect, useRef, useState } from 'react'
import type { TimerState, TimerStatus } from '@/types/timer'
import { createInitialTimerState } from '@/utils/time'

interface UseTimerReturn {
  timer: TimerState
  awayElapsed: number
  setDuration: (seconds: number) => void
  start: () => void
  pause: () => void
  reset: () => void
  enterAway: () => void
  exitAway: () => void
  loadState: (state: TimerState) => void
}

export function useTimer(onTick?: (state: TimerState) => void): UseTimerReturn {
  const [timer, setTimer] = useState<TimerState>(createInitialTimerState(25 * 60))
  const [awayElapsed, setAwayElapsed] = useState(0)
  const timerRef = useRef(timer)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  timerRef.current = timer

  const updateTimer = useCallback(
    (updater: (prev: TimerState) => TimerState) => {
      setTimer((prev) => {
        const next = updater(prev)
        onTick?.(next)
        return next
      })
    },
    [onTick]
  )

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startTick = useCallback(() => {
    clearTick()
    intervalRef.current = setInterval(() => {
      const current = timerRef.current

      if (current.status === 'running' || current.status === 'away') {
        const isAway = current.status === 'away'
        
        if (isAway && current.awayStartTime) {
          const elapsed = Math.floor((Date.now() - current.awayStartTime) / 1000)
          setAwayElapsed(elapsed)
        }

        if (current.remainingTime <= 1 && !isAway) {
          clearTick()
          window.electronAPI?.trackEvent?.('Timer_Completed', { original_duration: current.originalDuration })
          setTimer((prev) => ({
            ...prev,
            remainingTime: 0,
            status: 'completed',
            lastUpdated: Date.now(),
          }))
          onTick?.({
            ...current,
            remainingTime: 0,
            status: 'completed',
            lastUpdated: Date.now(),
          })
        } else {
          setTimer((prev) => ({
            ...prev,
            remainingTime: Math.max(0, prev.remainingTime - 1),
            lastUpdated: Date.now(),
          }))
        }
      }
    }, 1000)
  }, [clearTick, onTick])

  useEffect(() => {
    if (timer.status === 'running' || timer.status === 'away') {
      startTick()
    } else {
      clearTick()
      setAwayElapsed(0)
    }
    return clearTick
  }, [timer.status, startTick, clearTick])

  const setDuration = useCallback(
    (seconds: number) => {
      clearTick()
      setAwayElapsed(0)
      updateTimer(() => createInitialTimerState(seconds))
    },
    [clearTick, updateTimer]
  )

  const start = useCallback(() => {
    updateTimer((prev) => {
      if (prev.status === 'completed' || prev.remainingTime <= 0) {
        window.electronAPI?.trackEvent?.('Timer_Started', { duration: prev.originalDuration })
        return {
          ...createInitialTimerState(prev.originalDuration),
          status: 'running',
          lastUpdated: Date.now(),
        }
      }
      if (prev.status !== 'running') {
        window.electronAPI?.trackEvent?.('Timer_Started', { duration: prev.remainingTime })
      }
      return { ...prev, status: 'running' as TimerStatus, lastUpdated: Date.now() }
    })
  }, [updateTimer])

  const pause = useCallback(() => {
    updateTimer((prev) => ({
      ...prev,
      status: prev.status === 'running' ? 'paused' : prev.status,
      lastUpdated: Date.now(),
    }))
  }, [updateTimer])

  const reset = useCallback(() => {
    clearTick()
    setAwayElapsed(0)
    updateTimer((prev) => ({
      ...createInitialTimerState(prev.originalDuration),
    }))
  }, [clearTick, updateTimer])

  const enterAway = useCallback(() => {
    updateTimer((prev) => {
      window.electronAPI?.trackEvent?.('AwayMode_Entered', { remaining_time: prev.remainingTime })
      return {
        ...prev,
        status: 'away' as TimerStatus,
        awayStartTime: Date.now(),
        lastUpdated: Date.now(),
      }
    })
    setAwayElapsed(0)
  }, [updateTimer])

  const exitAway = useCallback(() => {
    updateTimer((prev) => {
      if (prev.status !== 'away' || !prev.awayStartTime) return prev

      const awaySeconds = Math.floor((Date.now() - prev.awayStartTime) / 1000)
      window.electronAPI?.trackEvent?.('AwayMode_Exited', { duration_away: awaySeconds })

      return {
        ...prev,
        status: 'running' as TimerStatus,
        remainingTime: prev.remainingTime + awaySeconds,
        totalAwayTime: prev.totalAwayTime + awaySeconds,
        awayStartTime: null,
        lastUpdated: Date.now(),
      }
    })
    setAwayElapsed(0)
  }, [updateTimer])

  const loadState = useCallback(
    (state: TimerState) => {
      clearTick()
      setAwayElapsed(0)

      const now = Date.now()
      const elapsedSinceUpdate = Math.floor((now - state.lastUpdated) / 1000)

      let restored = { ...state, lastUpdated: now }

      if ((state.status === 'running' || state.status === 'away') && elapsedSinceUpdate > 0) {
        const newRemaining = Math.max(0, state.remainingTime - elapsedSinceUpdate)
        restored = {
          ...restored,
          remainingTime: newRemaining,
          status: (newRemaining <= 0 && state.status === 'running') ? 'completed' : state.status,
        }
      } 
      
      if (state.status === 'away' && state.awayStartTime) {
        const awaySeconds = Math.floor((now - state.awayStartTime) / 1000)
        setAwayElapsed(awaySeconds)
      }

      setTimer(restored)
    },
    [clearTick]
  )

  return {
    timer,
    awayElapsed,
    setDuration,
    start,
    pause,
    reset,
    enterAway,
    exitAway,
    loadState,
  }
}
