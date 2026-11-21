import { env } from '../config/env.js';

const PROGRAMS = [
  { registrationCode: 'cs', programCode: 'CSE', displayName: 'Computer Science and Engineering', departmentCode: 'CSE', officialDepartmentUrl: 'https://www.satiengg.in/departments/computer-science-engineering' },
  { registrationCode: 'bc', programCode: 'CSE_BC', displayName: 'Computer Science and Engineering (Blockchain)', departmentCode: 'CSE', officialDepartmentUrl: 'https://www.satiengg.in/departments/computer-science-engineering' },
  { registrationCode: 'ai', programCode: 'CSE_AIML', displayName: 'Computer Science and Engineering (Artificial Intelligence and Machine Learning)', departmentCode: 'AI', officialDepartmentUrl: 'https://www.satiengg.in/departments/artificial-intelligence' },
  { registrationCode: 'ds', programCode: 'CSE_AIADS', displayName: 'Computer Science and Engineering (Artificial Intelligence and Data Science)', departmentCode: 'AI', officialDepartmentUrl: 'https://www.satiengg.in/departments/artificial-intelligence' },
  { registrationCode: 'it', programCode: 'IT', displayName: 'Information Technology', departmentCode: 'IT', officialDepartmentUrl: 'https://www.satiengg.in/departments/information-technology' },
  { registrationCode: 'iot', programCode: 'CSE_IOT', displayName: 'Computer Science and Engineering (Internet of Things)', departmentCode: 'CSIOT', officialDepartmentUrl: null },
  { registrationCode: 'ec', programCode: 'ECE', displayName: 'Electronics and Communication Engineering', departmentCode: 'ECE', officialDepartmentUrl: null },
  { registrationCode: 'ce', programCode: 'CE', displayName: 'Civil Engineering', departmentCode: 'CE', officialDepartmentUrl: 'https://www.satiengg.in/departments/civil-engineering' },
  { registrationCode: 'me', programCode: 'ME', displayName: 'Mechanical Engineering', departmentCode: 'ME', officialDepartmentUrl: null },
  { registrationCode: 'ee', programCode: 'EE', displayName: 'Electrical Engineering', departmentCode: 'EE', officialDepartmentUrl: 'https://www.satiengg.in/departments/electrical-engineering' }
].map((program) => Object.freeze({ ...program, aliases: Object.freeze([program.registrationCode]), active: true, supported: true }));

const byAlias = new Map(PROGRAMS.flatMap((program) => program.aliases.map((alias) => [alias.toLowerCase(), program])));
const byProgramCode = new Map(PROGRAMS.map((program) => [program.programCode, program]));

export const academicPrograms = Object.freeze(PROGRAMS);

export const resolveAcademicProgram = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized ? byAlias.get(normalized) || null : null;
};

export const getAcademicProgram = (programCode) => byProgramCode.get(String(programCode || '').trim().toUpperCase()) || null;

export const assertAcademicRegistryCoverage = (registrationCodes = env.institutionBranches) => {
  const configured = new Set(registrationCodes.map((code) => String(code).trim().toLowerCase()));
  const missing = [...configured].filter((code) => !resolveAcademicProgram(code));
  const unexpected = academicPrograms.map(({ registrationCode }) => registrationCode).filter((code) => !configured.has(code));
  if (missing.length || unexpected.length) {
    throw new Error(`Academic registry does not match registration configuration (missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'})`);
  }
  return true;
};

assertAcademicRegistryCoverage();
