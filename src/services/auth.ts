import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import app, { EMULATOR_HOST, EMULATOR_PORTS, useEmulators } from './firebase';

/** Point an Auth instance at the local emulator when running locally (safe to call repeatedly). */
export const connectAuthIfEmulated = (instance: Auth) => {
  if (useEmulators && !instance.emulatorConfig) {
    connectAuthEmulator(instance, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
  }
};

export const auth = getAuth(app);
connectAuthIfEmulated(auth);
