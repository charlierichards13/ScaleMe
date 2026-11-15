import type { Metadata } from "next";
import AuthPreview from "../_components/auth-preview";

export const metadata: Metadata = {
  title: "Create Account Preview | ScaleMe",
  description: "A UI-only ScaleMe create-account preview. No account will be created. Do not enter real passwords.",
};

export default function SignUpPage() {
  return <AuthPreview mode="sign-up" />;
}
