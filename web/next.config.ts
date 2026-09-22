import type { NextConfig } from "next";

// Aex Pass ahora vive dentro de Aex Stellar Lab. Este sitio solo redirige,
// para que los links viejos a aex-pass.vercel.app sigan funcionando.
const LAB = "https://aex-stellar-lab.vercel.app/tareas/aex-pass";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/", destination: LAB, permanent: false },
      { source: "/:path+", destination: LAB, permanent: false },
    ];
  },
};

export default nextConfig;
