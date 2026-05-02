import "./globals.css";

export const metadata = {
  title: "Tadreeb — منصة تدريب وإدارة تعلم",
  description: "منصة تدريب وإدارة تعلم - سجل دخولك لمتابعة المحاضرات والمهام",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <div id="toast" className="toast"></div>
      </body>
    </html>
  );
}
