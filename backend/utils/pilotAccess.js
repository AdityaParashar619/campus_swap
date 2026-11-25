import { env } from '../config/env.js';
import { Forbidden } from './AppError.js';

export const assertPilotRegistrationAllowed = (email, configuration = env) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  if (configuration.facultyDemoMode && normalizedEmail === configuration.adminEmail) {
    throw new Forbidden('This email is reserved for administrator access.');
  }
  if (!configuration.pilotModeEnabled) return;
  if (!configuration.pilotAllowedEmails.includes(normalizedEmail)) {
    throw new Forbidden('Registration is currently limited to approved pilot participants.');
  }
};
