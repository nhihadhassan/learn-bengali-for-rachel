import { CoursePicker } from "@/components/lesson/course-picker";
import { createPageMetadata, ROOT_TITLE, SITE_DESCRIPTION } from "@/lib/site-metadata";

const rootMetadata = createPageMetadata({
  title: "Learning for Rachel",
  description: SITE_DESCRIPTION,
  path: "/",
});

export const metadata = {
  ...rootMetadata,
  title: { absolute: ROOT_TITLE },
  openGraph: { ...rootMetadata.openGraph, title: ROOT_TITLE },
  twitter: { ...rootMetadata.twitter, title: ROOT_TITLE },
};

export default function HomePage() {
  return <CoursePicker />;
}
