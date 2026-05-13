"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import PageHeader from "@/components/admin/page/PageHeader";
import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import { formatISTDateTime } from "@/lib/formatters";
import { resolveAdminProfileImage } from "@/lib/admin-profile-image";
import { toast } from "sonner";
import {
  Activity,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  RefreshCcw,
  User,
} from "@/components/icons";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";

type AdminRole = "ADMIN" | "MANAGER";
type AccountStatus = "ACTIVE" | "LOCKED";

type AdminProfileData = {
  fullName: string;
  email: string;
  phone: string;
  passwordMask: string;
  role: AdminRole;
  status: AccountStatus;
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
};

type ProfileForm = {
  fullName: string;
  email: string;
  phone: string;
  role: AdminRole;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

type FormErrors<T extends string> = Partial<Record<T, string>>;

const PASSWORD_MASK = "********";

const EMPTY_FORM: ProfileForm = {
  fullName: "",
  email: "",
  phone: "",
  role: "ADMIN",
};

const EMPTY_PASSWORD_FORM: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function toProfileForm(profile: AdminProfileData): ProfileForm {
  return {
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
  };
}

function validateProfileField(
  field: keyof ProfileForm,
  value: string,
  form: ProfileForm
): string | undefined {
  if (field === "fullName") {
    if (!value.trim()) return "Full name is required.";
    if (value.trim().length < 2) return "Enter at least 2 characters.";
  }

  if (field === "email") {
    if (!value.trim()) return "Email is required.";
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    if (!valid) return "Enter a valid email address.";
  }

  if (field === "phone") {
    if (!value.trim()) return "Phone number is required.";
    const valid = /^\+?[0-9\s-]{10,16}$/.test(value.trim());
    if (!valid) return "Enter a valid phone number.";
  }

  if (field === "role" && !form.role) {
    return "Role is required.";
  }

  return undefined;
}

function validateProfileForm(
  form: ProfileForm
): FormErrors<keyof ProfileForm> {
  return {
    fullName: validateProfileField("fullName", form.fullName, form),
    email: validateProfileField("email", form.email, form),
    phone: validateProfileField("phone", form.phone, form),
  };
}

function validatePasswordForm(
  form: PasswordForm
): FormErrors<keyof PasswordForm> {
  const errors: FormErrors<keyof PasswordForm> = {};

  if (!form.currentPassword.trim()) {
    errors.currentPassword = "Current password is required.";
  }
  if (!form.newPassword.trim()) {
    errors.newPassword = "New password is required.";
  } else if (form.newPassword.trim().length < 8) {
    errors.newPassword = "Minimum 8 characters required.";
  }
  if (!form.confirmPassword.trim()) {
    errors.confirmPassword = "Please confirm the new password.";
  } else if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"profile" | "password">(
    "profile"
  );
  const [drawerForm, setDrawerForm] = useState<ProfileForm>(EMPTY_FORM);
  const [drawerErrors, setDrawerErrors] = useState<
    FormErrors<keyof ProfileForm>
  >({});
  const [savingDrawer, setSavingDrawer] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(
    EMPTY_PASSWORD_FORM
  );
  const [passwordErrors, setPasswordErrors] = useState<
    FormErrors<keyof PasswordForm>
  >({});
  const [savingPassword, setSavingPassword] = useState(false);

  const applyProfile = useCallback((nextProfile: AdminProfileData) => {
    setProfile(nextProfile);
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const res = await fetch("/api/admin/profile", {
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse<AdminProfileData>;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message ?? "Failed to load profile.");
      }

      applyProfile(json.data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load profile.";
      setPageError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [applyProfile]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  function openProfileDrawer() {
    if (!profile) return;
    setDrawerMode("profile");
    setDrawerForm(toProfileForm(profile));
    setDrawerErrors({});
    setDrawerOpen(true);
  }

  function openPasswordDrawer() {
    setDrawerMode("password");
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setPasswordErrors({});
    setDrawerOpen(true);
  }

  async function handleSaveDrawerProfile() {
    const nextErrors = validateProfileForm(drawerForm);
    setDrawerErrors(nextErrors);

    const hasError = Object.values(nextErrors).some(Boolean);
    if (hasError) return;

    setSavingDrawer(true);
    try {
      const payload: {
        fullName: string;
        email: string;
        phone: string;
      } = {
        fullName: drawerForm.fullName,
        email: drawerForm.email,
        phone: drawerForm.phone,
      };

      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as ApiResponse<AdminProfileData>;
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message ?? "Failed to update profile.");
      }

      applyProfile(json.data);
      toast.success("Profile details saved successfully.");
      setDrawerOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update profile.";
      toast.error(message);
    } finally {
      setSavingDrawer(false);
    }
  }

  async function handleSavePassword() {
    const nextErrors = validatePasswordForm(passwordForm);
    setPasswordErrors(nextErrors);

    const hasError = Object.values(nextErrors).some(Boolean);
    if (hasError) return;

    setSavingPassword(true);
    try {
      const res = await fetch("/api/admin/profile/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordForm),
      });

      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Failed to update password.");
      }

      toast.success("Password updated successfully.");
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setDrawerOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update password.";
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  }

  const profileImageSrc = resolveAdminProfileImage(
    {
      fullName: profile?.fullName,
      email: profile?.email,
      phone: profile?.phone,
    },
    "profile"
  );

  return (
    <>
      <PageHeader
        title="Admin Profile"
        description="Manage account details and profile information."
      />

      {loading ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          Loading profile...
        </div>
      ) : pageError && !profile ? (
        <AdminEmptyState
          className="mt-6"
          title="Profile unavailable"
          description={pageError}
          icon={<User size={18} />}
          actionLabel="Retry"
          onAction={() => void fetchProfile()}
        />
      ) : profile ? (
        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <Image
                src={profileImageSrc}
                alt="Admin profile"
                width={100}
                height={100}
                className="h-[100px] w-[100px] rounded-full border border-slate-200 object-cover"
              />
              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openPasswordDrawer}
                  className="inline-flex w-full cursor-pointer items-center justify-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:justify-center sm:text-center"
                >
                  <Lock size={14} />
                  Change Password
                </button>
                <button
                  type="button"
                  onClick={openProfileDrawer}
                  className="inline-flex w-full cursor-pointer items-center justify-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:justify-center sm:text-center"
                >
                  <Pencil size={14} />
                  Edit Profile
                </button>
              </div>
            </div>

            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Personal Information
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                View your account details here. Click Edit Profile to make changes.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Full Name" value={profile.fullName} />
              <ReadOnlyField label="Email" value={profile.email} />
              <ReadOnlyField label="Phone" value={profile.phone} />
              <ReadOnlyField label="Password" value={PASSWORD_MASK} type="password" />
              <ReadOnlyField label="Role" value={profile.role} />
              <ReadOnlyField label="Account Status" value={profile.status} />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Activity size={18} />
                Account Activity
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <StatCard
                label="Account Created"
                value={formatISTDateTime(profile.createdAt)}
              />
              <StatCard
                label="Last Updated"
                value={formatISTDateTime(profile.updatedAt)}
              />
              <StatCard
                label="Last Login"
                value={formatISTDateTime(profile.lastLoginAt)}
              />
            </div>
          </article>

          <AdminDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title={
              drawerMode === "profile"
                ? "Edit Profile Details"
                : "Update Password"
            }
            description={
              drawerMode === "profile"
                ? "Update personal details from a focused editing view."
                : "Enter current password and set a new password."
            }
          >
            {drawerMode === "profile" ? (
              <div className="space-y-4">
                <Field
                  label="Full Name"
                  value={drawerForm.fullName}
                  error={drawerErrors.fullName}
                  onChange={(value) =>
                    setDrawerForm((prev) => ({ ...prev, fullName: value }))
                  }
                />
                <Field
                  label="Email"
                  value={drawerForm.email}
                  error={drawerErrors.email}
                  onChange={(value) =>
                    setDrawerForm((prev) => ({ ...prev, email: value }))
                  }
                />
                <Field
                  label="Phone"
                  value={drawerForm.phone}
                  error={drawerErrors.phone}
                  onChange={(value) =>
                    setDrawerForm((prev) => ({ ...prev, phone: value }))
                  }
                />
                <Field
                  label="Role"
                  value={drawerForm.role}
                  onChange={() => {}}
                  readOnly
                />

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="cursor-pointer rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingDrawer}
                    onClick={() => void handleSaveDrawerProfile()}
                    className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingDrawer ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Field
                  label="Current Password"
                  value={passwordForm.currentPassword}
                  error={passwordErrors.currentPassword}
                  type="password"
                  onChange={(value) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      currentPassword: value,
                    }))
                  }
                />
                <Field
                  label="New Password"
                  value={passwordForm.newPassword}
                  error={passwordErrors.newPassword}
                  type="password"
                  onChange={(value) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      newPassword: value,
                    }))
                  }
                />
                <Field
                  label="Confirm New Password"
                  value={passwordForm.confirmPassword}
                  error={passwordErrors.confirmPassword}
                  type="password"
                  onChange={(value) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      confirmPassword: value,
                    }))
                  }
                />

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="cursor-pointer rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingPassword}
                    onClick={() => void handleSavePassword()}
                    className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingPassword ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </div>
            )}
          </AdminDrawer>
        </section>
      ) : (
        <AdminEmptyState
          className="mt-6"
          title="No profile data found"
          description="Admin profile data is not available right now. Please try again."
          icon={<RefreshCcw size={18} />}
          actionLabel="Retry"
          onAction={() => void fetchProfile()}
        />
      )}
    </>
  );
}

function ReadOnlyField({
  label,
  value,
  type = "text",
}: {
  label: string;
  value: string;
  type?: string;
}) {
  return <Field label={label} value={value} onChange={() => {}} readOnly type={type} />;
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  error,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  type?: string;
  readOnly?: boolean;
}) {
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="relative">
        <input
          type={isPassword ? (showPassword ? "text" : "password") : type}
          value={value}
          readOnly={readOnly}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
          className={`h-10 w-full rounded-md border px-3 text-sm text-slate-900 outline-none transition ${
            isPassword ? "pr-10" : ""
          } ${
            readOnly
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600"
              : error
              ? "border-red-300 bg-red-50 focus:border-red-400"
              : "border-slate-200 bg-white focus:border-slate-300"
          }`}
        />

        {isPassword && !readOnly && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
