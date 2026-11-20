// Linking logins to employee records, and who is on a project's team.
// No imports, so the unit tests run this file directly.

export type Person = { id: string; name: string; email: string; role: string };
export type EmployeeLike = { id: string; name: string; email: string; userId?: string; status?: string };

const STAFF = ['admin', 'manager', 'user'];

/**
 * What to write so every staff login has an employee record with the same id,
 * and linked records keep the login's name and email (the login is the source
 * of truth for those two). Records added by hand (no userId) are left alone.
 */
export function employeeSync(people: Person[], employees: EmployeeLike[]) {
  const byId = new Map(employees.map(e => [e.id, e]));
  const create: Person[] = [];
  const update: { id: string; name: string; email: string }[] = [];
  for (const person of people) {
    if (!STAFF.includes(person.role)) continue;
    const record = byId.get(person.id);
    if (!record) create.push(person);
    else if (record.userId === person.id && (record.name !== person.name || record.email !== person.email)) {
      update.push({ id: person.id, name: person.name, email: person.email });
    }
  }
  return { create, update };
}

/** The employee record for a login (id = the login's uid). */
export function newEmployeeRecord(person: { id: string; name: string; email: string }, today: string) {
  return {
    userId: person.id, name: person.name, email: person.email,
    department: '', position: '', phone: '', joinDate: today, status: 'active' as const,
  };
}

/** The project lead, everyone with a task on it, and members added by hand: each once. */
export function projectTeamIds(project: { assignedTo?: string; tasks?: { assignedTo?: string }[]; teamMembers?: string[] }): string[] {
  const ids = [project.assignedTo, ...(project.tasks ?? []).map(t => t.assignedTo), ...(project.teamMembers ?? [])];
  return [...new Set(ids.filter((id): id is string => !!id))];
}
