export const companyServices = [
 { slug: "ai-engineering", title: "AI engineering", description: "Put repetitive work on a smarter path with customer assistants and workflow automation.", outcomes: ["Customer inquiry assistants", "Knowledge retrieval and AI integrations", "Workflow automation with human oversight"] },
 { slug: "software-engineering", title: "Software engineering", description: "Connect your business operations with purpose-built software.", outcomes: ["Custom dashboards and applications", "API and business system integrations", "Booking and operational workflows"] },
 { slug: "web-development", title: "Web development", description: "Make it easier for customers to discover, trust and contact your business.", outcomes: ["Responsive website design and development", "Lead capture and appointment flows", "Performance and accessibility foundations"] },
 { slug: "digital-growth", title: "Digital growth", description: "Improve how customers discover your business across search and digital channels.", outcomes: ["Technical SEO and answer engine optimization", "Analytics and conversion measurement", "Social media and content strategy"] },
] as const;
export const companyPaths = ["/", "/services", "/products", "/portfolio", "/about", "/contact", "/project-brief"];
export function isCompanyPath(path: string) {
 return companyPaths.includes(path) || path.startsWith("/services/");
}
