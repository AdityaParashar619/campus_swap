import { env } from '../config/env.js';
import { Forbidden } from './AppError.js';

export const assertPilotRegistrationAllowed = (email, configuration = env) => {
  if (!configuration.pilotModeEnabled) return;
  if (!configuration.pilotAllowedEmails.includes(String(email).trim().toLowerCase())) {
    throw new Forbidden('Registration is currently limited to approved pilot participants.');
  }
};
