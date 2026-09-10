import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ['farm-master-addition.xlsx', 'item-master-addition.xlsx'].map(filename => ({
      source: `/templates/${filename}`,
      headers: [{
        key: 'Content-Disposition',
        value: `attachment; filename="${filename}"`,
      }],
    }))
  },
  outputFileTracingIncludes: {
    '/api/wks/timelines/sql': ['./app/wks/task_timeline_2026-08-31_to_2026-09-04.sql'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.prod.website-files.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
}
export default nextConfig;
