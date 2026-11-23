import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import { ISSUE_PHOTO_TYPES } from '../utils/campusIssues';

export function useIssuePhotoUrl(blob) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPreview({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return blob && preview?.blob === blob ? preview.url : null;
}

export function CampusIssueEvidence({ issue, loadPhoto }) {
  if (!issue.evidence?.length) return null;
  return <section aria-label="Evidence" className="space-y-3">
    <h3 className="text-feature-title">Evidence</h3>
    <ul className="grid min-w-0 gap-3 sm:grid-cols-3">
      {issue.evidence.map(({ id }, index) => <EvidencePhoto key={id} issueId={issue.id} id={id} number={index + 1} loadPhoto={loadPhoto} />)}
    </ul>
  </section>;
}

function EvidencePhoto({ issueId, id, number, loadPhoto }) {
  const [photo, setPhoto] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dialog = useRef(null);
  const url = useIssuePhotoUrl(photo);

  useEffect(() => {
    const abort = new AbortController();
    loadPhoto(issueId, id, abort.signal).then(({ data }) => {
      if (abort.signal.aborted) return;
      if (!(data instanceof Blob) || !ISSUE_PHOTO_TYPES.includes(data.type)) throw new Error('Invalid evidence photo');
      setPhoto(data);
    }).catch(() => {
      if (!abort.signal.aborted) setFailed(true);
    });
    return () => abort.abort();
  }, [issueId, id, loadPhoto, attempt]);

  return <li className="min-w-0 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
    {failed ? <div className="space-y-2">
      <p role="status">Photo {number} could not be loaded.</p>
      <Button type="button" variant="secondary" onClick={() => {
        setFailed(false);
        setPhoto(null);
        setAttempt((value) => value + 1);
      }}>Retry photo {number}</Button>
    </div> : url ? <>
      <button type="button" aria-label={`View evidence photo ${number}`}
        className="block w-full rounded-md" onClick={() => dialog.current.showModal()}>
        <img src={url} alt={`Evidence photo ${number}`} onError={() => setFailed(true)}
          className="mx-auto max-h-44 max-w-full object-contain" />
      </button>
      <dialog ref={dialog} aria-label={`Evidence photo ${number}`}
        className="w-[calc(100%-2rem)] max-w-4xl rounded-xl p-3 text-slate-900 backdrop:bg-black/75 dark:bg-slate-900 dark:text-white">
        <form method="dialog" className="mb-2 flex justify-end"><Button type="submit" variant="secondary">Close photo</Button></form>
        <img src={url} alt={`Full evidence photo ${number}`} className="mx-auto max-h-[75vh] max-w-full object-contain" />
      </dialog>
    </> : <p role="status">Loading photo {number}…</p>}
  </li>;
}
