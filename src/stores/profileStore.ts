import { create } from 'zustand';
import type { UserDocument } from '../services/users';
import { isProfileComplete as checkProfileComplete } from '../services/profileGate';

export type ProfileStoreState = {
  profile: UserDocument | null;
  isProfileComplete: boolean;
  setProfile: (profile: UserDocument | null) => void;
  setProfileComplete: (isComplete: boolean) => void;
  updateProfile: (details: Partial<UserDocument>) => void;
  clearProfile: () => void;
};

/**
 * Zustand store holding the local authenticated user profile.
 *
 * This store is updated strictly AFTER successful backend persistence
 * (e.g. Firestore `saveProfileDetails`), preventing optimistic or false
 * completion state.
 */
export const useProfileStore = create<ProfileStoreState>(set => ({
  profile: null,
  isProfileComplete: false,
  setProfile: profile =>
    set({
      profile,
      isProfileComplete: profile ? checkProfileComplete(profile) : false,
    }),
  setProfileComplete: isComplete => set({ isProfileComplete: isComplete }),
  updateProfile: details =>
    set(state => {
      if (!state.profile) return state;
      const updated = { ...state.profile, ...details };
      return {
        profile: updated,
        isProfileComplete: checkProfileComplete(updated),
      };
    }),
  clearProfile: () => set({ profile: null, isProfileComplete: false }),
}));
