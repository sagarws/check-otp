import "./globals.css";

export const metadata = {
  title: "Check OTP",
  description: "Fetch the latest seller-portal OTP from Gmail.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
