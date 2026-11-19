import { AppError, clampText, designSchema, type Design } from '@maploom/core';
import { decrypt, encrypt, newToken } from './crypto';
import { getDb } from './db';
import { env } from './env';

/**
 * Saved projects. Nothing is written here until the customer presses Save.
 * The design (which contains the home coordinates and any names) and the
 * location label are encrypted at rest; only non-identifying columns (style,
 * product, timestamps) are queryable.
 */
export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  styleId: string;
  productId: string;
  variantId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  design: Design;
  location: { label: string; context: string };
  geographyKey: string | null;
}

interface Row {
  id: string;
  owner_hash: string;
  name: string;
  status: string;
  style_id: string;
  product_id: string;
  variant_id: string;
  location_enc: string;
  geography_key: string | null;
  version: number;
  created_at: string | Date;
  updated_at: string | Date;
}

const iso = (v: string | Date) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());
const summary = (r: Row): ProjectSummary => ({ id: r.id, name: r.name, status: r.status, styleId: r.style_id, productId: r.product_id, variantId: r.variant_id, version: r.version, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) });

export const MAX_PROJECTS_PER_OWNER = 50;
export const MAX_VERSIONS_KEPT = 20;

export async function saveProject(ownerHash: string, input: { id?: string; name: string; design: unknown; location: { label: string; context: string }; note?: string }): Promise<ProjectSummary> {
  const design = designSchema.parse(input.design);
  const db = await getDb();
  const secret = env().APP_SECRET;
  const name = clampText(input.name, 80).trim() || 'Untitled map';
  const locationEnc = encrypt(secret, JSON.stringify({ label: clampText(input.location.label, 120), context: clampText(input.location.context, 160) }));
  const designEnc = encrypt(secret, JSON.stringify(design));
  let row: Row | undefined;
  if (input.id) {
    const rows = await db.query<Row>(
      `UPDATE projects SET name=$3, style_id=$4, product_id=$5, variant_id=$6, location_enc=$7, geography_key=$8, version=version+1, updated_at=now()
       WHERE id=$1 AND owner_hash=$2 RETURNING *`,
      [input.id, ownerHash, name, design.styleId, design.product.productId, design.product.variantId, locationEnc, design.geographyKey ?? null],
    );
    row = rows[0];
    if (!row) throw new AppError('NOT_FOUND');
  } else {
    const count = await db.query<{ n: string }>('SELECT count(*) AS n FROM projects WHERE owner_hash=$1', [ownerHash]);
    if (Number(count[0].n) >= MAX_PROJECTS_PER_OWNER) throw new AppError('INVALID_INPUT', 'project limit');
    const rows = await db.query<Row>(
      `INSERT INTO projects (id, owner_hash, name, style_id, product_id, variant_id, location_enc, geography_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [`prj_${newToken(12)}`, ownerHash, name, design.styleId, design.product.productId, design.product.variantId, locationEnc, design.geographyKey ?? null],
    );
    row = rows[0];
  }
  await db.query('INSERT INTO design_versions (id, project_id, version, design_enc, note) VALUES ($1,$2,$3,$4,$5)', [`dv_${newToken(12)}`, row.id, row.version, designEnc, input.note ? clampText(input.note, 120) : null]);
  await db.query(`DELETE FROM design_versions WHERE project_id=$1 AND version <= $2`, [row.id, row.version - MAX_VERSIONS_KEPT]);
  return summary(row);
}

export async function listProjects(ownerHash: string): Promise<ProjectSummary[]> {
  const db = await getDb();
  return (await db.query<Row>('SELECT * FROM projects WHERE owner_hash=$1 ORDER BY updated_at DESC LIMIT 100', [ownerHash])).map(summary);
}

export async function getProject(ownerHash: string, id: string, version?: number): Promise<ProjectDetail> {
  const db = await getDb();
  const rows = await db.query<Row>('SELECT * FROM projects WHERE id=$1 AND owner_hash=$2', [id, ownerHash]);
  const row = rows[0];
  if (!row) throw new AppError('NOT_FOUND');
  const versions = await db.query<{ design_enc: string }>('SELECT design_enc FROM design_versions WHERE project_id=$1 AND version=$2', [id, version ?? row.version]);
  if (!versions[0]) throw new AppError('NOT_FOUND');
  const secret = env().APP_SECRET;
  return { ...summary(row), design: designSchema.parse(JSON.parse(decrypt(secret, versions[0].design_enc))), location: JSON.parse(decrypt(secret, row.location_enc)), geographyKey: row.geography_key };
}

export async function listVersions(ownerHash: string, id: string): Promise<{ version: number; note: string | null; createdAt: string }[]> {
  const db = await getDb();
  const rows = await db.query<{ version: number; note: string | null; created_at: string | Date }>(
    `SELECT v.version, v.note, v.created_at FROM design_versions v JOIN projects p ON p.id = v.project_id WHERE p.id=$1 AND p.owner_hash=$2 ORDER BY v.version DESC`,
    [id, ownerHash],
  );
  return rows.map((r) => ({ version: r.version, note: r.note, createdAt: iso(r.created_at) }));
}

/** Hard delete: the project, every version, and its exports (ON DELETE CASCADE). */
export async function deleteProject(ownerHash: string, id: string): Promise<void> {
  const db = await getDb();
  const rows = await db.query('DELETE FROM projects WHERE id=$1 AND owner_hash=$2 RETURNING id', [id, ownerHash]);
  if (!rows.length) throw new AppError('NOT_FOUND');
}

/** "Delete everything you have about me" for a guest/owner. */
export async function deleteAllForOwner(ownerHash: string): Promise<{ projects: number }> {
  const db = await getDb();
  const rows = await db.query('DELETE FROM projects WHERE owner_hash=$1 RETURNING id', [ownerHash]);
  await db.query('DELETE FROM exports WHERE owner_hash=$1', [ownerHash]);
  await db.query('DELETE FROM jobs WHERE owner_hash=$1', [ownerHash]);
  return { projects: rows.length };
}
