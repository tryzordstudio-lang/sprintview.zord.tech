import "./globals.css";

export const metadata = {
  title: "Zord SprintView",
  description: "AI-powered sprint intelligence platform for engineering and stakeholder visibility.",
  icons: {
    icon: "/zord-logo.svg",
    shortcut: "/zord-logo.svg",
    apple: "/zord-logo.svg"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
