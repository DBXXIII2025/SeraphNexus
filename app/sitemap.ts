import type {MetadataRoute} from "next";
import {companyServices} from "@/lib/companySite";
export default function sitemap():MetadataRoute.Sitemap{return ["/","/services","/products","/portfolio","/about","/contact","/nexus","/explore",...companyServices.map(s=>"/services/"+s.slug)].map(path=>({url:"https://seraphnexus.com"+path}));}
