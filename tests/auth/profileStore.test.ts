import { useProfileStore } from '../../src/stores/profileStore';
import type { UserDocument } from '../../src/services/users';

const incompleteUser: UserDocument = {
  name: 'John Doe',
  email: 'john@example.com',
  role: null,
  phone: null,
  address: null,
  gender: null,
  photoURL: null,
  avatarUrl: null,
  avatarPublicId: null,
  avatarId: null,
  provider: 'password',
  profileComplete: false,
};

const completeUser: UserDocument = {
  name: 'John Doe',
  email: 'john@example.com',
  role: 'customer',
  phone: '+923001234567',
  address: '123 Market Street',
  gender: 'male',
  photoURL: null,
  avatarUrl: null,
  avatarPublicId: null,
  avatarId: 'preset-1',
  provider: 'password',
  profileComplete: true,
};

describe('useProfileStore', () => {
  beforeEach(() => {
    useProfileStore.getState().clearProfile();
  });

  it('initializes with null profile and false isProfileComplete', () => {
    const state = useProfileStore.getState();
    expect(state.profile).toBeNull();
    expect(state.isProfileComplete).toBe(false);
  });

  it('marks isProfileComplete as false for incomplete profile', () => {
    useProfileStore.getState().setProfile(incompleteUser);
    const state = useProfileStore.getState();
    expect(state.profile).toEqual(incompleteUser);
    expect(state.isProfileComplete).toBe(false);
  });

  it('marks isProfileComplete as true for complete profile', () => {
    useProfileStore.getState().setProfile(completeUser);
    const state = useProfileStore.getState();
    expect(state.profile).toEqual(completeUser);
    expect(state.isProfileComplete).toBe(true);
  });

  it('updates profile and recalculates completion', () => {
    useProfileStore.getState().setProfile(incompleteUser);
    expect(useProfileStore.getState().isProfileComplete).toBe(false);

    useProfileStore.getState().updateProfile({
      role: 'customer',
      phone: '+923001234567',
    });

    const updated = useProfileStore.getState();
    expect(updated.profile?.role).toBe('customer');
    expect(updated.profile?.phone).toBe('+923001234567');
    expect(updated.isProfileComplete).toBe(true);
  });

  it('clears profile back to initial state', () => {
    useProfileStore.getState().setProfile(completeUser);
    expect(useProfileStore.getState().isProfileComplete).toBe(true);

    useProfileStore.getState().clearProfile();
    expect(useProfileStore.getState().profile).toBeNull();
    expect(useProfileStore.getState().isProfileComplete).toBe(false);
  });
});
