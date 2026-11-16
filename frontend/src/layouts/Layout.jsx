import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
