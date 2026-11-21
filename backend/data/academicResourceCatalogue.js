const checkedAt = '2026-11-20T00:00:00.000Z';
const types = ['syllabus', 'timetable', 'scheme', 'faculty', 'department_overview', 'academic_calendar'];

const definitions = {
  CSE: {
    syllabus: 'https://www.satiengg.in/syllabus-cse', timetable: 'https://www.satiengg.in/time-table-cse', scheme: 'https://www.satiengg.in/scheme-cse', faculty: 'https://www.satiengg.in/faculty-profiles-cse', department_overview: 'https://www.satiengg.in/departments/computer-science-engineering'
  },
  CSE_BC: {
    syllabus: 'https://www.satiengg.in/syllabus-cse', timetable: 'https://www.satiengg.in/time-table-cse', scheme: 'https://www.satiengg.in/scheme-cse', faculty: 'https://www.satiengg.in/faculty-profiles-cse', department_overview: 'https://www.satiengg.in/departments/computer-science-engineering'
  },
  CSE_AIML: { department_overview: 'https://www.satiengg.in/departments/artificial-intelligence' },
  CSE_AIADS: { syllabus: 'https://www.satiengg.in/syllabus-it', department_overview: 'https://www.satiengg.in/departments/artificial-intelligence' },
  IT: {
    syllabus: 'https://www.satiengg.in/syllabus-it', timetable: 'https://www.satiengg.in/time-table-it', scheme: 'https://www.satiengg.in/schemes-it', faculty: 'https://www.satiengg.in/faculty-profiles-it', department_overview: 'https://www.satiengg.in/departments/information-technology'
  },
  CSE_IOT: { syllabus: 'https://www.satiengg.in/syllabus-csiot', timetable: 'https://www.satiengg.in/time-table-csiot' },
  ECE: { syllabus: 'https://www.satiengg.in/syllabus-ete', timetable: 'https://www.satiengg.in/time-table-ete', faculty: 'https://www.satiengg.in/faculty-profiles-ete' },
  CE: { department_overview: 'https://www.satiengg.in/departments/civil-engineering' },
  ME: { syllabus: 'https://www.satiengg.in/syllabus-me', timetable: 'https://www.satiengg.in/time-table-me' },
  EE: { syllabus: 'https://www.satiengg.in/syllabus-ece', timetable: 'https://www.satiengg.in/time-table-ece', faculty: 'https://www.satiengg.in/faculty-profiles-ece', department_overview: 'https://www.satiengg.in/departments/electrical-engineering' }
};

const programMeta = {
  CSE: ['CSE', 'Computer Science and Engineering'], CSE_BC: ['CSE', 'Computer Science and Engineering (Blockchain)'],
  CSE_AIML: ['AI', 'CSE Artificial Intelligence and Machine Learning'], CSE_AIADS: ['AI', 'CSE Artificial Intelligence and Data Science'],
  IT: ['IT', 'Information Technology'], CSE_IOT: ['CSIOT', 'CSE Internet of Things'], ECE: ['ECE', 'Electronics and Communication Engineering'],
  CE: ['CE', 'Civil Engineering'], ME: ['ME', 'Mechanical Engineering'], EE: ['EE', 'Electrical Engineering']
};

const inaccessible = new Set([
  'CSE:faculty', 'CSE_BC:faculty', 'IT:timetable', 'IT:scheme', 'IT:faculty', 'CSE_IOT:timetable',
  'ECE:syllabus', 'CE:department_overview', 'EE:timetable'
]);

export const academicCoverageCatalogue = Object.freeze(Object.entries(programMeta).flatMap(([programCode, [departmentCode, programName]]) =>
  types.map((resourceType) => {
    const url = definitions[programCode]?.[resourceType] || null;
    const sourceStatus = !url ? 'missing' : inaccessible.has(`${programCode}:${resourceType}`) ? 'source_inaccessible' : 'verified_official_page';
    return Object.freeze({
      programCode, departmentCode, programName, resourceType, semesters: Object.freeze(['1','2','3','4','5','6','7','8']),
      url, sourceUrl: url, checkedAt, sourceStatus,
      classification: sourceStatus === 'verified_official_page' ? 'verified_official_browsing_page' : 'missing_or_requires_review',
      reason: !url ? 'not_found' : sourceStatus === 'source_inaccessible' ? 'source_inaccessible_during_check' : null,
      evidence: sourceStatus === 'verified_official_page'
        ? `Public SATI page identifies ${resourceType.replace('_', ' ')} material for ${programName}; linked documents still require administrator review for semester, session, and batch applicability.`
        : '',
      uncertainty: sourceStatus === 'verified_official_page' ? 'Index reachability does not prove that every linked document is current or applicable.' : 'No publishable fallback was confirmed during this audit.'
    });
  })
));

export const importableAcademicCatalogue = Object.freeze(academicCoverageCatalogue
  .filter((entry) => entry.sourceStatus === 'verified_official_page')
  .map((entry) => Object.freeze({
    title: `Official ${entry.programName} ${entry.resourceType.replace('_', ' ')} index`,
    description: 'Official SATI browsing page. Review linked documents before treating any item as an exact current resource.',
    resourceType: entry.resourceType,
    resourceKind: 'official_index',
    scope: 'program',
    departmentCode: entry.departmentCode,
    programCode: entry.programCode,
    semester: null,
    academicSession: null,
    admissionBatch: null,
    url: entry.url,
    sourceUrl: entry.sourceUrl,
    sourceType: 'official_external',
    applicabilityEvidence: entry.evidence,
    uncertainty: entry.uncertainty,
    checkedAt: entry.checkedAt
  })));

export const catalogueCheckedAt = checkedAt;

// Review candidates are deliberately excluded from importableAcademicCatalogue.
// They must be created through the admin workflow only after applicability review.
export const directAcademicDocumentCandidates = Object.freeze([
  Object.freeze({
    title: 'CSE Semester VII syllabus — session 2025-26',
    resourceType: 'syllabus', resourceKind: 'exact_document', scope: 'program',
    departmentCode: 'CSE', programCode: 'CSE', semester: '7', academicSession: '2025-26', admissionBatch: null,
    url: 'https://www.satiengg.in/images/cse/CSE/SYLLABUS/Syllabus%20for%20Session%202025-26/CSE/CSE%20VII%20Sem%20Syllabus%20as%20on%2018.06.2025.pdf',
    sourceUrl: 'https://www.satiengg.in/syllabus-cse', sourceType: 'official_external',
    checkedAt, verificationStatus: 'unverified', candidateStatus: 'applicability_unconfirmed',
    applicabilityEvidence: 'Official SATI PDF identifies CSE and Semester VII; its path identifies session 2025-26.',
    uncertainty: 'The student profile has no verified academic session or admission batch, so this cannot be personalized as an exact match.'
  }),
  Object.freeze({
    title: 'CSE Semester VII timetable — July 2025',
    resourceType: 'timetable', resourceKind: 'exact_document', scope: 'program',
    departmentCode: 'CSE', programCode: 'CSE', semester: '7', academicSession: '2025-26', admissionBatch: null,
    url: 'https://www.satiengg.in/images/cse/CSE/Time%20Table/July%2025/20.08.25/CSE%20-A%20and%20B%20VII%20SEM.pdf',
    sourceUrl: 'https://www.satiengg.in/time-table-cse', sourceType: 'official_external',
    checkedAt, verificationStatus: 'unverified', candidateStatus: 'source_inaccessible_during_check',
    applicabilityEvidence: 'The official timetable index lists a previous CSE Semester VII timetable for Jul–Nov 2025.',
    uncertainty: 'The direct PDF could not be independently fetched during this audit and is historical, not current.'
  })
]);
