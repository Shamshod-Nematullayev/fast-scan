import { config } from "dotenv";
config();

const PORT = process.env.PORT || 8585;
import express from "express";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;

  const allowedIPs = [
    "127.0.0.1",
    "::1", // IPv6 localhost
    "::ffff:127.0.0.1",
    "localhost",
  ];

  if (ip && allowedIPs.includes(ip)) {
    return next();
  }

  return res.status(403).send("🚫 Access denied");
});

// import end using routers
import mainRouter from "./routers/main.route.js";
app.use("/", mainRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
