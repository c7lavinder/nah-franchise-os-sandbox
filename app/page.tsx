import { redirect } from "next/navigation";

/** Root page — redirects to Scout AI (the default page) */
export default function HomePage() {
  redirect("/scout");
}
