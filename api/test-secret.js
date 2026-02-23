export default function handler(req, res) {
  // Check if Vercel sees the environment variable
  const keyExists = !!process.env.GOOGLE_SERVICE_KEY;
  res.status(200).json({ keyExists });
}
