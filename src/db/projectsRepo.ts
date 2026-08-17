import { getDb, type ProjectRow } from "./db";
import { newId } from "../lib/id";
import { todayKey } from "../lib/dates";

export async function listProjects(): Promise<ProjectRow[]> {
  const db = await getDb();
  return db.select<ProjectRow[]>("SELECT * FROM projects ORDER BY createdAt");
}

export async function createProject(input: {
  name: string;
  color: string;
  initialRate?: number | null;
}): Promise<ProjectRow> {
  const db = await getDb();
  const now = Date.now();
  const project: ProjectRow = {
    id: newId(),
    name: input.name,
    color: input.color,
    createdAt: now,
    updatedAt: now,
  };
  await db.execute(
    "INSERT INTO projects (id, name, color, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5)",
    [project.id, project.name, project.color, now, now],
  );
  if (input.initialRate != null) {
    await db.execute(
      "INSERT INTO rates (id, projectId, effectiveDate, rate, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6)",
      [newId(), project.id, todayKey(), input.initialRate, now, now],
    );
  }
  return project;
}

export async function updateProject(
  id: string,
  patch: { name?: string; color?: string },
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    values.push(patch.name);
    sets.push(`name = $${values.length}`);
  }
  if (patch.color !== undefined) {
    values.push(patch.color);
    sets.push(`color = $${values.length}`);
  }
  if (sets.length === 0) return;
  values.push(Date.now());
  sets.push(`updatedAt = $${values.length}`);
  values.push(id);
  await db.execute(
    `UPDATE projects SET ${sets.join(", ")} WHERE id = $${values.length}`,
    values,
  );
}
