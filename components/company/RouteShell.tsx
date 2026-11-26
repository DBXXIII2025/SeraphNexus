"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { isCompanyPath } from "@/lib/companySite";
import CompanyShell from "./CompanyShell";
export default function RouteShell({initialCompany,platformHeader,platformFooter,children}:{initialCompany:boolean;platformHeader:ReactNode;platformFooter:ReactNode;children:ReactNode}){
 const path=usePathname()||"/";
 const company=isCompanyPath(path);
 useEffect(()=>{if(initialCompany&&!company)window.location.reload();},[initialCompany,company]);
 const hideFooter=["/admin","/dashboard","/platform-admin"].some(p=>path.startsWith(p));
 return <>{!company&&platformHeader}<main id="main-content" className="flex-1" tabIndex={-1}>{company?<CompanyShell>{children}</CompanyShell>:children}</main>{!company&&!hideFooter&&platformFooter}</>;
}
