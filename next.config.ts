import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["antd", "@ant-design/icons", "rc-util", "rc-pagination", "rc-picker"],
  allowedDevOrigins: ["192.168.0.199", "localhost:3000", "127.0.0.1:3000"],
};

export default nextConfig;
