import assert from "node:assert/strict";

// Synthetic PDF built in memory. No personal data, binary fixtures, temporary files or deps.
export function syntheticPdf(text = "SYNTHETIC RESUME\nEXPERIENCE\nBuilt a fictional scheduling tool with Python.") {
  const content = text.split("\n").map((line, i) => `BT /F1 12 Tf 56 ${730 - i * 20} Td (${line.replace(/[\\()]/g, "\\$&")}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

export async function smoke(base, token) {
  const send = async (bytes, auth = true) => {
    const body = new FormData();
    body.set("file", new Blob([bytes], { type: "application/pdf" }), "synthetic-resume.pdf");
    return fetch(`${base}/api/resume/parse`, {
      method: "POST", body, headers: { Origin: base, ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(20_000),
    });
  };
  assert.equal((await send(syntheticPdf(), false)).status, 401);
  const valid = await send(syntheticPdf());
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  const { resume } = await valid.json();
  assert.equal(resume.text, "SYNTHETIC RESUME\nEXPERIENCE\nBuilt a fictional scheduling tool with Python.");
  assert.equal(resume.filename, "synthetic-resume.pdf");
  assert.equal(resume.sections[0].heading, "Experience");
  assert.equal((await send(Buffer.from("renamed non PDF"))).status, 415);
  assert.equal((await send(Buffer.from("%PDF-1.4\nbroken"))).status, 422);
  assert.equal((await send(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
  const lab = await fetch(`${base}/resume-lab`);
  assert.equal(lab.status, 200);
  assert.match(await lab.text(), /Private upload access code/);
  console.log("Synthetic HTTP upload → Linux/host Rust parser → Resume JSON smoke passed.");
}

if (process.argv[1]?.endsWith("resume-upload-smoke.mjs")) {
  if (!process.env.RESUME_UPLOAD_TOKEN) throw new Error("Set a private test token (never print it).");
  await smoke(process.argv[2] ?? "http://localhost:3000", process.env.RESUME_UPLOAD_TOKEN);
}
