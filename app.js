// core/registry/app.js
//------------------------------------------------------------
// Twin Registry  (Express + Prisma + Supabase Auth)
// CommonJS version – safe for Node on Render
//------------------------------------------------------------
const express       = require("express");
const cors          = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { PrismaClient } = require("@prisma/client");

console.log("🔍 DATABASE_URL =", process.env.DATABASE_URL);

const prisma   = new PrismaClient();
const app      = express();

// ─── Supabase admin client (service‑role key) ───────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY     // service‑role key (server side only)
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

/* ──────────────────────────────────────────────────────────
   HEARTBEAT: insert one row every 60 s so we know the
   registry is alive. Table schema:

     create table heartbeat_logs (
       id  uuid primary key default uuid_generate_v4(),
       time timestamptz default now()
     );

   ────────────────────────────────────────────────────────── */
async function pingSupabase() {
  const { error } = await supabase.from("heartbeat_logs").insert({});
  if (error) {
    console.error("❌ Heartbeat insert failed:", error.message);
  } else {
    console.log("✅ Heartbeat logged");
  }
}
setInterval(pingSupabase, 60_000); // 60s

// (optional) external uptime monitor can call POST /heartbeat
app.post("/heartbeat", async (_req, res) => {
  await pingSupabase();
  res.json({ ok: true });
});

/* ───────────────────────── Twin routes (unchanged) ─────── */
app.post("/twin.register", auth, async (req, res) => {
  const { id, specURL, capabilities = [] } = req.body;
  if (!specURL) return res.status(400).json({ error: "specURL is required" });

  try {
    const twin = await prisma.twin.create({
      data: {
        id,
        createdBy: req.user.id,
        specURL,
        capabilities: capabilities.join(","),
        eventMeshURL:
          process.env.MESH_WS || "wss://twin-sync-mesh.onrender.com",
      },
    });
    res.status(201).json({ ...twin, capabilities });
  } catch (err) {
    console.error("❌ Failed to create twin:", err);
    res.status(500).json({ error: "Database error", detail: err.message });
  }
});

app.get("/twin.query", auth, async (req, res) => {
  try {
    const twins = await prisma.twin.findMany({
      where: { createdBy: req.user.id },
    });
    res.json(
      twins.map((t) => ({
        ...t,
        capabilities: (t.capabilities ?? "").split(",").filter(Boolean),
      }))
    );
  } catch (err) {
    console.error("❌ Prisma query error:", err);
    res.status(500).json({ error: "Database error", detail: err.message });
  }
});

app.get("/twin/:id", auth, async (req, res) => {
  const twin = await prisma.twin.findFirst({
    where: { id: req.params.id, createdBy: req.user.id },
  });
  if (!twin) return res.status(404).json({ error: "Not found" });

  res.json({
    ...twin,
    capabilities: (twin.capabilities ?? "").split(",").filter(Boolean),
  });
});

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

app.get("/twins", (_req, res) => res.redirect("/twin.query"));

/* ────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🛰️  Twin Registry running on port ${PORT}`)
);
