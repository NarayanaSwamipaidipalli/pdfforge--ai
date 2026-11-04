import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Doxera – Enterprise Document Intelligence',
    short_name: 'Doxera',
    description: 'Enterprise Cloud & Air-Gapped PDF Intelligence Platform with 24+ Tools & On-Premise LLM Models',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbfbfd',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
