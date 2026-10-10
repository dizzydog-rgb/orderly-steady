import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mealRoutes from "./routes/meals";
import authRoutes from "./routes/auth";
import foodDictionaryRoutes from "./routes/foodDictionary";
import foodOverrideRoutes from "./routes/foodOverrides";

export const app = express();

app.use(cors({ credentials: true, origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
app.use(cookieParser());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/meals", mealRoutes);
app.use("/api/food-dictionary", foodDictionaryRoutes);
app.use("/api/food-overrides", foodOverrideRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
