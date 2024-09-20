import express from "express";
import cors from "cors";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { v4 as uuidv4 } from "uuid";

const PORT = 8080;
const app = express();

const clientStore: { [token: string]: string } = {};

type DBValues = {
  data: string;
  checksum: string;
  hmac: string;
};

type DBHistValues = DBValues & {
  timestamp: string;
};

const database: DBValues = {
  data: "Hello World",
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

const generateHMAC = (data: string, checksum: string, secret: string) => {
  const message = `${data}-${checksum}`;
  return crypto.createHmac("sha512", secret).update(message).digest("hex");
};

// Rate limiting middleware to protect the API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later.",
});

app.use(limiter);

app.post("/init", (_, res) => {
  const clientToken = uuidv4();
  const clientSecret = crypto.randomBytes(32).toString("hex");
  clientStore[clientToken] = clientSecret;

  console.log(
    `Generated client token: ${clientToken} with secret: ${clientSecret}`
  );
  res.json({ token: clientToken, secret: clientSecret });
});

// Middleware to authenticate client based on token
app.use((req, res, next) => {
  const clientToken = req.headers["x-client-token"] as string;
  if (!clientToken || !clientStore[clientToken]) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  (req as any).clientSecret = clientStore[clientToken];
  return next();
});

app.get("/", (req, res) => {
  const clientSecret = (req as any).clientSecret;
  const serverHMAC = generateHMAC(
    database.data,
    database.checksum,
    clientSecret
  );
  const isValid = serverHMAC === database.hmac;

  res.json({
    data: database.data,
    hmac: database.hmac,
    checksum: database.checksum,
    isValid,
  });
});

app.post("/", (req, res) => {
  const clientSecret = (req as any).clientSecret;
  const { data, checksum, hmac } = req.body;
  const serverHMAC = generateHMAC(data, checksum, clientSecret);

  if (serverHMAC === hmac) {
    const newEntry: DBHistValues = {
      data: database.data,
      checksum: database.checksum,
      hmac: database.hmac,
      timestamp: new Date().toISOString(),
    };
    databaseHistory.push(newEntry);
    lastValidData = newEntry;

    database.data = data;
    database.checksum = checksum;
    database.hmac = serverHMAC;

    res.sendStatus(200);
  } else {
    res.status(400).json({ error: "Data integrity check failed." });
  }
});

app.get("/recover", (_, res) => {
  if (lastValidData) {
    res.json({ ...lastValidData, isValid: true });
  } else {
    res.status(404).json({ error: "No previous data available to recover." });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
