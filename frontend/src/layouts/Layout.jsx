import Navbar from './Navbar';

export default function Layout({ children }) {
  console.log('📐 Layout component rendered');
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {children}
    </div>
  );
}
