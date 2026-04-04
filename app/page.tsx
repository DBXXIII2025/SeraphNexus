export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">
        Get More Bookings Automatically
      </h1>

      <p className="text-gray-400 mb-6 text-center max-w-md">
        Smart scheduling and dynamic pricing that increases your revenue without extra work.
      </p>

      <a
        href="/login"
        className="bg-white text-black px-6 py-3 rounded"
      >
        Get Started
      </a>
    </main>
  );
}