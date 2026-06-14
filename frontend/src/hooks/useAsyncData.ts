import { type DependencyList, useCallback, useEffect, useState } from 'react'

export interface AsyncData<T> {
  data: T
  loading: boolean
  error: string | null
  reload: () => void
}

// Loads async data on mount and whenever `deps` change, with an explicit error
// channel (the previous bespoke hooks swallowed load failures). Call reload() to
// refetch. `fetcher` is invoked inside the effect, so anything it closes over
// (e.g. an account id) must be passed in `deps`.
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  initial: T,
  deps: DependencyList = [],
): AsyncData<T> {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetcher()
      .then((d) => { if (!cancelled) { setData(d); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  return { data, loading, error, reload }
}
