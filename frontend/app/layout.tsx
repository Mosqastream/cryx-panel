import "./globals.css";

export const metadata = {
  title: "Codigos Cryxteam",
  description: "Panel de códigos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="main-header">
          Codigos Cryxteam
        </header>

        <div className="page-wrapper">
          {children}
        </div>

        <a
          href="https://wa.me/51929436705"
          target="_blank"
          rel="noopener noreferrer"
          className="wa-btn"
        >
          <img src="/whatsapp.png" alt="Whatsapp" />
        </a>
      </body>
    </html>
  );
}
