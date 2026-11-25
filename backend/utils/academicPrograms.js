import { env } from '../config/env.js';

import { academicPrograms } from '../config/academicProgramData.js';

export { academicPrograms };

const byAlias = new Map(academicPrograms.flatMap((program) => program.aliases.map((alias) => [alias.toLowerCase(), program])));
const byProgramCode = new Map(academicPrograms.map((program) => [program.programCode, program]));

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
