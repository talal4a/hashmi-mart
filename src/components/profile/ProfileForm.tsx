import React, { useCallback, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin, User as UserIcon } from 'lucide-react-native';
import {
  completeProfileSchema,
  NAME_MIN,
  type CompleteProfileFormData,
} from '../../validation/Schema';
import { saveProfileDetails, type UserDocument } from '../../services/users';
import type { UploadedPhoto } from '../../services/avatarUpload';
import { firestoreErrorMessage } from '../../utils/firestoreErrors';
import { fromE164, groupDigits, toE164 } from '../../utils/phone';
import useAfterAuth from '../../hooks/useAfterAuth';
import useAvatarPhoto from '../../hooks/useAvatarPhoto';
import AuthTextField from '../auth/AuthTextField';
import FormError from '../auth/FormError';
import FormNotice from '../auth/FormNotice';
import ThemedButton from '../ThemedButton';
import AvatarHero from './AvatarHero';
import AvatarEditSheet, { type AvatarEditAction } from './AvatarEditSheet';
import AvatarPicker from './AvatarPicker';
import PhoneField from './PhoneField';
import GenderSelect from './GenderSelect';
import RoleSelect from './RoleSelect';
import ProfileIdentity from './ProfileIdentity';
import { findAvatar } from './avatars/catalog';

type Props = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  /** Whatever is already stored, for prefilling. Null when nothing is. */
  profile: UserDocument | null;
  /** The stored document couldn't be read; say so rather than pretending. */
  offline: boolean;
};

/**
 * The Complete Profile form itself.
 *
 * Split from the screen because it may only mount once the stored profile has
 * arrived: `defaultValues` is read by react-hook-form on its first render and
 * never again, so a form mounted while the read is in flight would either come
 * up blank or need a `reset()` that fights whatever the user has already typed.
 * Mounting late makes prefilling a non-problem instead of a race.
 *
 * The avatar choice lives in component state, not in the form. It is not typed,
 * not validated and has no error to show — running it through zod would buy
 * nothing and cost the picker a resolver pass on every tap.
 *
 * An uploaded photo reaches Cloudinary the moment it is picked, but only reaches
 * Firestore when this form is submitted. That ordering is deliberate: the write
 * needs a URL to store, and a form the user abandons should leave an unreferenced
 * image in the account — a few KB nobody sees — rather than a document claiming a
 * picture they never confirmed. A successful upload also clears the chosen
 * character, because otherwise the preset would keep winning the display order
 * and the photo the user just waited for would not appear.
 *
 * "Remove photo" drops the reference, not the asset. Deleting from Cloudinary
 * needs the API secret, which may never ship in the app (see config/cloudinary),
 * so the image outlives the choice and `tags` carries the UID so a server-side
 * cleanup can still find it. What the user asked for is that it stop being their
 * picture, and clearing the URL — here and, on submit, in Firestore — is that.
 *
 * Phone is stored as E.164 while the field holds a grouped local number, so the
 * conversion happens once on the way in (`fromE164`) and once on the way out
 * (`toE164`) — see utils/phone for why the leading zero is dropped.
 *
 * The name field is normally not rendered at all: sign-up asks for it and Google
 * supplies it, so the value is already known and is shown back as text instead.
 * It still travels through the form and the write, because the gate refuses to
 * call a nameless profile complete — which is also why the field reappears, as a
 * field, for the rare account that arrived here without one (an old sign-up, or
 * one whose `updateProfile` and document seed both failed offline).
 */
export default function ProfileForm({
  uid,
  displayName,
  email,
  photoURL,
  profile,
  offline,
}: Props) {
  const { goTo } = useAfterAuth();
  const phoneRef = useRef<TextInput | null>(null);
  const addressRef = useRef<TextInput | null>(null);

  const [avatarId, setAvatarId] = useState<string | null>(
    profile?.avatarId ?? null,
  );
  const [photo, setPhoto] = useState<UploadedPhoto | null>(() =>
    profile?.avatarUrl
      ? { url: profile.avatarUrl, publicId: profile.avatarPublicId ?? '' }
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const onUploaded = useCallback((uploaded: UploadedPhoto) => {
    setPhoto(uploaded);
    setAvatarId(null);
  }, []);

  const upload = useAvatarPhoto(uid, onUploaded);

  // Only the user's own upload is removable. A Google picture is not a choice
  // they made here, it is what shows when they have made none.
  const hasPhoto = photo !== null;

  /**
   * The pencil. Opens the sheet unless the sheet would be empty.
   *
   * With no picker in the build and no photo stored, all three rows are dead —
   * so the reason goes under the picture, where the upload errors already
   * appear, instead of into a panel the user has to dismiss to read it.
   */
  const openEdit = useCallback(() => {
    if (!upload.available && !hasPhoto) {
      upload.showUnavailable();
      return;
    }
    upload.clearError();
    setEditing(true);
  }, [upload.available, upload.showUnavailable, upload.clearError, hasPhoto]);

  const applyEdit = useCallback(
    (action: AvatarEditAction) => {
      if (action === 'remove') {
        setPhoto(null);
        upload.clearError();
        return;
      }
      upload.pick(action);
    },
    [upload.pick, upload.clearError],
  );

  // Picking a character is a perfectly good answer to a failed upload, so the
  // message goes with the tap rather than sitting under a picture it no longer
  // describes.
  const chooseAvatar = useCallback(
    (id: string | null) => {
      setAvatarId(id);
      upload.clearError();
    },
    [upload.clearError],
  );

  // Google hands over a display name; email sign-up now collects one too.
  const knownName = (profile?.name || displayName || '').trim();
  const askName = knownName.length < NAME_MIN;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CompleteProfileFormData>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      role: profile?.role ?? undefined,
      name: knownName,
      phone: groupDigits(fromE164(profile?.phone ?? null)),
      gender: profile?.gender ?? undefined,
      address: profile?.address ?? '',
    },
  });

  const name = watch('name');
  const preset = findAvatar(avatarId);

  const submit = handleSubmit(async data => {
    if (submitting) return;

    // The schema already guarantees enough digits, so this can only be null if
    // the two ever disagree — better a message than a `+92` written to the doc.
    const phone = toE164(data.phone);
    if (!phone) {
      setFailure('Enter a valid mobile number.');
      return;
    }

    setSubmitting(true);
    setFailure(null);
    try {
      await saveProfileDetails(uid, {
        role: data.role,
        name: data.name.trim(),
        phone,
        gender: data.gender,
        // The schema requires a non-empty address, so it always has a value.
        address: data.address.trim(),
        avatarId,
        // Both or neither: a URL with no id cannot be cleaned up later, and an
        // id with no URL is a record of an asset nothing displays.
        avatarUrl: photo?.url ?? null,
        avatarPublicId: photo?.publicId ?? null,
        // Only used if this write is what creates the document — the sign-in
        // seed is allowed to fail, and a nameless, emailless doc is worse.
        email,
        photoURL,
      });
      goTo('Home');
    } catch (error) {
      console.warn('Could not save profile:', error);
      setFailure(firestoreErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <View>
      {offline ? (
        <View className="mb-4">
          <FormNotice message="We couldn't load your saved details just now. Fill these in and we'll store them again." />
        </View>
      ) : null}

      {failure ? (
        <View className="mb-4">
          <FormError message={failure} />
        </View>
      ) : null}

      <AvatarHero
        preset={preset}
        avatarUrl={photo?.url ?? null}
        photoURL={photoURL}
        name={name}
        email={email}
        busy={upload.busy}
        error={upload.error}
        onEdit={openEdit}
      />

      <View className="mt-5">
        <AvatarPicker
          value={avatarId}
          onChange={chooseAvatar}
          avatarUrl={photo?.url ?? null}
          photoURL={photoURL}
          name={name}
          email={email}
          canUpload={upload.available}
        />
      </View>

      {askName ? (
        <View className="mt-6">
          <AuthTextField
            control={control}
            name="name"
            label="Full name"
            placeholder="Your full name"
            error={errors.name?.message}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => phoneRef.current?.focus()}
            icon={color => <UserIcon size={20} color={color} />}
          />
        </View>
      ) : (
        <View className="mt-5">
          <ProfileIdentity name={knownName} email={email} />
        </View>
      )}

      <View className="mt-4">
        <RoleSelect control={control} disabled={submitting} />
      </View>

      <View className="mt-4">
        <PhoneField
          control={control}
          name="phone"
          error={errors.phone?.message}
          inputRef={phoneRef}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => addressRef.current?.focus()}
        />
      </View>

      <View className="mt-4">
        <GenderSelect control={control} name="gender" />
      </View>

      <View className="mt-4">
        <AuthTextField
          control={control}
          name="address"
          label="Delivery address"
          placeholder="House, street, area"
          error={errors.address?.message}
          inputRef={addressRef}
          maxLength={140}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={submit}
          icon={color => <MapPin size={20} color={color} />}
        />
      </View>

      <ThemedButton
        label={submitting ? 'Saving…' : 'Save and continue'}
        variant="primary"
        disabled={submitting}
        onPress={submit}
        style={{ marginTop: 24 }}
      />

      <Text className="mt-3 text-center text-[12px] leading-5 text-[#9ca3af]">
        Choose your role, and add your number and delivery address to get
        started.
      </Text>

      {/* Last in the tree and it makes no difference where it sits: a Modal opens
          its own window above the screen. Kept out of the hero so the sheet's
          state belongs to the form that owns the photo, not to the picture. */}
      <AvatarEditSheet
        visible={editing}
        onClose={() => setEditing(false)}
        onSelect={applyEdit}
        canUpload={upload.available}
        canRemove={hasPhoto}
      />
    </View>
  );
}
