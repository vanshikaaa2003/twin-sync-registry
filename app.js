// core/registry/app.js
//------------------------------------------------------------
//  Twin Registry Micro-service  (Express + Prisma + SQLite)
//------------------------------------------------------------
const express = require("express");
const cors = require("cors");

console.log("🔍 DATABASE_URL =", process.env.DATABASE_URL);
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

//------------------------------------------------------------
// POST /twin.register   → create one twin
//------------------------------------------------------------
app.post("/twin.register", async (req, res) => {
  const { id, specURL, capabilities = [] } = req.body;
  if (!specURL) return res.status(400).json({ error: "specURL is required" });

  try {
    const twin = await prisma.twin.create({
      data: {
        id, // if undefined Prisma generates UUID
        specURL,
        capabilities: capabilities.join(","),
        eventMeshURL: "ws://localhost:5000"
      },
    });

    res.status(201).json({
      ...twin,
      capabilities: capabilities, // send as array
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

//------------------------------------------------------------
// GET /twin.query        → list all twins
//------------------------------------------------------------
app.get("/twin.query", async (_req, res) => {
  const twins = await prisma.twin.findMany();
  res.json(
    twins.map((t) => ({
      ...t,
      capabilities: t.capabilities.split(",").filter(Boolean),
    }))
  );
});

//------------------------------------------------------------
// GET /twin/:id          → get one twin
//------------------------------------------------------------
app.get("/twin/:id", async (req, res) => {
  const twin = await prisma.twin.findUnique({ where: { id: req.params.id } });
  if (!twin) return res.status(404).json({ error: "Not found" });

  res.json({
    ...twin,
    capabilities: twin.capabilities.split(",").filter(Boolean),
  });
});

//------------------------------------------------------------
// NEW  PUT /twin/:id     → update specURL / capabilities
//------------------------------------------------------------
app.put("/twin/:id", async (req, res) => {
  const { specURL, capabilities = [] } = req.body;
  try {
    const twin = await prisma.twin.update({
      where: { id: req.params.id },
      data: {
        specURL,
        capabilities: capabilities.join(","),
      },
    });

    res.json({
      ...twin,
      capabilities,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Update failed" });
  }
});

//------------------------------------------------------------
// NEW  DELETE /twin/:id  → remove a twin
//------------------------------------------------------------
app.delete("/twin/:id", async (req, res) => {
  try {
    await prisma.twin.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Delete failed" });
  }
});

//------------------------------------------------------------
// (Optional) alias /twins → same as /twin.query
//------------------------------------------------------------
app.get("/twins", (_req, res) => res.redirect("/twin.query"));

//------------------------------------------------------------
const PORT = 4000;
app.listen(PORT, () =>
  console.log(`🛰️  Twin Registry running at http://localhost:${PORT}`)
);
