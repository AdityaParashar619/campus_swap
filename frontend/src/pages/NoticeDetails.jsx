import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { noticeAPI } from '../services/api';
import { normalizeNotice, noticeScopeLabel } from '../utils/notices';

const ExternalLink = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex min-h-11 items-center rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-blue-700 dark:text-blue-200">{children}</a>;

export default function NoticeDetails() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, error: '', notice: null });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, error: '', notice: null });
    noticeAPI.getById(id, { signal: controller.signal }).then((response) => {
      const notice = normalizeNotice(response.data?.data);
      setState(notice ? { loading: false, error: '', notice } : { loading: false, error: 'This notice is unavailable.', notice: null });
    }).catch((error) => { if (!controller.signal.aborted) setState({ loading: false, error: error.response?.status === 404 ? 'This notice is unavailable or no longer active.' : error.userMessage || 'The notice could not be loaded.', notice: null }); });
    return () => controller.abort();
  }, [id]);
  return <PageTransition><Layout><main className="min-h-screen py-8 sm:py-10"><div className="section-container max-w-4xl"><Link to="/notices" className="text-sm font-bold text-blue-700 underline dark:text-blue-300">← Back to Notice Board</Link>
    {state.loading ? <div role="status" className="skeleton mt-6 h-80"><span className="sr-only">Loading notice</span></div> : state.error || !state.notice ? <PremiumCard hover={false} className="mt-6"><div role="alert" className="py-8 text-center"><h1 className="text-feature-title">Notice unavailable</h1><p className="text-body-sm mt-2">{state.error}</p></div></PremiumCard> : <NoticeContent notice={state.notice} />}
  </div></main></Layout></PageTransition>;
}

function NoticeContent({ notice }) {
  const published = notice.publishedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(notice.publishedAt)) : 'Date unavailable';
  return <PremiumCard hover={false} className="mt-6"><article><h1 className="break-words text-3xl font-black text-slate-950 dark:text-white">{notice.title}</h1><div className="mt-4 flex flex-wrap items-center gap-2"><span className="chip capitalize">{notice.category}</span><span className="chip capitalize">{notice.priority}</span><span className="chip">{noticeScopeLabel(notice.targetScope)}</span><span className="text-sm text-slate-500">Published on CampusSwap · <time dateTime={notice.publishedAt || ''}>{published}</time></span></div><p className="mt-6 whitespace-pre-wrap break-words text-base leading-7 text-slate-700 dark:text-slate-200">{notice.content}</p>{notice.attachments.length > 0 && <AttachmentList attachments={notice.attachments} />}{(notice.attachmentUrl || notice.sourceUrl) && <section className="mt-8" aria-labelledby="notice-external-links"><h2 id="notice-external-links" className="text-feature-title">Related links</h2><div className="mt-3 flex flex-wrap gap-3">{notice.attachmentUrl && <ExternalLink href={notice.attachmentUrl}>{notice.attachmentLabel || 'Open legacy attachment'}</ExternalLink>}{notice.sourceUrl && <ExternalLink href={notice.sourceUrl}>{notice.sourceLabel || 'View source'}</ExternalLink>}</div></section>}</article></PremiumCard>;
}

function AttachmentList({ attachments }) {
  const images = attachments.filter((item) => item.kind === 'image');
  const pdfs = attachments.filter((item) => item.kind === 'pdf');
  const documents = attachments.filter((item) => item.kind === 'docx');
  return <div className="mt-8 space-y-8">{images.length > 0 && <section aria-labelledby="notice-posters"><h2 id="notice-posters" className="text-feature-title">Attached Posters / Images</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{images.map((item) => <Poster key={item.id} item={item} />)}</div></section>}{pdfs.length > 0 && <section aria-labelledby="notice-pdfs"><h2 id="notice-pdfs" className="text-feature-title">Attached PDF Documents</h2><div className="mt-4 space-y-4">{pdfs.map((item) => <PdfDocument key={item.id} item={item} />)}</div></section>}{documents.length > 0 && <section aria-labelledby="notice-documents"><h2 id="notice-documents" className="text-feature-title">Other Documents</h2><div className="mt-4 space-y-4">{documents.map((item) => <DocumentDownload key={item.id} item={item} />)}</div></section>}</div>;
}

function Poster({ item }) {
  const [failed, setFailed] = useState(false);
  return <figure className="overflow-hidden rounded-xl border border-slate-200 p-3 dark:border-slate-700">{failed ? <AttachmentFallback name={item.displayName} message="This poster could not be displayed. You can still try opening the full image." /> : <a href={item.secureUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="block"><img src={item.secureUrl} alt={`Notice poster: ${item.displayName}`} loading="lazy" onError={() => setFailed(true)} className="h-auto max-h-[70vh] w-full rounded-lg object-contain" /></a>}<figcaption className="mt-3"><p className="break-words font-bold">{item.displayName}</p><p className="text-xs text-slate-500">Image · {formatBytes(item.size)}</p><div className="mt-3"><ExternalLink href={item.secureUrl}>Open full-resolution image</ExternalLink></div></figcaption></figure>;
}

function PdfDocument({ item }) {
  const [preview, setPreview] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="break-words font-bold">{item.displayName}</p><p className="text-xs text-slate-500">PDF · {formatBytes(item.size)}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold dark:border-slate-700" onClick={() => { setPreview((value) => !value); setFailed(false); }}>{preview ? 'Hide PDF preview' : 'Preview PDF'}</button><ExternalLink href={item.secureUrl}>Open PDF</ExternalLink><DownloadLink item={item} /></div>{preview && <div className="mt-4">{failed ? <AttachmentFallback name={item.displayName} message="The browser or file provider blocked the inline preview. Use Open PDF or Download instead." /> : <><iframe src={item.secureUrl} title={`PDF preview: ${item.displayName}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-[60vh] min-h-80 w-full rounded-lg border border-slate-200 dark:border-slate-700" /><p className="mt-2 text-xs text-slate-500">Preview availability depends on browser and file-provider support. If it stays blank, use Open PDF or Download.</p></>}</div>}</div>;
}

function DocumentDownload({ item }) { return <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="break-words font-bold">{item.displayName}</p><p className="text-xs text-slate-500">DOCX document · {formatBytes(item.size)}</p><div className="mt-3"><DownloadLink item={item} /></div></div>; }
function DownloadLink({ item }) { return <a href={item.secureUrl} download className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold dark:border-slate-700" rel="noopener noreferrer" referrerPolicy="no-referrer">Download</a>; }
function AttachmentFallback({ name, message }) { return <div role="status" className="rounded-lg bg-slate-100 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"><p className="font-bold">Preview unavailable: {name}</p><p className="mt-1">{message}</p></div>; }
const formatBytes = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
