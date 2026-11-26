import type { Metadata } from "next";

export const SITE_URL = "https://seraphnexus.com";
export const COMPANY_NAME = "SeraphCore Technologies";
export const ORGANIZATION_ID = SITE_URL + "/#organization";
export const SOCIAL_IMAGE = "/api/social-image";
export function companyMetadata(title: string, description: string, path: string): Metadata {
  const fullTitle = title + " | " + COMPANY_NAME;
  const image = { url: SOCIAL_IMAGE, width: 1200, height: 630, alt: "SeraphCore Technologies — AI, software, web development and digital growth" };
  return {
    title: { absolute: fullTitle }, description, alternates: { canonical: SITE_URL + path },
    robots: { index: true, follow: true },
    openGraph: { type: "website", siteName: COMPANY_NAME, locale: "en_US", title: fullTitle, description, url: SITE_URL + path, images: [image] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [image] },
  };
}
export const organization = {
  "@context": "https://schema.org", "@type": "Organization", "@id": ORGANIZATION_ID,
  name: COMPANY_NAME, url: SITE_URL, logo: SITE_URL + "/seraphcore-logo.webp",
  description: "Technology business providing AI engineering, software development, websites and digital growth services.",
  areaServed: [{ "@type": "Place", name: "Rio Grande Valley, Texas" }, { "@type": "Country", name: "United States" }],
};
export function breadcrumb(items: Array<{ name: string; path: string }>) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item,i)=>({ "@type":"ListItem", position:i+1, name:item.name, item:SITE_URL+item.path })) };
}
