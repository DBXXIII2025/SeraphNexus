import type {MetadataRoute} from "next";
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:"*",allow:["/","/api/social-image"],disallow:["/api/","/auth/","/admin/","/dashboard/","/platform-admin/","/messages/"]},sitemap:"https://seraphnexus.com/sitemap.xml"};}
