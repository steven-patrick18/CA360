import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usersApi, type UserDetail } from '../../lib/admin-api'
import { ROLE_LABELS } from '../../lib/auth'
import { useToast, getApiErrorMessage } from '../../lib/toast'
import Spinner from '../../components/Spinner'

type Role =
  | 'MANAGING_PARTNER'
  | 'PARTNER'
  | 'BRANCH_HEAD'
  | 'SENIOR_ARTICLE'
  | 'ARTICLE'
  | 'ACCOUNTANT'

const ROLES: Role[] = [
  'MANAGING_PARTNER',
  'PARTNER',
  'BRANCH_HEAD',
  'SENIOR_ARTICLE',
  'ARTICLE',
  'ACCOUNTANT',
]

type Cell = 'YES' | 'NO' | string

interface PermissionRow {
  action: string
  cells: Record<Role, Cell>
}

interface Section {
  title: string
  description?: string
  rows: PermissionRow[]
}

// Mirrors the actual backend rules (RolesGuard + service-level scope filters).
// Update both this file AND the backend together when permissions change.
const SECTIONS: Section[] = [
  {
    title: 'Dashboard',
    rows: [
      {
        action: 'See dashboard stats',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'Own branch',
          SENIOR_ARTICLE: 'Assigned only',
          ARTICLE: 'Assigned only',
          ACCOUNTANT: 'Assigned only',
        },
      },
    ],
  },
  {
    title: 'Clients',
    description: 'Each user sees only the slice of clients their role allows.',
    rows: [
      {
        action: 'View clients',
        cells: {
          MANAGING_PARTNER: 'All firm',
          PARTNER: 'All firm',
          BRANCH_HEAD: 'Own branch',
          SENIOR_ARTICLE: 'Assigned',
          ARTICLE: 'Assigned',
          ACCOUNTANT: 'Assigned',
        },
      },
      {
        action: 'Create client',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
      {
        action: 'Edit data fields (name, contact, address, notes…)',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'YES',
          ACCOUNTANT: 'YES',
        },
      },
      {
        action: 'Change branch / assignee / status',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
      {
        action: 'Archive client',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'NO',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
      {
        action: 'Bulk import from Excel',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'NO',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
      {
        action: 'Export to Excel',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'YES',
          ACCOUNTANT: 'YES',
        },
      },
    ],
  },
  {
    title: 'Portal credentials (vault)',
    description:
      'Stored AES-256-GCM-encrypted. Every reveal is logged with user, IP, and timestamp.',
    rows: [
      {
        action: 'See list of saved logins',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'YES',
          ACCOUNTANT: 'YES',
        },
      },
      {
        action: 'Set / update credentials',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
      {
        action: 'Reveal password (decrypt)',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
      {
        action: 'Delete credential',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'NO',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
    ],
  },
  {
    title: 'ITR Filings',
    rows: [
      {
        action: 'View filings',
        cells: {
          MANAGING_PARTNER: 'All firm',
          PARTNER: 'All firm',
          BRANCH_HEAD: 'Own branch',
          SENIOR_ARTICLE: 'Assigned',
          ARTICLE: 'Assigned',
          ACCOUNTANT: 'Assigned',
        },
      },
      {
        action: 'Create filing (on a client in their scope)',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'YES',
          ACCOUNTANT: 'YES',
        },
      },
      {
        action: 'Update status / dates / amounts',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'YES',
          ACCOUNTANT: 'YES',
        },
      },
      {
        action: 'Delete filing (only if not yet FILED)',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'NO',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
      {
        action: 'Export filings to Excel',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'YES',
          ACCOUNTANT: 'YES',
        },
      },
    ],
  },
  {
    title: 'Documents',
    rows: [
      {
        action: 'Upload documents',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'YES',
          ACCOUNTANT: 'YES',
        },
      },
      {
        action: 'Download documents',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'YES',
          ARTICLE: 'YES',
          ACCOUNTANT: 'YES',
        },
      },
      {
        action: 'Delete document',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'YES',
          SENIOR_ARTICLE: 'NO',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
    ],
  },
  {
    title: 'Branches',
    rows: [
      {
        action: 'View branches',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'NO',
          SENIOR_ARTICLE: 'NO',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
      {
        action: 'Create / edit branches',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'NO',
          BRANCH_HEAD: 'NO',
          SENIOR_ARTICLE: 'NO',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
    ],
  },
  {
    title: 'Users',
    rows: [
      {
        action: 'View users',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'YES',
          BRANCH_HEAD: 'NO',
          SENIOR_ARTICLE: 'NO',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
      {
        action: 'Create / edit / deactivate users',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'NO',
          BRANCH_HEAD: 'NO',
          SENIOR_ARTICLE: 'NO',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
      {
        action: 'Reset another user’s password',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'NO',
          BRANCH_HEAD: 'NO',
          SENIOR_ARTICLE: 'NO',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
    ],
  },
  {
    title: 'Audit log',
    rows: [
      {
        action: 'Export audit log to Excel',
        cells: {
          MANAGING_PARTNER: 'YES',
          PARTNER: 'NO',
          BRANCH_HEAD: 'NO',
          SENIOR_ARTICLE: 'NO',
          ARTICLE: 'NO',
          ACCOUNTANT: 'NO',
        },
      },
    ],
  },
]

function CellBadge({ value }: { value: Cell }) {
  if (value === 'YES') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        ✓
      </span>
    )
  }
  if (value === 'NO') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        ✗
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 ring-1 ring-inset ring-amber-200">
      {value}
    </span>
  )
}

export default function AccessPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    usersApi
      .list()
      .then(setUsers)
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [toast])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Access &amp; permissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Each user belongs to exactly one role. The role decides what they can see, edit, and
          delete. Permissions are enforced at both the application layer and the database layer
          (Postgres RLS).
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-medium text-slate-900">Roles in your firm</h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <strong>Managing Partner</strong> — full control across the firm. Only role that can
            create users, change roles, or export the audit log.
          </li>
          <li>
            <strong>Partner</strong> — read everything firm-wide; cannot manage users or branches
            or change permissions.
          </li>
          <li>
            <strong>Branch Head</strong> — manages own branch's clients, filings, and documents.
            Cannot see other branches' data.
          </li>
          <li>
            <strong>Senior Article</strong> — manages clients assigned to them; can set portal
            credentials and create filings.
          </li>
          <li>
            <strong>Article</strong> — data entry on assigned clients. Cannot delete or change
            structural fields (branch, assignee, status).
          </li>
          <li>
            <strong>Accountant</strong> — same scope as Article. Specialised label for in-house
            bookkeepers.
          </li>
        </ul>
      </div>

      {/* Per-user view */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-medium text-slate-900">Current users</h2>
          <p className="text-xs text-slate-500">
            Click a row to edit a user's role, branch, or active status.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">User</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Branch</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className={`cursor-pointer hover:bg-slate-50 ${!u.isActive ? 'opacity-50' : ''}`}
                    onClick={() => navigate(`/users?edit=${u.id}`)}
                  >
                    <td className="px-4 py-2 font-medium text-slate-900">{u.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-2 text-xs">
                      {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{u.branch?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-xs">
                      {u.isActive ? (
                        <span className="text-emerald-600">Active</span>
                      ) : (
                        <span className="text-red-600">Deactivated</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to={`/users?edit=${u.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-right">
          <Link to="/users" className="text-sm text-indigo-600 hover:underline">
            Go to Users page →
          </Link>
        </div>
      </div>

      {/* Permissions matrix */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-medium text-slate-900">Permission matrix</h2>
          <p className="text-xs text-slate-500">
            ✓ = allowed. ✗ = blocked. Amber labels indicate scoped access (e.g. only own branch).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left font-medium">
                  Action
                </th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-2 text-center font-medium">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((sec) => (
                <>
                  <tr key={sec.title} className="bg-slate-100">
                    <td colSpan={ROLES.length + 1} className="px-4 py-2">
                      <div className="text-sm font-medium text-slate-900">{sec.title}</div>
                      {sec.description && (
                        <div className="text-xs text-slate-500">{sec.description}</div>
                      )}
                    </td>
                  </tr>
                  {sec.rows.map((row, i) => (
                    <tr key={`${sec.title}-${i}`} className="border-t border-slate-100">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm text-slate-700">
                        {row.action}
                      </td>
                      {ROLES.map((r) => (
                        <td key={r} className="px-3 py-2 text-center">
                          <CellBadge value={row.cells[r]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <strong>Note:</strong> This matrix reflects the current code-enforced rules. To grant or
        restrict access for a specific person, change their role on the Users page — there are no
        per-user custom overrides in Phase 1 (and most CA firms find role-based control sufficient).
      </div>
    </div>
  )
}
