import { useEffect, useState } from 'react';
import Layout from '../layouts/Layout';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { adminAPI } from '../services/api';
import { buildAcademicResourcePayload } from '../utils/academicResources';

const empty = {
  title: '', description: '', resourceType: 'syllabus', resourceKind: 'exact_document',
  applicabilityMode: 'exact_applicable', publicationStatus: 'draft', scope: 'program', programCode: '', departmentCode: '',
  semester: '', academicSession: '', admissionBatch: '', url: '', sourceUrl: '',
  sourceType: 'official_external', applicabilityEvidence: '', uncertainty: '', checkedAt: ''
};
const primaryFields = [
  ['title', 'Title'], ['description', 'Description'], ['url', 'Official HTTPS URL'],
  ['sourceUrl', 'Source page HTTPS URL']
];
const advancedFields = [
  ['academicSession', 'Academic session (YYYY-YY)'], ['admissionBatch', 'Admission batch (YYYY)'],
  ['applicabilityEvidence', 'Applicability evidence'],
  ['uncertainty', 'Uncertainty / review notes'], ['checkedAt', 'Source checked at']
];

export default function AdminAcademicResources() {
  const [items, setItems] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.academicResources();
      setItems(response.data.data || []);
      setPrograms(response.data.programs || []);
    } catch (error) {
      setMessage(error.userMessage || 'Unable to load academic resources.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const chooseProgram = (programCode) => {
    const program = programs.find((item) => item.programCode === programCode);
    setForm((current) => ({ ...current, programCode, departmentCode: program?.departmentCode || current.departmentCode }));
  };
  const chooseResourceKind = (resourceKind) => setForm((current) => ({
    ...current, resourceKind,
    ...(resourceKind === 'official_index'
      ? { applicabilityMode: 'exact_applicable', semester: '' }
      : {})
  }));
  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      const publicationStatus = event.nativeEvent.submitter?.value === 'published' ? 'published' : 'draft';
      const payload = buildAcademicResourcePayload(form, publicationStatus);
      if (editing) await adminAPI.updateAcademicResource(editing, payload);
      else await adminAPI.createAcademicResource(payload);
      setForm(empty);
      setEditing('');
      setMessage(publicationStatus === 'published' ? 'Academic resource saved and published.' : 'Academic resource saved as a draft.');
      await load();
    } catch (error) {
      setMessage(error.userMessage || 'Resource could not be saved.');
    }
  };
  const edit = (item) => {
    setEditing(item._id);
    setForm(Object.fromEntries(Object.keys(empty).map((key) => [key, item[key] ?? empty[key]])));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const status = async (item, patch) => {
    if (!window.confirm('Apply this consequential status change?')) return;
    try { await adminAPI.setAcademicResourceStatus(item._id, patch); await load(); }
    catch (error) { setMessage(error.userMessage || 'Status could not be changed.'); }
  };

  return <PageTransition><Layout><div className="min-h-screen py-8"><div className="section-container max-w-7xl space-y-6">
    <header><p className="chip">Admin controls</p><h1 className="text-section-title mt-3">Academic Resources</h1><p className="text-body-sm mt-2">Create drafts, review authenticity and applicability, verify explicitly, and retire outdated links without deleting history.</p></header>
    {message && <p role="status" className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">{message}</p>}
    <PremiumCard hover={false}>
      <h2 className="text-feature-title">{editing ? 'Edit resource' : 'Add resource'}</h2>
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
        {primaryFields.map(([key, label]) => <Field key={key} fieldKey={key} label={label} form={form} set={set} />)}
        <Select label="Type" id="resource-type" value={form.resourceType} onChange={(value) => set('resourceType', value)} options={['syllabus', 'timetable', 'scheme', 'faculty', 'academic_calendar', 'department_overview', 'other']} />
        <Select label="Resource kind" id="resource-kind" value={form.resourceKind} onChange={chooseResourceKind} options={[['exact_document', 'Exact document'], ['official_index', 'Official browsing index']]} />
        <Select label="Scope" id="resource-scope" value={form.scope} onChange={(value) => set('scope', value)} options={['program', 'department', 'college']} />
        <div><label htmlFor="resource-program" className="text-sm font-semibold">Program</label><select id="resource-program" className="form-control mt-1" value={form.programCode} onChange={(event) => chooseProgram(event.target.value)}><option value="">Not program-specific</option>{programs.map((program) => <option key={program.programCode} value={program.programCode}>{program.displayName}</option>)}</select></div>
        {form.scope !== 'college' && <div><label htmlFor="resource-department" className="text-sm font-semibold">Department</label><input id="resource-department" className="form-control mt-1" value={form.departmentCode} onChange={(event) => set('departmentCode', event.target.value.toUpperCase())} /></div>}
        <Select label="Semester" id="resource-semester" value={form.semester} onChange={(value) => set('semester', value)} disabled={form.resourceKind === 'official_index'} blankLabel="All semesters" options={['1','2','3','4','5','6','7','8']} />
        <Select label="Source type" id="resource-source-type" value={form.sourceType} onChange={(value) => set('sourceType', value)} options={[['official_external', 'Official external'], ['admin_verified', 'Admin verified']]} />
        <details className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 md:col-span-2"><summary className="cursor-pointer font-bold">Advanced details</summary><p className="mt-2 text-sm text-slate-500">Optional session, batch, presentation, and provenance metadata. Existing values are preserved when this section stays closed.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><Select label="Student presentation" id="resource-applicability-mode" value={form.applicabilityMode} onChange={(value) => set('applicabilityMode', value)} disabled={form.resourceKind === 'official_index'} options={[['exact_applicable', 'Exact applicable document'], ['reference_only', 'Reference only — applicability unconfirmed']]} />{advancedFields.map(([key, label]) => <Field key={key} fieldKey={key} label={label} form={form} set={set} />)}</div></details>
        <div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit" name="publicationIntent" value="published">Save &amp; Publish</Button><Button type="submit" name="publicationIntent" value="draft" variant="secondary">Save Draft</Button>{editing && <Button type="button" variant="secondary" onClick={() => { setEditing(''); setForm(empty); }}>Cancel</Button>}</div>
      </form>
    </PremiumCard>
    <PremiumCard hover={false}><h2 className="text-feature-title">Managed resources</h2>{loading ? <div className="skeleton mt-4 h-32" /> : items.length === 0 ? <p className="mt-4 text-sm text-slate-500">No academic resources have been added.</p> : <div className="mt-4 space-y-3">{items.map((item) => <ResourceCard key={item._id} item={item} edit={edit} status={status} />)}</div>}</PremiumCard>
  </div></div></Layout></PageTransition>;
}

function Field({ fieldKey, label, form, set }) {
  return <div><label htmlFor={`resource-${fieldKey}`} className="text-sm font-semibold">{label}</label><input id={`resource-${fieldKey}`} type={fieldKey === 'checkedAt' ? 'date' : 'text'} className="form-control mt-1" value={form[fieldKey] ? String(form[fieldKey]).slice(0, fieldKey === 'checkedAt' ? 10 : undefined) : ''} onChange={(event) => set(fieldKey, event.target.value)} required={['title', 'url'].includes(fieldKey)} /></div>;
}

function Select({ label, id, value, onChange, options, disabled = false, blankLabel }) {
  return <div><label htmlFor={id} className="text-sm font-semibold">{label}</label><select id={id} className="form-control mt-1" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{blankLabel !== undefined && <option value="">{blankLabel}</option>}{options.map((option) => { const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option]; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}</select></div>;
}

function ResourceCard({ item, edit, status }) {
  const presentation = item.resourceKind === 'official_index' ? 'Browsing fallback' : item.applicabilityMode === 'reference_only' ? 'Reference only' : item.semester ? `Semester ${item.semester}` : 'All semesters';
  return <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><h3 className="break-words font-bold">{item.title}</h3><p className="text-xs text-slate-500">{item.programCode || item.departmentCode || 'College'} · {item.resourceType} · {presentation} · {item.publicationStatus || 'draft'} · {item.verificationStatus} · {item.isActive ? 'Active' : 'Retired'}</p>{item.applicabilityEvidence && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Evidence: {item.applicabilityEvidence}</p>}{item.uncertainty && <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Review note: {item.uncertainty}</p>}<a href={item.sourceUrl || item.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-blue-700 underline dark:text-blue-300">Inspect official source</a></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => edit(item)}>Edit</Button>{item.publicationStatus !== 'published' && <Button size="sm" onClick={() => status(item, { publicationStatus: 'published' })}>Publish</Button>}{item.verificationStatus !== 'verified' && <Button size="sm" variant="secondary" onClick={() => status(item, { verificationStatus: 'verified' })}>Verify provenance</Button>}<Button size="sm" variant={item.isActive ? 'danger' : 'secondary'} onClick={() => status(item, { isActive: !item.isActive })}>{item.isActive ? 'Retire' : 'Reactivate'}</Button></div></div></article>;
}
