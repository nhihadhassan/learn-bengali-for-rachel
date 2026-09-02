import type { Metadata } from "next";

export const SITE_URL = "https://learn-bengali-for-rachel.vercel.app";
export const SITE_NAME = "Learning for Rachel";
export const ROOT_TITLE = "Learning for Rachel | Bengali, Spanish & More";
export const SITE_DESCRIPTION =
  "A friendly learning app for Bengali, Spanish, Malayalam, and bite-size history stories.";
export const SOCIAL_IMAGE_PATH = "/opengraph-image";

export function absoluteSiteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function createPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const url = absoluteSiteUrl(path);
  const image = absoluteSiteUrl(SOCIAL_IMAGE_PATH);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} social preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
    ...(noIndex
      ? { robots: { index: false, follow: false } }
      : undefined),
  };
}

export const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#application`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires a modern web browser with JavaScript",
      isAccessibleForFree: true,
      featureList: [
        "Language lessons",
        "Spaced repetition practice",
        "Vocabulary review",
        "Learning progress tracking",
      ],
    },
  ],
} as const;
