// Add CORS support for frontend
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Auth middleware
// ... rest of existing code ... 