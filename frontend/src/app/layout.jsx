
import "./globals.css";

export const metadata = {
  title: "MediPilot AI | Intelligent Healthcare",
  description:
    "An AI-powered healthcare platform connecting patients, doctors, hospitals, and diagnostic services.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
