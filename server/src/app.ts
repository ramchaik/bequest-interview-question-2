import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

const PORT = 8080;
const app = express();

type DBValues = {
  data: string;
  iv: string;
  checksum: string;
  hmac: string;
};

type DBHistValues = DBValues & {
  timestamp: string;
};

let database: DBValues = {
  data: "Hello World",
  iv: "",
  checksum: "",
  hmac: "",
};

let lastValidData: DBHistValues = {
  ...database,
  timestamp: new Date().toISOString(),
};
const databaseHistory: DBHistValues[] = [lastValidData];

app.use(morgan("tiny"));
app.use(cors());
app.use(express.json());

// Rate limiting middleware to protect the API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later.",
});

app.use(limiter);

app.get("/", (_, res) => {
  res.json({
    data: database.data,
    iv: database.iv,
    hmac: database.hmac,
    checksum: database.checksum,
  });
});

app.post("/", (req, res) => {
  const { data, iv, checksum, hmac } = req.body;

  // Save the current state to history
  const newEntry: DBHistValues = {
    ...database,
    timestamp: new Date().toISOString(),
  };
  databaseHistory.push(newEntry);
  lastValidData = newEntry;

  // Update the database with the new data
  database = { data, iv, checksum, hmac };

  res.sendStatus(200);
});

app.get("/recover", (_, res) => {
  if (lastValidData) {
    res.json({
      data: lastValidData.data,
      iv: lastValidData.iv,
      hmac: lastValidData.hmac,
      checksum: lastValidData.checksum,
    });
  } else {
    res.status(404).json({ error: "No previous data available to recover." });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
