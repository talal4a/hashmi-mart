import assert from 'node:assert/strict';
import * as schema from '../../src/validation/Schema';
import type { UserRole } from '../../src/validation/Schema';
import * as users from '../../src/services/users';
import * as gate from '../../src/services/profileGate';
import { account, documents, firestoreSdk } from '../support/firebase';

function setup() {
  return {
    schema, users, gate, documents,
    writes: firestoreSdk.setDoc.mock.calls,
    failRead: () => firestoreSdk.getDoc.mockRejectedValue(new Error('Offline')),
    failWrite: () => firestoreSdk.setDoc.mockRejectedValue(new Error('Permission denied')),
  };
}

const details = { name: 'Test User', phone: '+923001234567' };

test('profile validation requires an explicit supported role', () => {
  const { schema } = setup();
  for (const role of [undefined, null, '', 'admin', 'Customer']) {
    const result = schema.completeProfileSchema.safeParse({
      ...details,
      phone: '300 123 4567',
      role,
    });
    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].path[0], 'role');
  }
  for (const role of schema.USER_ROLES) {
    assert.equal(
      schema.completeProfileSchema.safeParse({
        ...details,
        phone: '300 123 4567',
        role,
      }).success,
      true,
    );
  }
});

for (const role of [undefined, null, '', 'admin']) {
  test(`legacy flag cannot bypass missing or invalid role: ${String(role)}`, async () => {
    const { users, gate, documents, writes } = setup();
    documents.set('users/test-user', {
      ...details,
      profileComplete: true,
      role,
    });
    const profile = await users.readUserDocument(account.uid);
    assert.ok(profile, 'the seeded document should read back');
    assert.equal(profile.role, null);
    assert.equal(profile.name, details.name);
    assert.equal(gate.isProfileComplete(profile), false);
    assert.equal(
      await gate.resolveAuthDestination(account.uid),
      'CompleteProfile',
    );
    assert.equal(writes.length, 0);
  });
}

for (const role of schema.USER_ROLES) {
  test(`${role} is saved with completion and survives re-login and a cold read`, async () => {
    const { users, gate, documents, writes } = setup();
    await users.ensureUserDocument(account, 'password');
    assert.equal(users.peekUserDocument(account.uid)!.profile!.role, null);
    assert.equal(
      await gate.resolveAuthDestination(account.uid),
      'CompleteProfile',
    );

    await users.saveProfileDetails(account.uid, { ...details, role });
    assert.equal(writes.at(-1)?.[1].role, role);
    assert.equal(writes.at(-1)?.[1].profileComplete, true);
    assert.equal(documents.size, 1);
    assert.equal(users.peekUserDocument(account.uid), null);

    await users.ensureUserDocument(account, 'google');
    assert.equal(users.peekUserDocument(account.uid)!.profile!.role, role);
    assert.equal(await gate.resolveAuthDestination(account.uid), 'Home');
    users.forgetUserDocument();
    assert.equal(await gate.resolveAuthDestination(account.uid), 'Home');
    assert.equal((await users.readUserDocument(account.uid))!.role, role);
  });
}

test('legacy accounts with all required details can backfill the flag', async () => {
  const { gate, documents, writes } = setup();
  documents.set('users/test-user', { ...details, role: 'customer' });
  assert.equal(await gate.resolveAuthDestination(account.uid), 'Home');
  assert.equal(writes.at(-1)?.[1].profileComplete, true);
});

test('a role and completion flag cannot replace required name or phone', () => {
  const { gate } = setup();
  for (const missing of [{ name: '' }, { phone: null }]) {
    assert.equal(
      gate.isProfileComplete({
        ...details,
        role: 'rider',
        profileComplete: true,
        ...missing,
      }),
      false,
    );
  }
});

test('storage rejects invalid roles without writing a completion flag', async () => {
  const { users, writes } = setup();
  for (const role of [undefined, null, '', 'admin']) {
    // The cast is the point: the service must reject these at runtime.
    await assert.rejects(
      users.saveProfileDetails(account.uid, { ...details, role: role as UserRole }),
    );
  }
  assert.equal(writes.length, 0);
});

test('a missing document or failed read keeps the user in Complete Profile', async () => {
  const { gate, users, failRead } = setup();
  assert.equal(
    await gate.resolveAuthDestination(account.uid),
    'CompleteProfile',
  );
  users.forgetUserDocument();
  failRead();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    assert.equal(
      await gate.resolveAuthDestination(account.uid),
      'CompleteProfile',
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'Could not read users/{uid}; routing to Complete Profile:',
      expect.objectContaining({ message: 'Offline' }),
    );
  } finally {
    warn.mockRestore();
  }
});

test('a failed save rejects and leaves the cached incomplete profile intact', async () => {
  const { users, gate, failWrite } = setup();
  await users.ensureUserDocument(account, 'password');
  failWrite();
  await assert.rejects(
    users.saveProfileDetails(account.uid, { ...details, role: 'vendor' }),
    /Permission denied/,
  );
  assert.equal(users.peekUserDocument(account.uid)!.profile!.role, null);
  assert.equal(
    await gate.resolveAuthDestination(account.uid),
    'CompleteProfile',
  );
});
