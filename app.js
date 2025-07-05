// core/registry/app.js
//------------------------------------------------------------
// Twin Registry  (Express + Prisma + Supabase Auth)
//------------------------------------------------------------
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

console.log("🔍 DATABASE_URL =", process.env.DATABASE_URL);

const prisma    = new PrismaClient();
const app       = express();

// ─── Supabase admin client (service role key) ───────────────
const supabase  = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY        // **service‑role** key
);

//────────────────────────────────────────────────────────────
//  Auth middleware  – verifies JWT & attaches req.user
//────────────────────────────────────────────────────────────
async function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthenticated" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user)
    return res.status(401).json({ error: "Unauthenticated" });

  req.user = data.user;
  next();
}

app.use(cors());
app.use(express.json());

//────────────────────────────────────────────────────────────
// POST /twin.register   → create one twin
//────────────────────────────────────────────────────────────
app.post("/twin.register", auth, async (req, res) => {
  const { id, specURL, capabilities = [] } = req.body;
  if (!specURL) return res.status(400).json({ error: "specURL is required" });

  try {
    const twin = await prisma.twin.create({
      data: {
        id,                                 // prisma generates UUID if undefined
        createdBy: req.user.id,             // ① owner!
        specURL,
        capabilities: capabilities.join(","),
        eventMeshURL: "ws://localhost:5000"
      },
    });

    res.status(201).json({ ...twin, capabilities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

//────────────────────────────────────────────────────────────
// GET /twin.query        → list current user's twins
//────────────────────────────────────────────────────────────
app.get("/twin.query", auth, async (req, res) => {
  console.log("🔍 Handling /twin.query for", req.user.email);
  try {
    const twins = await prisma.twin.findMany({
      where: { createdBy: req.user.id },    // ② filter by owner
    });
    res.json(
      twins.map((t) => ({
        ...t,
        capabilities: t.capabilities.split(",").filter(Boolean),
      }))
    );
  } catch (err) {
    console.error("❌ Prisma query error:", err);
    res.status(500).json({ error: "Database error", detail: err.message });
  }
});

//────────────────────────────────────────────────────────────
// GET /twin/:id          → get one twin owned by user
//────────────────────────────────────────────────────────────
app.get("/twin/:id", auth, async (req, res) => {
  const twin = await prisma.twin.findFirst({
    where: { id: req.params.id, createdBy: req.user.id },
  });
  if (!twin) return res.status(404).json({ error: "Not found" });

  res.json({ ...twin, capabilities: twin.capabilities.split(",").filter(Boolean) });
});

//────────────────────────────────────────────────────────────
// PUT /twin/:id          → update twin (only owner)
//────────────────────────────────────────────────────────────
app.put("/twin/:id", auth, async (req, res) => {
  const { specURL, capabilities = [] } = req.body;
  try {
    const twin = await prisma.twin.update({
      where: { id_createdBy: { id: req.params.id, createdBy: req.user.id } },
      data: { specURL, capabilities: capabilities.join(",") },
    });
    res.json({ ...twin, capabilities });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Update failed" });
  }
});

//────────────────────────────────────────────────────────────
// DELETE /twin/:id       → remove twin (only owner)
//────────────────────────────────────────────────────────────
app.delete("/twin/:id", auth, async (req, res) => {
  try {
    await prisma.twin.delete({
      where: { id_createdBy: { id: req.params.id, createdBy: req.user.id } },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Delete failed" });
  }
});

//────────────────────────────────────────────────────────────
// (Optional) alias /twins → same as /twin.query
//────────────────────────────────────────────────────────────
app.get("/twins", (_req, res) => res.redirect("/twin.query"));

//────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🛰️  Twin Registry running on port ${PORT}`)
);
