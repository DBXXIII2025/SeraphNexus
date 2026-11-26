import type {MetadataRoute} from "next";
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:"*",allow:"/",disallow:["/admin","/dashboard","/platform-admin","/api/","/auth/","/messages","/project-brief"]},sitemap:"https://seraphnexus.com/sitemap.xml"};}
