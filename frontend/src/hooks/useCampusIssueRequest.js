import { useEffect, useState } from 'react';

const loading = { busy: true, error: null, data: null };

export function useCampusIssueRequest(load) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ load, attempt, busy: false, error: null, data });
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ load, attempt, busy: false, error, data: null });
    });
    return () => controller.abort();
  }, [load, attempt]);
  return [
    result?.load === load && result.attempt === attempt ? result : loading,
    () => setAttempt((value) => value + 1)
  ];
}
