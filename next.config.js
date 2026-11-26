/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
    proxyClientMaxBodySize: "12mb",
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [
      { source: "/:section(admin|dashboard|platform-admin|messages|onboarding|auth)/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      ...["/login","/signup","/forgot-password","/reset-password","/project-brief","/booking-success","/booking-cancel","/order/success","/success"].map(source=>({source,headers:[{key:"X-Robots-Tag",value:"noindex, nofollow"}]})),
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
