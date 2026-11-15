import type { Metadata } from "next";
import ResumeUpload from "./resume-upload";

export const metadata: Metadata = { title: "Resume Lab | ScaleMe" };

export default function ResumeLabPage() {
  return <ResumeUpload />;
}
