import { ImageResponse } from 'next/og';

export const alt = 'Doxera — Document tools and AI';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 88, background: 'linear-gradient(135deg, #eff6ff, #ffffff)', color: '#172554' }}>
      <div style={{ fontSize: 110, fontWeight: 700, letterSpacing: -5 }}>Doxera</div>
      <div style={{ fontSize: 40, marginTop: 24 }}>Document tools and AI, in one workspace.</div>
      <div style={{ fontSize: 26, color: '#2563eb', marginTop: 56 }}>Convert · Organize · Understand</div>
    </div>, size,
  );
}
