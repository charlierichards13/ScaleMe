import type { Metadata } from "next";
import AuthPreview from "../_components/auth-preview";

export const metadata: Metadata = {
  title: "Sign In Preview | ScaleMe",
  description: "A UI-only ScaleMe sign-in preview. Accounts are not enabled. Do not enter real passwords.",
};

export default function SignInPage() {
  return <AuthPreview mode="sign-in" />;
}
